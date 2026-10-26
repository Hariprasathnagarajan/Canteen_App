from django.db import migrations

def backfill_office_and_kitchen(apps, schema_editor):
    Office = apps.get_model('api', 'Office')
    Kitchen = apps.get_model('api', 'Kitchen')
    CustomUser = apps.get_model('api', 'CustomUser')
    MenuItem = apps.get_model('api', 'MenuItem')
    Order = apps.get_model('api', 'Order')

    office, _ = Office.objects.get_or_create(
        code='HQ',
        defaults={
            'name': 'Main Office',
            'location': 'Headquarters Campus',
            'is_active': True
        }
    )

    kitchen, _ = Kitchen.objects.get_or_create(
        office=office,
        defaults={
            'name': 'Main Kitchen',
            'is_active': True
        }
    )

    CustomUser.objects.filter(office__isnull=True).update(office=office)
    MenuItem.objects.filter(kitchen__isnull=True).update(kitchen=kitchen)
    Order.objects.filter(kitchen__isnull=True).update(kitchen=kitchen)


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_kitchen_office_customuser_assigned_kitchen_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_office_and_kitchen, reverse_backfill),
    ]
