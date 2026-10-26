from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'admin/offices', views.OfficeViewSet, basename='admin-offices')
router.register(r'admin/kitchens', views.KitchenViewSet, basename='admin-kitchens')
router.register(r'admin/users', views.AdminUserViewSet, basename='admin-users')
router.register(r'staff/menu', views.StaffMenuViewSet, basename='staff-menu')
router.register(r'staff/orders', views.StaffOrderViewSet, basename='staff-orders')
router.register(r'admin/shift-allocations', views.ShiftTokenAllocationViewSet, basename='shift-allocations')
router.register(r'admin/token-distributions', views.TokenDistributionViewSet, basename='token-distributions')
router.register(r'admin/password-resets', views.AdminPasswordResetViewSet, basename='admin-password-resets')
router.register(r'finance/transactions', views.FinancialTransactionViewSet, basename='finance-transactions')
router.register(r'finance/company-bills', views.CompanyBillViewSet, basename='company-bills')


urlpatterns = [
    path('', include(router.urls)),

    # Auth endpoints
    path('csrf/', views.csrf_token_view, name='csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('update_password/', views.update_password_view, name='update_password'),
    path('password_reset/', views.reset_password_view, name='password_reset'),
    path('password_reset/request/', views.submit_password_reset_request, name='password_reset_request'),

    # Admin & Operational endpoints
    path('admin/dashboard/stats/', views.get_dashboard_stats, name='dashboard_stats'),
    path('admin/dashboard/orders/recent/', views.get_recent_orders, name='recent_orders'),
    path('admin/dashboard/revenue/', views.get_revenue_data, name='revenue_data'),
    path('admin/dashboard/cycle-revenue/', views.get_cycle_revenue_data, name='cycle_revenue_data'),
    path('staff-admin/dashboard/', views.staff_admin_dashboard_view, name='staff_admin_dashboard'),
    path('admin/settings/', views.canteen_settings_view, name='canteen_settings'),
    path('reports/audit-export/', views.audit_export_view, name='audit_export'),
    path('reports/monthly-report/', views.monthly_audit_report_view, name='monthly_audit_report'),
    
    # Token management
    path('admin/tokens/assign/', views.assign_tokens, name='assign_tokens'),
    path('admin/tokens/summary/', views.get_token_summary, name='token_summary'),
    path('admin/tokens/reset-approval-status/', views.get_token_reset_approval_status, name='token_reset_approval_status'),
    path('admin/tokens/approve-reset/', views.approve_token_reset, name='approve_token_reset'),
    path('admin/tokens/reject-reset/', views.reject_token_reset_view, name='reject_token_reset'),
    path('admin/tokens/mode/', views.set_token_allocation_mode_view, name='set_token_allocation_mode'),
    path('admin/tokens/history/', views.get_token_allocation_history_view, name='token_allocation_history'),
    path('admin/tokens/user-transactions/<int:user_id>/', views.get_user_token_transactions, name='user_token_transactions'),

    # Employee endpoints
    path('employee/menu/', views.employee_menu, name='employee_menu'),
    path('employee/order/', views.employee_place_order, name='employee_place_order'),
    path('employee/orders/', views.employee_orders, name='employee_orders'),
   
    # Guest endpoints
    path('guest/menu/', views.guest_menu, name='guest_menu'),
    path('guest/order/', views.guest_place_order, name='guest_order'),
    path('guest/orders/', views.guest_orders, name='guest_orders'),

    # Order Receipt & Cancellation endpoints
    path('orders/<int:order_id>/receipt/', views.get_order_receipt, name='order_receipt'),
    path('orders/<int:order_id>/cancel/', views.cancel_order_view, name='order_cancel'),
]

