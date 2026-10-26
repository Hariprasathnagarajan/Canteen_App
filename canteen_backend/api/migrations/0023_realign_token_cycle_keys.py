import datetime
from django.db import migrations, models


def _add_months(d, n):
    """Same day-of-month, n months later. Safe because allocation_day <= 28."""
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    return datetime.date(y, m, d.day)


def _cycle_start_for(value, allocation_day):
    """The billing cycle that CONTAINS the given date.

    allocation_day = 20: 2026-10-01 -> 2026-09-20, 2026-10-20 -> 2026-10-20,
    2026-10-22 -> 2026-10-20. Idempotent on cycle starts.
    """
    if value.day >= allocation_day:
        return value.replace(day=allocation_day)
    prev_month = 12 if value.month == 1 else value.month - 1
    prev_year = value.year - 1 if value.month == 1 else value.year
    return datetime.date(prev_year, prev_month, allocation_day)


def _month_first_for_cycle_start(cycle_start, allocation_day):
    """Exact inverse of _cycle_start_for for 1st-of-month keys.

    The legacy key is the 1st of the month that contains the cycle end.
    """
    cycle_end = _add_months(cycle_start, 1) - datetime.timedelta(days=1)
    return cycle_end.replace(day=1)


def _allocation_day(apps):
    CanteenSetting = apps.get_model('api', 'CanteenSetting')
    setting = CanteenSetting.objects.filter(pk=1).first() or CanteenSetting.objects.order_by('pk').first()
    day = getattr(setting, 'token_allocation_day', 20) or 20
    return max(1, min(28, day))


def _realign(apps, key_map):
    """Move every allocation row onto the canonical billing-cycle key.

    key_map maps an old key to the new key. Rows are processed newest-first
    so that when two rows collapse onto the same cycle the newer row wins.
    """
    day = _allocation_day(apps)
    TokenDistribution = apps.get_model('api', 'TokenDistribution')
    ShiftTokenAllocation = apps.get_model('api', 'ShiftTokenAllocation')
    CustomUser = apps.get_model('api', 'CustomUser')

    for model, key_fields in (
        (TokenDistribution, ('user',)),
        (ShiftTokenAllocation, ('shift',)),
    ):
        for row in model.objects.all().order_by('-pk'):
            new_key = key_map(row.allocation_month, day)
            if new_key == row.allocation_month:
                continue
            lookup = {f: getattr(row, f) for f in key_fields}
            lookup['allocation_month'] = new_key
            clash = model.objects.filter(**lookup).exclude(pk=row.pk).first()
            if clash is not None:
                # The target cycle already has a row: keep the newer one.
                model.objects.filter(pk=row.pk).delete()
                continue
            model.objects.filter(pk=row.pk).update(allocation_month=new_key)

    # last_token_reset becomes a cycle marker (never a wall-clock date).
    for user in CustomUser.objects.exclude(last_token_reset=None).order_by('-pk'):
        new_value = key_map(user.last_token_reset, day)
        if new_value != user.last_token_reset:
            user.last_token_reset = new_value
            user.save(update_fields=['last_token_reset'])


def realign_forward(apps, schema_editor):
    _realign(apps, lambda value, day: _cycle_start_for(value, day))


def realign_reverse(apps, schema_editor):
    _realign(apps, lambda value, day: _month_first_for_cycle_start(value, day))


def dedupe_canteen_setting(apps, schema_editor):
    """CanteenSetting.get_settings() always reads pk=1. Keep one row only."""
    CanteenSetting = apps.get_model('api', 'CanteenSetting')
    keeper = CanteenSetting.objects.filter(pk=1).first() or CanteenSetting.objects.order_by('pk').first()
    if keeper is None:
        return
    CanteenSetting.objects.exclude(pk=keeper.pk).delete()


def scrub_reset_notes(apps, schema_editor):
    """Historical admin_notes rows contain the plaintext default password."""
    PasswordResetRequest = apps.get_model('api', 'PasswordResetRequest')
    PasswordResetRequest.objects.filter(admin_notes__icontains='Password reset to default').update(
        admin_notes='Reset approved; the password was set by the user.'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_canteensetting_reminder_days_before_reset_and_more'),
    ]

    operations = [
        migrations.RunPython(realign_forward, realign_reverse),
        migrations.RunPython(dedupe_canteen_setting, migrations.RunPython.noop),
        migrations.RunPython(scrub_reset_notes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='customuser',
            name='last_token_reset',
            field=models.DateField(blank=True, default=None, null=True),
        ),
        migrations.AddConstraint(
            model_name='tokenresetapproval',
            constraint=models.UniqueConstraint(fields=('cycle_month',), name='uniq_tokenresetapproval_cycle_month'),
        ),
    ]
