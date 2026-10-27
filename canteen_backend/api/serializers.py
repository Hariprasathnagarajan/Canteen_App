from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import (
    Office, Kitchen,
    CustomUser, MenuItem, Order, OrderItem,
    ShiftTokenAllocation, TokenDistribution, PasswordResetRequest,
    CanteenSetting, CompanyBill, FinancialTransaction, TokenResetApproval,
    TokenAllocationAuditLog, default_password_for
)


class OfficeSerializer(serializers.ModelSerializer):
    kitchen_id = serializers.IntegerField(source='kitchen.id', read_only=True)
    kitchen_name = serializers.CharField(source='kitchen.name', read_only=True)
    user_count = serializers.SerializerMethodField()
    menu_item_count = serializers.SerializerMethodField()

    class Meta:
        model = Office
        fields = [
            'id', 'name', 'code', 'location', 'is_active',
            'kitchen_id', 'kitchen_name', 'user_count', 'menu_item_count', 'created_at'
        ]

    def get_user_count(self, obj):
        return obj.users.filter(is_deleted=False).count()

    def get_menu_item_count(self, obj):
        if hasattr(obj, 'kitchen'):
            return obj.kitchen.menu_items.filter(is_deleted=False).count()
        return 0


class KitchenSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source='office.name', read_only=True)
    office_code = serializers.CharField(source='office.code', read_only=True)
    menu_item_count = serializers.SerializerMethodField()
    staff_count = serializers.SerializerMethodField()

    class Meta:
        model = Kitchen
        fields = [
            'id', 'name', 'office', 'office_name', 'office_code',
            'is_active', 'menu_item_count', 'staff_count', 'created_at'
        ]

    def get_menu_item_count(self, obj):
        return obj.menu_items.filter(is_deleted=False).count()

    def get_staff_count(self, obj):
        return obj.staff_members.filter(is_deleted=False).count()


class CustomUserCreateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=CustomUser.ROLE_CHOICES, default='employee')
    user_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all(), required=False, allow_null=True)
    assigned_kitchen = serializers.PrimaryKeyRelatedField(queryset=Kitchen.objects.all(), required=False, allow_null=True)

    class Meta:
        model = CustomUser
        fields = [
            'username', 'user_id', 'first_name', 'last_name', 'email', 'role',
            'work_shift', 'office', 'assigned_kitchen'
        ]

    def validate_username(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError('Username is required.')
        if CustomUser.objects.filter(username__iexact=val, is_deleted=False).exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return val

    def validate_user_id(self, value):
        if not value or not str(value).strip():
            return None
        val = str(value).strip()
        if CustomUser.objects.filter(user_id__iexact=val, is_deleted=False).exists():
            raise serializers.ValidationError('A user with this User ID already exists.')
        return val

    def create(self, validated_data):
        user_id = validated_data.get('user_id')
        if not user_id:
            user_id = None
            validated_data['user_id'] = None

        user = CustomUser(**validated_data)

        # Default password = user_id (Employee/Staff ID), else username.
        user.set_password(default_password_for(user))

        # Tokens are never auto-allocated. New users start at 0 and an
        # administrator assigns tokens explicitly via Token Allocation.
        user.monthly_tokens = 0
        # A brand-new account has never been credited: no cycle marker.
        user.last_token_reset = None

        if user.role in ['staff', 'staff_admin']:
            user.is_staff = True

        user.save()
        return user


class CustomUserSerializer(serializers.ModelSerializer):
    tokens = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    user_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    office_id = serializers.IntegerField(source='office.id', read_only=True, allow_null=True)
    office_name = serializers.CharField(source='office.name', read_only=True, allow_null=True)
    office_code = serializers.CharField(source='office.code', read_only=True, allow_null=True)
    assigned_kitchen_id = serializers.IntegerField(source='assigned_kitchen.id', read_only=True, allow_null=True)
    assigned_kitchen_name = serializers.CharField(source='assigned_kitchen.name', read_only=True, allow_null=True)
    active_kitchen = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name', 'last_name', 'name', 'email', 'role',
            'work_shift', 'user_id', 'tokens', 'office', 'office_id', 'office_name',
            'office_code', 'assigned_kitchen', 'assigned_kitchen_id', 'assigned_kitchen_name',
            'active_kitchen', 'is_deleted', 'deleted_at'
        ]
        extra_kwargs = {
            'tokens': {'read_only': True}
        }

    def validate_user_id(self, value):
        if not value or not str(value).strip():
            return None
        val = str(value).strip()
        user_pk = self.instance.pk if self.instance else None
        if CustomUser.objects.filter(user_id__iexact=val, is_deleted=False).exclude(pk=user_pk).exists():
            raise serializers.ValidationError('A user with this User ID already exists.')
        return val

    def get_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_tokens(self, obj):
        # Tokens are maintained exclusively for employee and guest
        if obj.role not in ['employee', 'guest']:
            return None
        return obj.current_tokens()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Admin, staff_admin, and staff are not employees, so remove token field completely
        if instance.role not in ['employee', 'guest']:
            data.pop('tokens', None)
        return data

    def get_active_kitchen(self, obj):
        k = obj.get_kitchen()
        if k:
            return {'id': k.id, 'name': k.name, 'office_name': k.office.name}
        return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('username', '').strip()
        password = attrs.get('password')

        if identifier and password:
            # All roles can log in using username
            user_obj = CustomUser.objects.filter(username__iexact=identifier, is_deleted=False).first()

            # Regular users (employee, guest) can also log in using Employee ID (user_id) or email.
            # Admin, staff, and staff_admin are restricted to logging in only with username.
            if not user_obj:
                user_obj = (
                    CustomUser.objects.filter(user_id__iexact=identifier, role__in=['employee', 'guest'], is_deleted=False).first()
                    or CustomUser.objects.filter(email__iexact=identifier, role__in=['employee', 'guest'], is_deleted=False).first()
                )

            username_to_auth = user_obj.username if user_obj else identifier
            user = authenticate(username=username_to_auth, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active or getattr(user, 'is_deleted', False):
                raise serializers.ValidationError('User account is disabled or deactivated')
            attrs['user'] = user
            return attrs
        raise serializers.ValidationError('Must include username and password')


class MenuItemSerializer(serializers.ModelSerializer):
    kitchen_id = serializers.IntegerField(source='kitchen.id', read_only=True, allow_null=True)
    kitchen_name = serializers.CharField(source='kitchen.name', read_only=True, allow_null=True)
    office_name = serializers.CharField(source='kitchen.office.name', read_only=True, allow_null=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'kitchen', 'kitchen_id', 'kitchen_name', 'office_name',
            'name', 'description', 'price', 'price_inr', 'category', 'is_veg',
            'food_type', 'is_available', 'is_deleted', 'created_at'
        ]

    def _flag_explicit_category(self, instance):
        if 'category' in self.initial_data:
            instance._category_explicit = True
        return instance

    def create(self, validated_data):
        instance = MenuItem(**validated_data)
        self._flag_explicit_category(instance)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        self._flag_explicit_category(instance)
        return super().update(instance, validated_data)


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item = MenuItemSerializer(read_only=True)
    menu_item_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_id', 'quantity', 'tokens_per_item', 'price_inr_per_item', 'total_tokens', 'total_price_inr', 'status']


class OrderSerializer(serializers.ModelSerializer):
    order_items = OrderItemSerializer(many=True, read_only=True)
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    user_details = serializers.SerializerMethodField()
    kitchen_id = serializers.IntegerField(source='kitchen.id', read_only=True, allow_null=True)
    kitchen_name = serializers.CharField(source='kitchen.name', read_only=True, allow_null=True)
    office_name = serializers.CharField(source='kitchen.office.name', read_only=True, allow_null=True)
    accepted_by = serializers.PrimaryKeyRelatedField(read_only=True)
    accepted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'user_details', 'kitchen', 'kitchen_id', 'kitchen_name', 'office_name',
            'accepted_by', 'accepted_by_name',
            'status', 'total_tokens', 'total_amount_inr',
            'tokens_refunded', 'created_at', 'updated_at', 'cancelled_at', 'cancellation_reason',
            'order_items', 'items'
        ]
        read_only_fields = ['user', 'total_tokens', 'total_amount_inr', 'tokens_refunded', 'cancelled_at', 'accepted_by']

    def get_accepted_by_name(self, obj):
        if obj.accepted_by:
            return obj.accepted_by.get_full_name() or obj.accepted_by.username
        return None

    def get_user_details(self, obj):
        return {
            'username': obj.user.username,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'user_id': obj.user.user_id,
            'role': obj.user.role,
            'work_shift': obj.user.work_shift,
            'office_name': obj.user.office.name if obj.user.office else None,
        }

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user

        order = Order.objects.create(user=user, **validated_data)
        total_tokens = 0
        total_inr = 0

        for item_data in items_data:
            menu_item = MenuItem.objects.get(id=item_data['menu_item_id'])
            quantity = item_data['quantity']
            tokens_per_item = menu_item.price
            price_inr = getattr(menu_item, 'price_inr', 0.00) or 0.00

            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                tokens_per_item=tokens_per_item,
                price_inr_per_item=price_inr,
                status='fulfilled'
            )
            total_tokens += tokens_per_item * quantity
            total_inr += float(price_inr) * quantity

        order.total_tokens = total_tokens
        order.total_amount_inr = total_inr
        order.save()

        return order


class ShiftTokenAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftTokenAllocation
        fields = ['id', 'shift', 'tokens_per_user', 'allocation_month']


class TokenDistributionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = TokenDistribution
        fields = ['id', 'user', 'user_username', 'tokens_allocated', 'allocation_month']


class PasswordResetRequestSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)
    reset_permission_granted = serializers.SerializerMethodField()

    class Meta:
        model = PasswordResetRequest
        fields = [
            'id', 'user', 'user_details', 'reason', 'status',
            'created_at', 'reviewed_at', 'reviewed_by_username', 'admin_notes',
            'reset_permission_granted', 'reset_completed_at'
        ]
        read_only_fields = ['status', 'created_at', 'reviewed_at', 'reviewed_by_username', 'admin_notes', 'reset_permission_granted', 'reset_completed_at']

    def get_user_details(self, obj):
        return {
            'username': obj.user.username,
            'name': obj.user.get_full_name() or obj.user.username,
            'email': obj.user.email,
            'role': obj.user.role,
            'work_shift': obj.user.work_shift,
            'user_id': obj.user.user_id,
        }

    def get_reset_permission_granted(self, obj):
        return bool(obj.user.password_reset_allowed)


class CanteenSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CanteenSetting
        fields = [
            'id', 
            'max_orders_per_user_per_day', 
            'max_qty_per_item_per_day', 
            'shift_reset_mode', 
            'monthly_token_allocation_mode',
            'day_shift_policy_quota',
            'mid_shift_policy_quota',
            'night_shift_policy_quota',
            'day_shift_daily_limit',
            'mid_shift_daily_limit',
            'night_shift_daily_limit',
            'token_allocation_day',
            'reminder_days_before_reset',
            'updated_at'
        ]


class TokenResetApprovalSerializer(serializers.ModelSerializer):
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)
    cycle_month_label = serializers.SerializerMethodField()
    reset_date_label = serializers.SerializerMethodField()

    class Meta:
        model = TokenResetApproval
        fields = [
            'id',
            'cycle_month',
            'cycle_month_label',
            'cycle_end',
            'reset_date',
            'reset_date_label',
            'status',
            'allocation_mode',
            'past_month_total_spent',
            'past_month_total_allocated',
            'past_month_total_unused',
            'proposed_tokens',
            'distributed_tokens',
            'affected_users_count',
            'shift_breakdown',
            'policy_snapshot',
            'draft_quotas',
            'approved_by',
            'approved_by_username',
            'approved_at',
            'allocated_at',
            'notes',
            'created_at',
            'updated_at'
        ]

    def get_cycle_month_label(self, obj):
        return obj.cycle_month.strftime('%B %Y') if obj.cycle_month else ''

    def get_reset_date_label(self, obj):
        return obj.reset_date.strftime('%d %b %Y') if obj.reset_date else ''


class TokenAllocationAuditLogSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True)

    class Meta:
        model = TokenAllocationAuditLog
        fields = [
            'id',
            'event_type',
            'billing_cycle_start',
            'billing_cycle_end',
            'performed_by',
            'performed_by_username',
            'details',
            'notes',
            'created_at',
        ]



class FinancialTransactionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_name = serializers.SerializerMethodField()
    user_id_code = serializers.CharField(source='user.user_id', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    amount_tokens = serializers.IntegerField(required=False)

    class Meta:
        model = FinancialTransaction
        fields = [
            'id', 'user', 'user_username', 'user_name', 'user_id_code',
            'transaction_type', 'amount_tokens', 'amount_inr', 'order', 'company_bill',
            'payment_method', 'payment_reference', 'notes',
            'created_by', 'created_by_username', 'created_at', 'reversal_of'
        ]
        read_only_fields = ['created_at', 'created_by']

    def validate(self, attrs):
        # Sync amount_tokens and amount_inr seamlessly
        if 'amount_tokens' in attrs and attrs['amount_tokens'] is not None:
            if not attrs.get('amount_inr'):
                attrs['amount_inr'] = Decimal(attrs['amount_tokens'])
        elif 'amount_inr' in attrs and attrs['amount_inr'] is not None:
            if not attrs.get('amount_tokens'):
                attrs['amount_tokens'] = int(attrs['amount_inr'])
        return attrs

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'Company / General'


class CompanyBillSerializer(serializers.ModelSerializer):
    generated_by_username = serializers.CharField(source='generated_by.username', read_only=True)

    class Meta:
        model = CompanyBill
        fields = [
            'id', 'bill_number', 'billing_period_start', 'billing_period_end',
            'total_orders_count', 'total_tokens_spent', 'total_tokens_billed',
            'total_tokens_settled', 'outstanding_tokens', 'total_amount_inr',
            'total_paid_inr', 'outstanding_inr', 'status',
            'generated_by', 'generated_by_username', 'generated_at', 'notes'
        ]
        read_only_fields = ['generated_at', 'generated_by']



