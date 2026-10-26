from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and (request.user.role == 'admin' or request.user.is_superuser))

class IsStaffAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and (request.user.role == 'staff_admin' or request.user.is_superuser))

class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and (request.user.role in ['staff', 'staff_admin'] or request.user.is_superuser))

class IsEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and request.user.role == 'employee')

class IsGuest(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and request.user.role == 'guest')

class IsStaffOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and (request.user.role in ['staff', 'staff_admin', 'admin'] or request.user.is_superuser))

class IsStaffAdminOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not getattr(request.user, 'is_deleted', False) and (request.user.role in ['staff_admin', 'admin'] or request.user.is_superuser))

    