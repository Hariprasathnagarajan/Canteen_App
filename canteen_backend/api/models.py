from decimal import Decimal
from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password


def default_password_for(user):
    """
    Single source of truth for a user's default password.
    Prefers the user_id (Employee/Staff ID); falls back to the username so
    that every default password is unique and never a shared literal.
    """
    return (user.user_id or '').strip() or user.username


class Office(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=20, unique=True, help_text="Short location code, e.g. HQ, TRZ, CHN")
    location = models.CharField(max_length=255, blank=True, default='', help_text="Building, campus, or address")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)
        if is_new:
            Kitchen.objects.get_or_create(
                office=self,
                defaults={'name': f"{self.name} Kitchen"}
            )


class Kitchen(models.Model):
    office = models.OneToOneField(Office, on_delete=models.CASCADE, related_name='kitchen')
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.office.name})"


def get_default_kitchen():
    office, _ = Office.objects.get_or_create(
        code='HQ',
        defaults={'name': 'Main Office', 'location': 'Headquarters'}
    )
    kitchen, _ = Kitchen.objects.get_or_create(
        office=office,
        defaults={'name': 'Main Kitchen'}
    )
    return kitchen


class CustomUser(AbstractUser):
    WORK_SHIFT_CHOICES = [
        ('day', 'Day'),
        ('mid', 'Mid'),
        ('night', 'Night'),
    ]
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('staff_admin', 'Staff Admin'),
        ('staff', 'Staff'),
        ('employee', 'Employee'),
        ('guest', 'Guest'),
    ]
    work_shift = models.CharField(max_length=10, choices=WORK_SHIFT_CHOICES, default='day')
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default='employee')
    user_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    assigned_kitchen = models.ForeignKey(Kitchen, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    monthly_tokens = models.PositiveIntegerField(default=0)
    last_token_reset = models.DateField(null=True, blank=True, default=None)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    password_reset_allowed = models.BooleanField(
        default=False,
        help_text="One-time permission to set a new password. Granted by a Super Admin on approval, consumed on use.",
    )

    def get_kitchen(self):
        """Returns the user's active kitchen (assigned kitchen for staff, office kitchen for employees, or default kitchen)."""
        if self.assigned_kitchen and self.assigned_kitchen.is_active:
            return self.assigned_kitchen
        if self.office and hasattr(self.office, 'kitchen') and self.office.kitchen.is_active:
            return self.office.kitchen
        first_kitchen = Kitchen.objects.filter(is_active=True).first()
        if first_kitchen:
            return first_kitchen
        return get_default_kitchen()

    def save(self, *args, **kwargs):
        # Only set a default password if creating and no password has been set
        if not self.pk and not self.password:
            self.password = make_password(default_password_for(self))
        if self.is_deleted:
            self.is_active = False
        super().save(*args, **kwargs)

    def default_password(self):
        """The default password for this user: user_id, else username."""
        return default_password_for(self)

    def delete(self, *args, **kwargs):
        # Non-destructive soft-delete
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['is_deleted', 'deleted_at', 'is_active'])

    def current_tokens(self):
        # Admin, staff_admin, and staff don't use tokens
        if self.role in ['admin', 'staff_admin', 'staff']:
            return 0

        # Tokens are only ever set explicitly by an administrator through the
        # Token Allocation page. There are no implicit defaults or mock resets.
        return self.monthly_tokens

    def grant_password_reset_permission(self):
        """Grant the one-time permission to set a new password."""
        self.password_reset_allowed = True
        self.save(update_fields=['password_reset_allowed'])
        return True

    def consume_password_reset_permission(self, new_password):
        """Atomically consume the one-time reset permission and set the new password.

        Returns True only when the permission was still granted. Uses a single
        conditional UPDATE (SQLite-safe) instead of select_for_update(), which
        is a no-op on SQLite.
        """
        consumed = CustomUser.objects.filter(
            pk=self.pk, password_reset_allowed=True
        ).update(password_reset_allowed=False)
        if not consumed:
            return False
        self.set_password(new_password)
        self.save(update_fields=['password'])
        self.password_reset_allowed = False
        return True

    def __str__(self):
        return self.username


class MenuItem(models.Model):
    CATEGORY_CHOICES = [
        ('meal', 'Meals / Food'),
        ('snack', 'Snacks'),
        ('beverage', 'Beverages'),
    ]
    FOOD_TYPE_CHOICES = [
        ('veg', 'Vegetarian'),
        ('non_veg', 'Non-Vegetarian'),
    ]
    kitchen = models.ForeignKey(Kitchen, on_delete=models.CASCADE, related_name='menu_items', null=True, blank=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    price = models.PositiveIntegerField(help_text="Token cost")
    price_inr = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Rupee price")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='meal')
    is_veg = models.BooleanField(default=True, help_text="True for Veg, False for Non-Veg")
    food_type = models.CharField(max_length=10, choices=FOOD_TYPE_CHOICES, default='veg')
    is_available = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.kitchen_id:
            try:
                self.kitchen = get_default_kitchen()
            except Exception:
                pass
        name_lower = (self.name or '').lower()

        # Non-veg keywords auto-detection
        non_veg_words = ['chicken', 'mutton', 'fish', 'egg', 'prawn', 'meat', 'beef', 'pork', 'crab', 'omlette', 'omelette', 'non veg', 'non-veg']
        if any(w in name_lower for w in non_veg_words):
            # Check if name explicitly indicates veg (e.g. Soya Chicken (Veg))
            if 'veg' in name_lower and not any(nv in name_lower for nv in ['non-veg', 'non veg', 'nonveg']):
                self.is_veg = True
                self.food_type = 'veg'
            else:
                self.is_veg = False
                self.food_type = 'non_veg'
        elif not self.is_veg or self.food_type == 'non_veg':
            self.is_veg = False
            self.food_type = 'non_veg'
        else:
            self.is_veg = True
            self.food_type = 'veg'

        explicit_category = getattr(self, '_category_explicit', False)
        if not explicit_category and (not self.category or self.category == 'meal'):
            if any(w in name_lower for w in ['coffee', 'tea', 'lassi', 'buttermilk', 'beverage', 'juice', 'shake', 'water', 'soda']):
                self.category = 'beverage'
            elif any(w in name_lower for w in ['samosa', 'vada', 'snack', 'bajji', 'pakoda', 'puff', 'bonda', 'biscuit', 'cookie']):
                self.category = 'snack'
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Non-destructive soft-delete
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.is_available = False
        self.save(update_fields=['is_deleted', 'deleted_at', 'is_available'])

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    kitchen = models.ForeignKey(Kitchen, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    total_tokens = models.PositiveIntegerField(default=0)
    total_amount_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    tokens_refunded = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_orders')
    accepted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_orders')
    cancellation_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.kitchen_id and self.user_id:
            try:
                self.kitchen = self.user.get_kitchen()
            except Exception:
                pass
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']

    @property
    def total_amount(self):
        """Calculate total amount from order items"""
        return sum(item.tokens_per_item * item.quantity for item in self.order_items.all())

    def refund_tokens(self):
        """Safely refund deducted tokens to user if order is declined/cancelled (idempotent, row-locked)"""
        if not self.tokens_refunded and self.total_tokens > 0 and self.user.role not in ['admin', 'staff_admin', 'staff']:
            with transaction.atomic():
                user = CustomUser.objects.select_for_update().get(pk=self.user_id)
                user.monthly_tokens += self.total_tokens
                user.save(update_fields=['monthly_tokens'])
                self.user.monthly_tokens = user.monthly_tokens
                self.tokens_refunded = True
                self.save(update_fields=['tokens_refunded'])
                return True
        return False

    def __str__(self):
        return f"Order #{self.id} - {self.user.username}"


class OrderItem(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('fulfilled', 'Fulfilled'),
        ('out_of_stock', 'Out of Stock'),
    ]
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='order_items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    tokens_per_item = models.PositiveIntegerField()
    price_inr_per_item = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='fulfilled')

    @property
    def total_tokens(self):
        return self.tokens_per_item * self.quantity

    @property
    def total_price_inr(self):
        return self.price_inr_per_item * self.quantity

    def __str__(self):
        return f"{self.menu_item.name} x {self.quantity} ({self.status})"


class ShiftTokenAllocation(models.Model):
    SHIFT_CHOICES = CustomUser.WORK_SHIFT_CHOICES

    shift = models.CharField(max_length=10, choices=SHIFT_CHOICES, db_index=True)
    tokens_per_user = models.PositiveIntegerField(default=0)
    allocation_month = models.DateField(default=timezone.now, db_index=True)

    class Meta:
        unique_together = ('shift', 'allocation_month')
        indexes = [
            models.Index(fields=['shift', 'allocation_month']),
        ]

    def save(self, *args, **kwargs):
        # allocation_month is the canonical billing-cycle start (e.g. 2026-10-20).
        # It is never normalised to the 1st: the token engine keys on cycle start.
        # There is deliberately no wallet side effect here - crediting wallets
        # belongs to the approved-reset path (distribute_approved_monthly_tokens)
        # and to the explicit admin allocation path (views._allocate_shift_tokens).
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_shift_display()} shift - {self.tokens_per_user} tokens ({self.allocation_month.strftime('%b %Y')})"


class TokenDistribution(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='token_distributions', null=True, blank=True)
    tokens_allocated = models.PositiveIntegerField(default=0)
    allocation_month = models.DateField(default=timezone.now, db_index=True)

    class Meta:
        unique_together = ('user', 'allocation_month')
        indexes = [
            models.Index(fields=['user', 'allocation_month']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def assign_tokens(self, amount, month=None):
        from .token_service import get_current_cycle_start
        month = month or get_current_cycle_start()
        self.tokens_allocated = amount
        self.allocation_month = month
        self.save(update_fields=['tokens_allocated', 'allocation_month'])
        
        # sync with user
        self.user.monthly_tokens = amount
        self.user.last_token_reset = month
        self.user.save(update_fields=['monthly_tokens', 'last_token_reset'])

    def __str__(self):
        user_display = self.user.username if self.user else 'Unknown User'
        return f"{user_display} - {self.tokens_allocated} tokens ({self.allocation_month.strftime('%b %Y')})"


class PasswordResetRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='password_reset_requests')
    reason = models.TextField(blank=True, default='')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_password_resets')
    admin_notes = models.TextField(blank=True, default='')
    reset_completed_at = models.DateTimeField(null=True, blank=True)
    reset_completed_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def approve(self, admin_user):
        """Approve the request: grant a one-time permission to set a new password.

        The password itself is never set, reset or disclosed by the admin.
        """
        self.status = 'approved'
        self.reviewed_at = timezone.now()
        self.reviewed_by = admin_user
        self.admin_notes = f'Approved by {admin_user.username}. The user may set a new password once.'
        self.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'admin_notes'])
        self.user.grant_password_reset_permission()

    def reject(self, admin_user, notes=''):
        self.status = 'rejected'
        self.reviewed_at = timezone.now()
        self.reviewed_by = admin_user
        self.admin_notes = notes or f'Rejected by {admin_user.username}.'
        self.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'admin_notes'])
        CustomUser.objects.filter(pk=self.user_id).update(password_reset_allowed=False)

    def mark_consumed(self, ip_address=None):
        self.reset_completed_at = timezone.now()
        self.reset_completed_ip = ip_address
        self.save(update_fields=['reset_completed_at', 'reset_completed_ip'])

    def __str__(self):
        return f"Password Reset: {self.user.username} ({self.status})"


class CanteenSetting(models.Model):
    """Configurable system settings, including daily ordering limits and shift reset schedule"""
    SHIFT_RESET_CHOICES = [
        ('shift_based', 'Employee Shift Schedule'),
        ('daily_window', 'Daily Window (00:00 IST)'),
    ]
    max_orders_per_user_per_day = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Maximum total orders an employee/guest may place per day. Leave blank to disable limit."
    )
    max_qty_per_item_per_day = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Maximum quantity of any single dish an employee/guest may order per day. Leave blank to disable limit."
    )
    shift_reset_mode = models.CharField(
        max_length=30,
        choices=SHIFT_RESET_CHOICES,
        default='shift_based',
        help_text="Reset boundary logic: shift_based resets quota according to employee shift interval."
    )
    day_shift_daily_limit = models.PositiveIntegerField(
        null=True, blank=True, default=300,
        help_text="Per-day token spending limit for Day Shift users (default 300 tk)."
    )
    mid_shift_daily_limit = models.PositiveIntegerField(
        null=True, blank=True, default=250,
        help_text="Per-day token spending limit for Mid Shift users (default 250 tk)."
    )
    night_shift_daily_limit = models.PositiveIntegerField(
        null=True, blank=True, default=300,
        help_text="Per-day token spending limit for Night Shift users (default 300 tk)."
    )
    ALLOCATION_MODE_CHOICES = [
        ('automatic', 'Automatic'),
        ('manual', 'Manual'),
    ]
    monthly_token_allocation_mode = models.CharField(
        max_length=20,
        choices=ALLOCATION_MODE_CHOICES,
        default='automatic',
        help_text="Routine monthly token allocation mode: automatic or manual."
    )
    day_shift_policy_quota = models.PositiveIntegerField(
        default=100,
        help_text="Standard monthly policy quota per diner for Day Shift."
    )
    mid_shift_policy_quota = models.PositiveIntegerField(
        default=100,
        help_text="Standard monthly policy quota per diner for Mid Shift."
    )
    night_shift_policy_quota = models.PositiveIntegerField(
        default=100,
        help_text="Standard monthly policy quota per diner for Night Shift."
    )
    token_allocation_day = models.PositiveIntegerField(
        null=True, blank=True, default=20,
        help_text="Day of month when monthly tokens are allocated and billing cycle begins (default 20 for 20th-to-19th cycle)."
    )
    reminder_days_before_reset = models.PositiveIntegerField(
        default=3,
        help_text="Number of days before monthly token reset day to alert/remind admin to review past month consumption and approve distribution."
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)

    def get_shift_policy_quota(self, shift):
        shift = (shift or 'day').lower().replace('_shift', '')
        if shift == 'mid':
            return self.mid_shift_policy_quota
        elif shift == 'night':
            return self.night_shift_policy_quota
        return self.day_shift_policy_quota

    def get_daily_token_limit_for_user(self, user):
        shift = (getattr(user, 'work_shift', None) or 'day').lower().replace('_shift', '')
        if shift == 'mid':
            return self.mid_shift_daily_limit
        elif shift == 'night':
            return self.night_shift_daily_limit
        return self.day_shift_daily_limit

    def __str__(self):
        return f"Canteen Settings (Mode: {self.monthly_token_allocation_mode}, Day Limit: {self.day_shift_daily_limit}, Mid: {self.mid_shift_daily_limit}, Night: {self.night_shift_daily_limit}, Allocation Day: {self.token_allocation_day})"

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class CompanyBill(models.Model):
    """Monthly company billing records aggregating completed cafeteria orders"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('generated', 'Generated'),
        ('paid', 'Settled'),
        ('partially_paid', 'Partially Settled'),
    ]
    bill_number = models.CharField(max_length=50, unique=True)
    billing_period_start = models.DateField(help_text="Start of billing cycle determined by token reset day")
    billing_period_end = models.DateField(help_text="End of billing cycle determined by token reset day")
    total_orders_count = models.PositiveIntegerField(default=0)
    total_tokens_spent = models.PositiveIntegerField(default=0)
    total_tokens_billed = models.PositiveIntegerField(default=0)
    total_tokens_settled = models.PositiveIntegerField(default=0)
    outstanding_tokens = models.PositiveIntegerField(default=0)
    total_amount_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True)
    total_paid_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True)
    outstanding_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generated')
    generated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_company_bills')
    generated_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-billing_period_end']

    def __str__(self):
        return f"Company Bill #{self.bill_number} ({self.billing_period_start} to {self.billing_period_end}) - {self.total_tokens_spent} tokens"


class FinancialTransaction(models.Model):
    """Cafeteria transaction ledger tracking token allocations, debits, reversals, and adjustments (no real currency)"""
    TRANSACTION_TYPES = [
        ('manual_payment', 'Token Allocation / Payment'),
        ('advance', 'Employee Advance'),
        ('deduction', 'Payroll Deduction'),
        ('order_debit', 'Order Debit'),
        ('refund', 'Refund / Reversal'),
        ('adjustment', 'Admin Adjustment'),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='financial_transactions', null=True, blank=True)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount_tokens = models.PositiveIntegerField(default=0, help_text="Transaction value in cafeteria tokens")
    amount_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, null=True, blank=True)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    company_bill = models.ForeignKey(CompanyBill, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    payment_method = models.CharField(max_length=50, blank=True, default='token_transfer')
    payment_reference = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_financial_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    reversal_of = models.OneToOneField('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversed_by')

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.amount_tokens and self.amount_inr:
            self.amount_tokens = int(self.amount_inr)
        elif self.amount_tokens and not self.amount_inr:
            self.amount_inr = Decimal(self.amount_tokens)
        super().save(*args, **kwargs)

    def __str__(self):
        user_display = self.user.username if self.user else 'Company'
        return f"[{self.get_transaction_type_display()}] {self.amount_tokens} tokens - {user_display} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class TokenResetApproval(models.Model):
    """
    Monthly token reset and distribution approval ledger.
    Tokens are only distributed to diner accounts AFTER an administrator approves
    the proposed allocation based on the past month's token metrics.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved & Distributed'),
        ('rejected', 'Rejected'),
    ]

    cycle_month = models.DateField(db_index=True, help_text="Cycle start or 1st of target month")
    cycle_end = models.DateField(null=True, blank=True, help_text="Cycle end date (e.g. 19th of next month)")
    reset_date = models.DateField(null=True, blank=True, help_text="Actual date when tokens were reset and distributed")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    allocation_mode = models.CharField(max_length=20, default='automatic', help_text="Automatic or manual allocation")
    past_month_total_spent = models.PositiveIntegerField(default=0, help_text="Total tokens spent during previous cycle")
    past_month_total_allocated = models.PositiveIntegerField(default=0, help_text="Total tokens allocated during previous cycle")
    past_month_total_unused = models.PositiveIntegerField(default=0, help_text="Total unused tokens at reset time")
    proposed_tokens = models.PositiveIntegerField(default=0, help_text="Total tokens proposed for distribution")
    distributed_tokens = models.PositiveIntegerField(default=0, help_text="Total tokens actually distributed upon approval")
    affected_users_count = models.PositiveIntegerField(default=0, help_text="Number of diners who received tokens")
    shift_breakdown = models.JSONField(default=dict, blank=True, help_text="Snapshot of per-shift metrics (spent, quota, user count)")
    policy_snapshot = models.JSONField(default=dict, blank=True, help_text="Snapshot of policy quotas at proposal time")
    draft_quotas = models.JSONField(default=dict, blank=True, help_text="Manual draft quotas entered for this cycle")
    approved_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_token_resets')
    approved_at = models.DateTimeField(null=True, blank=True)
    allocated_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when tokens were credited to wallets")
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-cycle_month', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['cycle_month'], name='uniq_tokenresetapproval_cycle_month'),
        ]

    def __str__(self):
        return f"Token Reset {self.cycle_month.strftime('%b %Y')} ({self.status}) - {self.distributed_tokens} tk"


class TokenAllocationAuditLog(models.Model):
    EVENT_TYPES = [
        ('mode_change', 'Mode Change'),
        ('proposal_created', 'Proposal Created'),
        ('proposal_updated', 'Proposal Updated'),
        ('proposal_invalidated', 'Proposal Invalidated'),
        ('approved', 'Approved by Super Admin'),
        ('rejected', 'Rejected by Super Admin'),
        ('allocated', 'Allocation Executed'),
        ('manual_allocation', 'Manual Allocation'),
        ('allocation_failed', 'Allocation Failed'),
        ('retry_attempt', 'Retry Attempt'),
    ]
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES, db_index=True)
    billing_cycle_start = models.DateField(db_index=True)
    billing_cycle_end = models.DateField(null=True, blank=True)
    performed_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='allocation_audit_logs')
    details = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_display = self.performed_by.username if self.performed_by else 'System'
        return f"[{self.get_event_type_display()}] Cycle {self.billing_cycle_start} by {user_display}"


