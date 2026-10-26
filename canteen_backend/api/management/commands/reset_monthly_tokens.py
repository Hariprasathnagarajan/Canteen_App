from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'DISABLED: token resets are now approval-gated.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.ERROR(
            'reset_monthly_tokens is disabled. Token resets are now approval-gated '
            '(cycle start = the configured token_allocation_day). Use the Admin '
            '"Approve & Distribute" action or POST /api/admin/tokens/approve-reset/.'
        ))
