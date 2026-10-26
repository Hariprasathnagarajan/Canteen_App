from django.core.management.base import BaseCommand
from api.token_service import get_billing_cycle_dates, distribute_approved_monthly_tokens
from api.models import TokenResetApproval, CanteenSetting


class Command(BaseCommand):
    help = 'Re-apply or execute approved token allocation for the current billing cycle.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--notes',
            default='Re-applied from the management command',
            help='Audit note recorded against every transaction created by this run.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force distribution even if allocation mode is manual.'
        )

    def handle(self, *args, **options):
        setting = CanteenSetting.get_settings()
        if setting.monthly_token_allocation_mode == 'manual' and not options.get('force'):
            self.stdout.write(self.style.WARNING(
                'Automatic monthly token allocation is currently OFF (mode is manual). '
                'Use --force to run anyway, or perform manual allocation via the Admin UI.'
            ))
            return

        cycle_month = get_billing_cycle_dates()['cycle_start']
        approval = TokenResetApproval.objects.filter(
            cycle_month=cycle_month,
            status='approved'
        ).first()

        if not approval:
            self.stdout.write(self.style.WARNING(
                f'No approved token reset for cycle {cycle_month}. '
                'Approve the reset in the Admin UI first - this command never bypasses approval.'
            ))
            return

        result = distribute_approved_monthly_tokens(
            admin_user=approval.approved_by,
            notes=options.get('notes') or 'Re-applied from the management command',
        )

        self.stdout.write(self.style.SUCCESS(
            f"Re-applied {result['total_tokens_distributed']} tokens to "
            f"{result['total_users_allocated']} users for cycle {cycle_month}."
        ))
