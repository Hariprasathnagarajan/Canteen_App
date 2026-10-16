from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser, MenuItem, Order, OrderItem, ShiftTokenAllocation, TokenDistribution, PasswordResetRequest

class CustomUserCreateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=CustomUser.ROLE_CHOICES, default='employee')
    user_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'user_id', 'first_name', 'last_name', 'email', 'role', 'work_shift']

    def validate_username(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError('Username is required.')
        if CustomUser.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return val

    def validate_user_id(self, value):
        if not value or not str(value).strip():
            return None
        val = str(value).strip()
        if CustomUser.objects.filter(user_id__iexact=val).exists():
            raise serializers.ValidationError('A user with this User ID already exists.')
        return val

    def create(self, validated_data):
        user_id = validated_data.get('user_id')
        if not user_id:
            user_id = None
            validated_data['user_id'] = None

        role = validated_data.get('role', 'employee')
        user = CustomUser(**validated_data)

        initial_password = user_id if user_id else user.username
        user.set_password(initial_password)

        if user.role == 'employee':
            shift_limits = {'day': 50, 'mid': 75, 'night': 100}
            user.monthly_tokens = shift_limits.get(user.work_shift, 50)
            user.last_token_reset = timezone.now().date().replace(day=1)
        elif user.role == 'guest':
            user.monthly_tokens = 30
            user.last_token_reset = timezone.now().date().replace(day=1)
        elif user.role == 'staff':
            user.is_staff = True
            user.monthly_tokens = 0

        user.save()
        return user

class CustomUserSerializer(serializers.ModelSerializer):
    tokens = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    user_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'name', 'email', 'role', 'work_shift', 'user_id', 'tokens']
        extra_kwargs = {
            'tokens': {'read_only': True}
        }

    def validate_user_id(self, value):
        if not value or not str(value).strip():
            return None
        val = str(value).strip()
        user_pk = self.instance.pk if self.instance else None
        if CustomUser.objects.filter(user_id__iexact=val).exclude(pk=user_pk).exists():
            raise serializers.ValidationError('A user with this User ID already exists.')
        return val

    def get_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_tokens(self, obj):
        # Don't return tokens for admin and staff users
        if obj.role in ['admin', 'staff']:
            return None
        return obj.current_tokens()

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
            return attrs
        raise serializers.ValidationError('Must include username and password')

class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = '__all__'

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item = MenuItemSerializer(read_only=True)
    menu_item_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_id', 'quantity', 'tokens_per_item']

class OrderSerializer(serializers.ModelSerializer):
    order_items = OrderItemSerializer(many=True, read_only=True)
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    user_details = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'user', 'user_details', 'status', 'total_tokens', 'tokens_refunded', 'created_at', 'updated_at', 'order_items', 'items']
        read_only_fields = ['user', 'total_tokens', 'tokens_refunded']

    def get_user_details(self, obj):
        return {
            'username': obj.user.username,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'user_id': obj.user.user_id
        }

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user

        order = Order.objects.create(user=user, **validated_data)
        total_tokens = 0

        for item_data in items_data:
            menu_item = MenuItem.objects.get(id=item_data['menu_item_id'])
            quantity = item_data['quantity']
            tokens_per_item = menu_item.price

            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                tokens_per_item=tokens_per_item
            )
            total_tokens += tokens_per_item * quantity

        order.total_tokens = total_tokens
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

    class Meta:
        model = PasswordResetRequest
        fields = [
            'id', 'user', 'user_details', 'reason', 'status',
            'created_at', 'reviewed_at', 'reviewed_by_username', 'admin_notes'
        ]
        read_only_fields = ['status', 'created_at', 'reviewed_at', 'reviewed_by_username', 'admin_notes']

    def get_user_details(self, obj):
        return {
            'username': obj.user.username,
            'name': obj.user.get_full_name() or obj.user.username,
            'email': obj.user.email,
            'role': obj.user.role,
            'work_shift': obj.user.work_shift,
            'user_id': obj.user.user_id,
        }


