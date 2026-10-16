from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, MenuItem, Order, OrderItem,
    ShiftTokenAllocation, TokenDistribution, PasswordResetRequest
)

# VDart Cafe Branding for Django Admin
admin.site.site_header = "VDart Cafe — Canteen Management System"
admin.site.site_title = "VDart Cafe Admin"
admin.site.index_title = "VDart Cafe Administration"

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'role', 'work_shift', 'monthly_tokens', 'last_token_reset']
    list_filter = ['role', 'is_active', 'is_staff', 'work_shift']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'user_id']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {'fields': ('role', 'work_shift', 'user_id', 'monthly_tokens', 'last_token_reset')}),
    )
    readonly_fields = ('last_token_reset',)

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'price','description', 'is_available', 'created_at']
    list_filter = ['is_available', 'created_at']
    search_fields = ['name', 'description']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'total_tokens', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'menu_item', 'quantity', 'tokens_per_item']


@admin.register(ShiftTokenAllocation)
class ShiftTokenAllocationAdmin(admin.ModelAdmin):
    list_display = ['shift', 'tokens_per_user', 'allocation_month']
    list_filter = ['shift', 'allocation_month']
    search_fields = []


@admin.register(TokenDistribution)
class TokenDistributionAdmin(admin.ModelAdmin):
    list_display = ['user', 'tokens_allocated', 'allocation_month']
    list_filter = ['allocation_month']
    search_fields = ['user__username']


@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'created_at', 'reviewed_at', 'reviewed_by']
    list_filter = ['status', 'created_at']
    search_fields = ['user__username', 'user__user_id', 'user__email']
    readonly_fields = ['created_at', 'reviewed_at']

