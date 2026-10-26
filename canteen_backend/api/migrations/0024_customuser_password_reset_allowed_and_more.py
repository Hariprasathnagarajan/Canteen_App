import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0023_realign_token_cycle_keys'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='password_reset_allowed',
            field=models.BooleanField(default=False, help_text='One-time permission to set a new password. Granted by a Super Admin on approval, consumed on use.'),
        ),
        migrations.AddField(
            model_name='passwordresetrequest',
            name='reset_completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='passwordresetrequest',
            name='reset_completed_ip',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
    ]
