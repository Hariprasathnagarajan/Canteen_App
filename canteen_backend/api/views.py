import csv
import io
import json
import os
import re
from datetime import timedelta, date, datetime, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo
from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q, Count, Sum, F, IntegerField, ExpressionWrapper
from django.utils import timezone
from django.contrib.auth import login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action, renderer_classes, throttle_classes
from rest_framework.renderers import JSONRenderer, BaseRenderer
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied


class AuthAttemptThrottle(AnonRateThrottle):
    scope = 'auth_attempt'


def run_in_thread(func, *args, **kwargs):
    """
    Executes a callable in a worker thread and guarantees thread-local Django database
    connections are closed upon completion to prevent connection leaks.
    """
    def wrapper():
        try:
            return func(*args, **kwargs)
        finally:
            connection.close()
    return wrapper


class CSVExportRenderer(BaseRenderer):
    media_type = 'text/csv'
    format = 'csv'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class XLSXExportRenderer(BaseRenderer):
    media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    format = 'xlsx'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class PDFExportRenderer(BaseRenderer):
    media_type = 'application/pdf'
    format = 'pdf'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


from django.shortcuts import get_object_or_404
from .permissions import IsAdmin, IsStaffOrAdmin, IsEmployee, IsGuest, IsStaffAdmin, IsStaffAdminOrAdmin
from .models import (
    Office, Kitchen,
    CustomUser, MenuItem, Order, OrderItem, ShiftTokenAllocation, TokenDistribution,
    PasswordResetRequest, CanteenSetting, CompanyBill, FinancialTransaction, TokenResetApproval,
    TokenAllocationAuditLog, default_password_for
)
from .serializers import (
    OfficeSerializer, KitchenSerializer,
    CustomUserSerializer, CustomUserCreateSerializer, LoginSerializer,
    MenuItemSerializer, OrderSerializer, ShiftTokenAllocationSerializer, TokenDistributionSerializer,
    PasswordResetRequestSerializer, CanteenSettingSerializer, FinancialTransactionSerializer,
    CompanyBillSerializer, TokenResetApprovalSerializer, TokenAllocationAuditLogSerializer
)


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        qs = Office.objects.all()
        active_only = self.request.query_params.get('active')
        if active_only is not None and str(active_only).lower() in ['true', '1']:
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        if hasattr(instance, 'kitchen'):
            instance.kitchen.is_active = False
            instance.kitchen.save(update_fields=['is_active'])


class KitchenViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Kitchen.objects.select_related('office').all()
    serializer_class = KitchenSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        qs = Kitchen.objects.select_related('office').all()
        active_only = self.request.query_params.get('active')
        if active_only is not None and str(active_only).lower() in ['true', '1']:
            qs = qs.filter(is_active=True)
        return qs

from .token_service import (
    ensure_user_monthly_tokens,
    get_user_token_metrics,
    get_current_cycle_start,
    get_shift_monthly_quota,
    get_billing_cycle_dates,
    get_past_cycle_token_metrics,
    get_token_reset_status_and_reminder,
    distribute_approved_monthly_tokens,
    reject_token_reset,
    get_monthly_allocation_history,
    get_allocation_proposal
)




# ---------------------------------------------------------------------------
# Bulk import helpers — accept CSV, JSON or Excel (.xlsx) file uploads,
# pasted text, or a plain JSON array so admins can load data in any format.
# ---------------------------------------------------------------------------
def _normalize_key(value):
    return str(value or '').strip().lstrip('\ufeff').lower().replace('-', '_').replace(' ', '_')


def _default_password_label(user):
    """Human-readable name of the credential used as a user's default password."""
    return 'Employee ID' if (user.user_id or '').strip() else 'username'


def _row_lookup(row, *aliases):
    for alias in aliases:
        value = row.get(alias)
        if value is not None and str(value).strip() != '':
            return value
    return None


def _rows_from_json_text(text):
    data = json.loads(text)
    if isinstance(data, dict):
        data = data.get('users') or data.get('items') or data.get('data') or []
    if not isinstance(data, list):
        raise ValueError('JSON payload must be a list of objects.')
    return [
        {_normalize_key(k): v for k, v in row.items()}
        for row in data if isinstance(row, dict)
    ]


def _sniff_delimiter(text):
    sample = '\n'.join(line for line in text.splitlines() if line.strip())[:2048]
    if not sample:
        return ','
    try:
        return csv.Sniffer().sniff(sample, delimiters=',;\t|').delimiter
    except csv.Error:
        return ','


def _looks_like_console_dump(text):
    return 'disabled:' in text and ('name:' in text or 'price:' in text)


def _rows_from_console_dump(text):
    """Parse a JS-style console menu dump into import rows.

    Mirrors the token convention used by the TXT confirm-import view: use the
    parsed token value when present, otherwise default new items to 10 tokens.
    """
    rows = []
    for item in _parse_foodmenu_txt(text):
        name = str(item.get('name') or '').strip()
        if not name:
            continue
        price = item.get('tokens') or item.get('price')
        if not price:
            price = 10
        rows.append({
            'name': name,
            'price': price,
            'description': item.get('description', ''),
            'category': item.get('category', 'meal'),
            'is_available': item.get('is_available', True),
        })
    return rows


def _rows_from_csv_text(text):
    delimiter = _sniff_delimiter(text)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [
        {_normalize_key(k): v for k, v in row.items() if k is not None}
        for row in reader
        if any(v is not None and str(v).strip() != '' for v in row.values())
    ]


def _is_header_row(row):
    """A header row carries a recognizable menu or user column set."""
    keys = {_normalize_key(c) for c in row if c is not None and str(c).strip() != ''}

    # Menu headers: a name-ish column plus a price-ish column.
    menu_name = {'name', 'item', 'item_name', 'dish'}
    menu_price = {'price', 'tokens', 'cost', 'price_tokens', 'price_inr'}
    if keys & menu_name and keys & menu_price:
        return True

    # User headers: a username-ish column, optionally with role/email/shift.
    user_name = {'username', 'user_name', 'user', 'login', 'employee_id', 'emp_id'}
    user_extra = {'role', 'user_role', 'email', 'first_name', 'last_name', 'work_shift', 'shift'}
    return bool(keys & user_name) and bool(keys & (menu_price | user_extra))


def _rows_from_matrix(matrix):
    """Turn a list of rows (lists/tuples) into dict rows, auto-detecting the header."""
    cleaned = [
        row for row in matrix
        if any(cell is not None and str(cell).strip() != '' for cell in row)
    ]
    if not cleaned:
        return []

    header_index = None
    for index, row in enumerate(cleaned[:15]):
        if _is_header_row(row):
            header_index = index
            break

    if header_index is None:
        # No recognizable header; assume the first row is the header.
        header_index = 0

    headers = [
        _normalize_key(cell) if cell is not None and str(cell).strip() != '' else f'column_{i}'
        for i, cell in enumerate(cleaned[header_index])
    ]
    return [
        dict(zip(headers, row))
        for row in cleaned[header_index + 1:]
    ]


def _xlsx_rows(raw):
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise ValueError('Excel support is not available on the server. Upload CSV or JSON instead.')

    workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    best = []
    # Prefer the first sheet that produces usable rows (data may not be on the active tab).
    for sheet in workbook.worksheets:
        rows = _rows_from_matrix([list(r) for r in sheet.iter_rows(values_only=True)])
        if rows:
            return rows
        if not best:
            best = rows
    return best


def _rows_from_uploaded_file(uploaded):
    name = str(uploaded.name or '').lower()
    raw = uploaded.read()

    if name.endswith('.xlsx'):
        return _xlsx_rows(raw)

    if name.endswith('.xls'):
        raise ValueError('Legacy .xls files are not supported. Save the sheet as .xlsx or CSV and try again.')

    text = raw.decode('utf-8-sig', errors='replace')
    if name.endswith('.json'):
        return _rows_from_json_text(text)
    return _rows_from_csv_text(text)


def _extract_bulk_rows(request, list_keys):
    """Extract tabular rows from a multipart file, pasted text, or JSON body."""
    upload = request.FILES.get('file')
    if upload:
        return _rows_from_uploaded_file(upload)

    payload = request.data

    if isinstance(payload, list):
        return [
            {_normalize_key(k): v for k, v in row.items()}
            for row in payload if isinstance(row, dict)
        ]

    if isinstance(payload, dict):
        text = payload.get('text')
        if text and str(text).strip():
            text_str = str(text).strip()
            fmt = str(payload.get('format') or '').strip().lower()
            if fmt == 'json':
                return _rows_from_json_text(text_str)
            if text_str[:1] in ('[', '{'):
                # Looks like JSON — try it, but fall back to the console-dump
                # parser and then CSV so JS-style dumps don't hard-fail.
                try:
                    return _rows_from_json_text(text_str)
                except (ValueError, json.JSONDecodeError):
                    pass
                if _looks_like_console_dump(text_str):
                    return _rows_from_console_dump(text_str)
            return _rows_from_csv_text(text_str)

        for key in list_keys:
            data = payload.get(key)
            if isinstance(data, list):
                return [
                    {_normalize_key(k): v for k, v in row.items()}
                    for row in data if isinstance(row, dict)
                ]
    return []


def _parse_boolish(value, default=True):
    if value is None or str(value).strip() == '':
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ['true', '1', 'yes', 'y', 'available', 'active']


# CSRF token view
@api_view(['GET'])
@ensure_csrf_cookie
@permission_classes([AllowAny])
def csrf_token_view(request):
    # Ensure and retrieve fresh CSRF token
    csrf_token = get_token(request) or request.META.get('CSRF_COOKIE', '')
    
    # Create the response (corsheaders middleware automatically manages Access-Control headers)
    response = Response({
        'message': 'CSRF cookie set',
        'csrftoken': csrf_token
    })
    
    # Note: @ensure_csrf_cookie already sets the CSRF cookie using
    # settings.CSRF_COOKIE_NAME (namespaced), so no manual set_cookie here.
    return response


# Login view
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAttemptThrottle])
@ensure_csrf_cookie
def login_view(request):
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)
        
    serializer = LoginSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    login(request, user)
    
    # Set session to expire when browser is closed unless remember_me is explicitly truthy
    remember_me = request.data.get('remember_me')
    is_remember = remember_me in [True, 'true', 'True', 1, '1']
    if not is_remember:
        request.session.set_expiry(0)
    response = Response({
        'id': user.id,

        'email': user.email,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'work_shift': user.work_shift,
        'user_id': user.user_id,
        'tokens': user.current_tokens() if user.role not in ['admin', 'staff', 'staff_admin'] else 0,
        'monthly_tokens': user.monthly_tokens,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    })
    
    # Set session cookie (namespaced name; SessionMiddleware also sets this on login())
    # Adaptive cookie security: when running over HTTP (local dev), secure=False and samesite='Lax'
    # When running over HTTPS (production cross-site Netlify <-> Render), secure=True and samesite='None'
    is_secure_conn = request.is_secure() or (getattr(settings, 'IS_PRODUCTION', False) and not settings.DEBUG)
    samesite_mode = 'None' if is_secure_conn else 'Lax'
    cookie_kwargs = {
        'key': settings.SESSION_COOKIE_NAME,
        'value': request.session.session_key,
        'path': '/',
        'httponly': True,
        'samesite': samesite_mode,
        'secure': is_secure_conn,
    }
    if is_remember:
        cookie_kwargs['max_age'] = 1209600  # 2 weeks
    response.set_cookie(**cookie_kwargs)
    return response


# Logout view
@api_view(['POST', 'OPTIONS'])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie
def logout_view(request):
    # Handle OPTIONS preflight request
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)
    
    # Get session key before logging out
    session_key = request.session.session_key
    
    # Logout the user
    logout(request)
    
    # Delete the session from the database
    if session_key:
        from django.contrib.sessions.models import Session
        try:
            Session.objects.get(session_key=session_key).delete()
        except (Session.DoesNotExist, AttributeError):
            pass
    
    # Create response (corsheaders middleware manages Access-Control headers)
    response = Response({'message': 'Logout successful'}, status=200)
    response['Vary'] = 'Origin, Cookie'
    response['Content-Type'] = 'application/json'
    
    # Delete the session cookie
    response.delete_cookie(
        settings.SESSION_COOKIE_NAME,
        path='/',
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    
    # Set an expired CSRF cookie to clear it
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        '',
        max_age=0,
        path='/',
        domain=settings.CSRF_COOKIE_DOMAIN or None,
        secure=settings.CSRF_COOKIE_SECURE,
        httponly=False,
        samesite=settings.CSRF_COOKIE_SAMESITE
    )
    
    # Also clear any other auth-related cookies
    response.delete_cookie(
        'auth_token',
        path='/',
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    
    return response


# Profile view
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    if ensure_user_monthly_tokens(request.user):
        request.user.refresh_from_db()
    serializer = CustomUserSerializer(request.user)
    return Response(serializer.data)


# Admin user management
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.filter(is_deleted=False).exclude(role='admin')
    permission_classes = [IsStaffAdminOrAdmin]

    def get_queryset(self):
        user = self.request.user
        include_deleted = self.request.query_params.get('status') == 'deleted'
        qs = CustomUser.objects.filter(is_deleted=include_deleted).select_related('office', 'assigned_kitchen')

        if user.role == 'staff_admin':
            # Staff Admins can ONLY see staff crew assigned to their kitchen/office
            # They CANNOT view other staff admins, staff of other kitchens, or general users
            kitchen = user.get_kitchen()
            qs = qs.filter(role='staff')
            if kitchen:
                qs = qs.filter(Q(assigned_kitchen=kitchen) | Q(office=kitchen.office))
            else:
                qs = qs.none()
            return qs

        # Global Admin: exclude superusers/admin from list
        qs = qs.exclude(role='admin')

        # Filter by category if supplied (staff_admin | staff_crew | users)
        category = self.request.query_params.get('category')
        if category == 'staff_admin':
            qs = qs.filter(role='staff_admin')
        elif category in ['staff_crew', 'staff']:
            qs = qs.filter(role='staff')
        elif category == 'users':
            qs = qs.filter(role__in=['employee', 'guest'])
        elif category and category != 'all':
            qs = qs.filter(role=category)

        # Filter by specific role if provided
        role_param = self.request.query_params.get('role')
        if role_param and role_param != 'all':
            qs = qs.filter(role=role_param)

        # Filter by office
        office_id = self.request.query_params.get('office') or self.request.query_params.get('office_id')
        if office_id and office_id != 'all':
            qs = qs.filter(office_id=office_id)

        # Filter by kitchen
        kitchen_id = self.request.query_params.get('kitchen') or self.request.query_params.get('kitchen_id')
        if kitchen_id and kitchen_id != 'all':
            qs = qs.filter(Q(assigned_kitchen_id=kitchen_id) | Q(office__kitchen__id=kitchen_id))

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return CustomUserCreateSerializer
        return CustomUserSerializer

    def create(self, request, *args, **kwargs):
        # Staff admin can only create staff users and they are pinned to their own kitchen & office
        if request.user.role == 'staff_admin':
            role = request.data.get('role', 'staff')
            if role != 'staff':
                return Response(
                    {'error': 'Staff Admins are only permitted to manage staff accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            kitchen = request.user.get_kitchen()
            data = request.data.copy()
            data['role'] = 'staff'
            if kitchen:
                data['assigned_kitchen'] = kitchen.id
                if kitchen.office:
                    data['office'] = kitchen.office.id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(CustomUserSerializer(user).data, status=status.HTTP_201_CREATED)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Tokens are managed through the monthly_tokens field in CustomUser model
        output_serializer = CustomUserSerializer(user)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role == 'staff_admin':
            if instance.role != 'staff' or request.data.get('role', 'staff') != 'staff':
                return Response(
                    {'error': 'Staff Admins can only update staff accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            kitchen = request.user.get_kitchen()
            if kitchen and instance.assigned_kitchen != kitchen and instance.office != kitchen.office:
                return Response(
                    {'error': 'Staff Admins cannot manage staff of another office/kitchen.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            data = request.data.copy()
            data['role'] = 'staff'
            if kitchen:
                data['assigned_kitchen'] = kitchen.id
                if kitchen.office:
                    data['office'] = kitchen.office.id
            serializer = self.get_serializer(instance, data=data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(CustomUserSerializer(user).data)
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if self.request.user.role == 'staff_admin':
            if instance.role != 'staff':
                raise PermissionDenied('Staff Admins can only delete staff accounts.')
            kitchen = self.request.user.get_kitchen()
            if kitchen and instance.assigned_kitchen != kitchen and instance.office != kitchen.office:
                raise PermissionDenied('Staff Admins cannot delete staff of another office/kitchen.')
        # Non-destructive soft-delete
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.is_active = False
        instance.save(update_fields=['is_deleted', 'deleted_at', 'is_active'])

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        try:
            target_user = CustomUser.objects.get(pk=pk, is_deleted=True)
        except CustomUser.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'staff_admin':
            if target_user.role != 'staff':
                return Response(
                    {'error': 'Staff Admins are only permitted to restore staff accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            kitchen = request.user.get_kitchen()
            if kitchen and target_user.assigned_kitchen != kitchen and target_user.office != kitchen.office:
                return Response(
                    {'error': 'Staff Admins cannot restore staff of another office/kitchen.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        target_user.is_deleted = False
        target_user.deleted_at = None
        target_user.is_active = True
        target_user.save(update_fields=['is_deleted', 'deleted_at', 'is_active'])

        return Response(CustomUserSerializer(target_user).data)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """
        Authorise the target user to set their own password.

        The admin never sets, generates or sees a password: the target receives
        a single-use permission and chooses the password themselves from the
        public reset page.
        """
        try:
            target_user = CustomUser.objects.get(pk=pk, is_deleted=False)
        except CustomUser.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'staff_admin':
            if target_user.role != 'staff':
                return Response(
                    {'error': 'Staff Admins are only permitted to reset passwords for staff accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            kitchen = request.user.get_kitchen()
            if kitchen and target_user.assigned_kitchen != kitchen and target_user.office != kitchen.office:
                return Response(
                    {'error': 'Staff Admins cannot reset passwords for staff of another office/kitchen.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if target_user.is_superuser and not request.user.is_superuser:
            return Response({'error': "Only superusers can reset another superuser's password."}, status=status.HTTP_403_FORBIDDEN)

        target_user.grant_password_reset_permission()
        return Response({
            'status': 'success',
            'message': f'{target_user.username} can now set a new password from the reset page. The permission is single-use.'
        })

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        try:
            rows = _extract_bulk_rows(request, ['users'])
        except (ValueError, json.JSONDecodeError) as exc:
            return Response({'error': f'Could not parse the uploaded data: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            upload = request.FILES.get('file')
            received = []
            if upload is not None:
                received.append(f"file '{upload.name}' ({upload.size} bytes)")
            if isinstance(request.data, dict) and str(request.data.get('text') or '').strip():
                received.append(f"{len(str(request.data.get('text')))} chars of pasted text")
            detail = ', '.join(received) if received else 'no file and no pasted text'
            return Response(
                {'error': (
                    'No user rows found. '
                    f'The server received {detail}. '
                    'If you uploaded a file, make sure it has a header row with at least a "username" '
                    'column, and that the data is on the first non-empty sheet.'
                )},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Staff admin isolation: strictly prohibited from bulk-importing non-staff accounts
        if request.user.role == 'staff_admin':
            for index, row in enumerate(rows, start=1):
                role = str(_row_lookup(row, 'role', 'user_role') or 'employee').strip().lower()
                if role != 'staff':
                    return Response(
                        {'error': f'Row {index}: Staff Admins are strictly prohibited from importing non-staff accounts (found role "{role}").'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        created_count = 0
        updated_count = 0
        errors = []

        # Multi-threaded validation and persistence across rows
        def _process_user_row(item):
            index, row = item
            try:
                username = str(_row_lookup(row, 'username', 'user_name', 'login') or '').strip()
                if not username:
                    return {'error': f'Row {index}: username is required.'}

                role = str(_row_lookup(row, 'role', 'user_role') or 'employee').strip().lower()
                if role not in ['employee', 'guest', 'staff']:
                    return {'error': f'Row {index}: role must be employee, guest or staff.'}

                work_shift = str(_row_lookup(row, 'work_shift', 'shift') or 'day').strip().lower()
                work_shift = work_shift.replace(' shift', '').replace('_shift', '').strip()
                if work_shift not in ['day', 'mid', 'night']:
                    return {'error': f'Row {index}: work_shift must be day, mid or night.'}

                user_id_raw = _row_lookup(row, 'user_id', 'userid', 'employee_id', 'emp_id', 'employee_code')
                user_id = str(user_id_raw).strip() if user_id_raw is not None else None

                email = str(_row_lookup(row, 'email', 'mail', 'email_address') or '').strip()
                first_name = str(_row_lookup(row, 'first_name', 'firstname', 'given_name') or '').strip()
                last_name = str(_row_lookup(row, 'last_name', 'lastname', 'surname') or '').strip()

                tokens_raw = _row_lookup(row, 'monthly_tokens', 'tokens', 'token', 'token_balance')
                tokens = None
                if tokens_raw is not None:
                    try:
                        tokens = int(float(str(tokens_raw).strip()))
                        if tokens < 0:
                            raise ValueError
                    except (ValueError, TypeError):
                        return {'error': f'Row {index}: tokens must be a non-negative number.'}

                if user_id and CustomUser.objects.filter(user_id__iexact=user_id).exclude(username__iexact=username).exists():
                    return {'error': f'Row {index}: User ID "{user_id}" is already assigned to another user.'}

                existing = CustomUser.objects.filter(username__iexact=username).first()
                if existing:
                    if request.user.role == 'staff_admin':
                        staff_kitchen = request.user.get_kitchen()
                        if staff_kitchen and existing.assigned_kitchen != staff_kitchen and existing.office != staff_kitchen.office:
                            return {'error': f'Row {index}: Staff Admins cannot modify staff outside their assigned kitchen.'}
                    if user_id:
                        existing.user_id = user_id
                    existing.email = email
                    existing.first_name = first_name
                    existing.last_name = last_name
                    existing.role = role
                    existing.work_shift = work_shift
                    existing.is_staff = role == 'staff' or existing.is_staff
                    if tokens is not None:
                        existing.monthly_tokens = tokens
                    existing.save()
                    return {'updated': True}
                else:
                    password_raw = _row_lookup(row, 'password', 'initial_password')
                    password = str(password_raw).strip() if password_raw is not None else ''
                    user = CustomUser(
                        username=username,
                        user_id=user_id,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        role=role,
                        work_shift=work_shift,
                        monthly_tokens=tokens if tokens is not None else 0,
                        last_token_reset=timezone.now().date().replace(day=1),
                    )
                    if request.user.role == 'staff_admin':
                        staff_kitchen = request.user.get_kitchen()
                        if staff_kitchen:
                            user.assigned_kitchen = staff_kitchen
                            if staff_kitchen.office:
                                user.office = staff_kitchen.office
                    user.set_password(password or default_password_for(user))
                    if role == 'staff':
                        user.is_staff = True
                    user.save()
                    return {'created': True}
            except Exception as exc:
                return {'error': f'Row {index}: {exc}'}
            finally:
                if not connection.in_atomic_block:
                    connection.close()

        if connection.in_atomic_block or len(rows) <= 1:
            row_results = [_process_user_row(item) for item in enumerate(rows, start=1)]
        else:
            workers = min(8, max(2, (os.cpu_count() or 4)))
            with ThreadPoolExecutor(max_workers=workers) as executor:
                row_results = list(executor.map(_process_user_row, enumerate(rows, start=1)))

        for res in row_results:
            if 'error' in res:
                errors.append(res['error'])
            elif res.get('created'):
                created_count += 1
            elif res.get('updated'):
                updated_count += 1

        return Response({
            'status': 'success',
            'created': created_count,
            'updated': updated_count,
            'total': len(rows),
            'errors': errors,
            'message': f'Imported {created_count} new and updated {updated_count} existing users.'
        })


# Helper for parsing foodmenu.txt DevTools format
def _parse_foodmenu_txt(text):
    lines = [l.strip() for l in text.splitlines()]
    blocks = []
    i = 0
    while i < len(lines):
        if lines[i] and i + 2 < len(lines) and lines[i+1] == ':':
            blocks.append((lines[i], lines[i+2]))
            i += 3
        else:
            i += 1

    items = []
    seen_names = set()

    for title, content in blocks:
        name_m = re.search(r'name:\s*"([^"]+)"', content)
        price_m = re.search(r'price:\s*"([^"]+)"', content)
        type_m = re.search(r'type:\s*"([^"]+)"', content)
        disabled_m = re.search(r'disabled:\s*(true|false)', content)

        if not name_m:
            continue

        name = name_m.group(1).strip()
        if name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        is_available = (disabled_m.group(1).lower() != 'true') if disabled_m else True

        if price_m:
            try:
                price_inr = float(price_m.group(1).replace(',', '').strip())
            except (ValueError, TypeError):
                price_inr = 10.0
        else:
            price_inr = 10.0

        existing = MenuItem.objects.filter(name__iexact=name, is_deleted=False).first()
        tokens = existing.price if existing else None

        type_lower = type_m.group(1).lower().strip() if type_m else 'veg'
        name_lower = name.lower()

        # Parse veg vs non-veg
        is_veg = True
        food_type = 'veg'
        if any(w in type_lower for w in ['non-veg', 'nonveg', 'non_veg']):
            is_veg = False
            food_type = 'non_veg'
        elif 'veg' in type_lower:
            is_veg = True
            food_type = 'veg'
        elif any(w in name_lower for w in ['chicken', 'mutton', 'fish', 'egg', 'prawn', 'meat', 'beef', 'pork', 'crab', 'omlette', 'omelette']):
            is_veg = False
            food_type = 'non_veg'

        # Parse category
        if any(w in type_lower for w in ['juice', 'tea', 'coffee', 'beverage', 'drink', 'milk', 'shake', 'soda', 'water']):
            category = 'beverage'
        elif any(w in name_lower for w in ['juice', 'tea', 'coffee', 'milk', 'shake', 'water', 'coke', 'sprite', 'drinks', 'soda', 'lassi', 'sarbath']):
            category = 'beverage'
        elif any(w in type_lower for w in ['snack', 'dessert', 'chaat', 'sweet', 'bakery', 'biscuit']):
            category = 'snack'
        elif any(w in name_lower for w in ['samosa', 'vada', 'vadai', 'snack', 'puff', 'bonda', 'biscuit', 'cutlet', 'pakoda', 'paniyaram', 'fries', 'chaat', 'chat', 'poori', 'maggi', 'sandwich', 'corn', 'halwa', 'toast', 'lapa', 'mass', 'baji', 'curry']):
            category = 'snack'
        else:
            category = 'meal'

        items.append({
            'name': name,
            'price_inr': price_inr,
            'tokens': tokens,
            'price': tokens,
            'category': category,
            'is_veg': is_veg,
            'food_type': food_type,
            'is_available': is_available
        })

    # Fallback to regex if 3-line block structure wasn't present
    if not items:
        pattern = re.compile(
            r'\{[^{}]*?disabled:\s*(true|false)[^{}]*?name:\s*"([^"]+)"[^{}]*?price:\s*"([^"]+)"(?:[^{}]*?type:\s*"([^"]+)")?[^{}]*?\}',
            re.DOTALL
        )
        for match in pattern.finditer(text):
            disabled_str, name, price_str, type_str = match.groups()
            name = name.strip()
            if name.lower() in seen_names:
                continue
            seen_names.add(name.lower())
            is_available = (disabled_str.lower() != 'true')
            try:
                price_inr = float(price_str.replace(',', '').strip())
            except (ValueError, TypeError):
                price_inr = 10.0

            existing = MenuItem.objects.filter(name__iexact=name, is_deleted=False).first()
            tokens = existing.price if existing else None

            type_lower = (type_str or 'veg').lower().strip()
            name_lower = name.lower()

            is_veg = True
            food_type = 'veg'
            if any(w in type_lower for w in ['non-veg', 'nonveg', 'non_veg']):
                is_veg = False
                food_type = 'non_veg'
            elif any(w in name_lower for w in ['chicken', 'mutton', 'fish', 'egg', 'prawn', 'meat', 'beef', 'pork', 'crab', 'omlette', 'omelette']):
                is_veg = False
                food_type = 'non_veg'

            if any(w in type_lower for w in ['juice', 'tea', 'coffee', 'beverage', 'drink', 'milk', 'shake', 'soda', 'water']) or any(w in name_lower for w in ['juice', 'tea', 'coffee', 'milk', 'shake', 'water', 'coke', 'sprite']):
                category = 'beverage'
            elif any(w in type_lower for w in ['snack', 'dessert', 'chaat', 'sweet']) or any(w in name_lower for w in ['samosa', 'vada', 'snack', 'puff', 'bonda']):
                category = 'snack'
            else:
                category = 'meal'

            items.append({
                'name': name,
                'price_inr': price_inr,
                'tokens': tokens,
                'price': tokens,
                'category': category,
                'is_veg': is_veg,
                'food_type': food_type,
                'is_available': is_available
            })
    return items


# Staff: Menu management
class StaffMenuViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.filter(is_deleted=False)
    serializer_class = MenuItemSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = MenuItem.objects.filter(is_deleted=False)
        kitchen_id = self.request.query_params.get('kitchen_id')
        if kitchen_id:
            qs = qs.filter(kitchen_id=kitchen_id)
        elif user.is_authenticated and user.role in ['staff', 'staff_admin']:
            k = user.get_kitchen()
            if k:
                qs = qs.filter(kitchen=k)

        food_type = self.request.query_params.get('food_type')
        if food_type in ['veg', 'non_veg']:
            qs = qs.filter(food_type=food_type)
        is_veg = self.request.query_params.get('is_veg')
        if is_veg is not None:
            if str(is_veg).lower() in ['true', '1']:
                qs = qs.filter(is_veg=True)
            elif str(is_veg).lower() in ['false', '0']:
                qs = qs.filter(is_veg=False)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        kitchen = user.get_kitchen()
        serializer.save(kitchen=kitchen)

    def perform_destroy(self, instance):
        # Non-destructive soft-delete
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.is_available = False
        instance.save(update_fields=['is_deleted', 'deleted_at', 'is_available'])

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        try:
            rows = _extract_bulk_rows(request, ['items', 'menu', 'menu_items'])
        except (ValueError, json.JSONDecodeError) as exc:
            return Response({'error': f'Could not parse the uploaded data: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            upload = request.FILES.get('file')
            received = []
            if upload is not None:
                received.append(f"file '{upload.name}' ({upload.size} bytes)")
            if isinstance(request.data, dict) and str(request.data.get('text') or '').strip():
                received.append(f"{len(str(request.data.get('text')))} chars of pasted text")
            detail = ', '.join(received) if received else 'no file and no pasted text'
            return Response(
                {'error': (
                    'No menu rows found. '
                    f'The server received {detail}. '
                    'If you uploaded a file, make sure it has a header row with at least a "name" '
                    'and a "price" column, and that the menu data is on the first non-empty sheet.'
                )},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_kitchen = request.user.get_kitchen()
        created_count = 0
        updated_count = 0
        errors = []

        for index, row in enumerate(rows, start=1):
            try:
                name = str(_row_lookup(row, 'name', 'item', 'item_name', 'dish') or '').strip()
                if not name:
                    errors.append(f'Row {index}: item name is required.')
                    continue

                price_raw = _row_lookup(row, 'price', 'tokens', 'cost', 'price_tokens')
                if price_raw is None:
                    errors.append(f'Row {index}: price (tokens) is required.')
                    continue
                try:
                    price = int(float(str(price_raw).strip()))
                    if price < 1:
                        raise ValueError
                except (ValueError, TypeError):
                    errors.append(f'Row {index}: price must be a positive whole number of tokens.')
                    continue

                description = str(_row_lookup(row, 'description', 'details', 'notes') or '').strip()
                category_raw = str(_row_lookup(row, 'category', 'type') or '').strip().lower()
                category = category_raw if category_raw in ['meal', 'snack', 'beverage'] else None
                is_available = _parse_boolish(_row_lookup(row, 'is_available', 'available', 'status'), default=True)

                existing = MenuItem.objects.filter(name__iexact=name, kitchen=user_kitchen).first()
                if existing:
                    existing.price = price
                    existing.description = description
                    existing.is_available = is_available
                    existing.is_deleted = False
                    if category:
                        existing.category = category
                    existing.save()
                    updated_count += 1
                else:
                    item = MenuItem(
                        name=name,
                        kitchen=user_kitchen,
                        price=price,
                        description=description,
                        is_available=is_available,
                        category=category or 'meal',
                    )
                    item.save()
                    created_count += 1
            except Exception as exc:
                errors.append(f'Row {index}: {exc}')

        return Response({
            'status': 'success',
            'created': created_count,
            'updated': updated_count,
            'total': len(rows),
            'errors': errors,
            'message': f'Imported {created_count} new and updated {updated_count} existing menu items.'
        })

    @action(detail=False, methods=['post'], url_path='preview-txt-import')
    def preview_txt_import(self, request):
        upload = request.FILES.get('file')
        if upload:
            content = upload.read().decode('utf-8', errors='replace')
        else:
            content = request.data.get('text') or request.data.get('content') or ''

        if not content.strip():
            return Response({'error': 'No content provided for TXT import preview.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_items = _parse_foodmenu_txt(content)
        if not parsed_items:
            return Response({'error': 'No valid menu items could be parsed from the provided text.'}, status=status.HTTP_400_BAD_REQUEST)

        user_kitchen = request.user.get_kitchen()
        preview_list = []
        new_count = 0
        update_count = 0

        for item in parsed_items:
            existing = MenuItem.objects.filter(name__iexact=item['name'], kitchen=user_kitchen).first()
            if existing:
                update_count += 1
                action_type = 'update'
                existing_info = {
                    'existing_id': existing.id,
                    'current_price_tokens': existing.price,
                    'current_price_inr': float(existing.price_inr or 0.0),
                    'current_available': existing.is_available
                }
            else:
                new_count += 1
                action_type = 'create'
                existing_info = None

            preview_list.append({
                **item,
                'action': action_type,
                'existing_details': existing_info
            })

        return Response({
            'total_parsed': len(parsed_items),
            'new_items': new_count,
            'updating_items': update_count,
            'items': preview_list
        })

    @action(detail=False, methods=['post'], url_path='confirm-txt-import')
    def confirm_txt_import(self, request):
        items_payload = request.data.get('items')
        remove_existing = bool(request.data.get('remove_existing', False))

        if not items_payload:
            # Check if file or text was sent directly
            upload = request.FILES.get('file')
            if upload:
                content = upload.read().decode('utf-8', errors='replace')
            else:
                content = request.data.get('text') or request.data.get('content') or ''
            if content:
                items_payload = _parse_foodmenu_txt(content)

        if not items_payload or not isinstance(items_payload, list):
            return Response({'error': 'No items to import.'}, status=status.HTTP_400_BAD_REQUEST)

        user_kitchen = request.user.get_kitchen()
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            if remove_existing:
                MenuItem.objects.filter(is_deleted=False, kitchen=user_kitchen).update(
                    is_deleted=True,
                    is_available=False,
                    deleted_at=timezone.now()
                )

            for it in items_payload:
                name = str(it.get('name') or '').strip()
                if not name:
                    continue

                try:
                    price_inr = float(it.get('price_inr') or it.get('price') or 0.0)
                except (ValueError, TypeError):
                    price_inr = 0.0

                existing = MenuItem.objects.filter(name__iexact=name, kitchen=user_kitchen).first()

                token_val_raw = it.get('tokens')
                if token_val_raw is not None:
                    try:
                        token_val = int(token_val_raw)
                        if token_val < 1:
                            token_val = 1
                    except (ValueError, TypeError):
                        token_val = existing.price if existing else 10
                elif existing:
                    token_val = existing.price
                else:
                    token_val = 10

                category = it.get('category') or 'meal'
                if category not in ['meal', 'snack', 'beverage']:
                    category = 'meal'
                is_available = bool(it.get('is_available', True))

                is_veg = it.get('is_veg')
                food_type = it.get('food_type')
                if food_type is None and is_veg is not None:
                    food_type = 'veg' if is_veg else 'non_veg'
                if is_veg is None and food_type is not None:
                    is_veg = (food_type == 'veg')

                if existing:
                    existing.price = token_val
                    existing.price_inr = price_inr
                    existing.category = category
                    if food_type:
                        existing.food_type = food_type
                    if is_veg is not None:
                        existing.is_veg = is_veg
                    existing.is_available = is_available
                    existing.is_deleted = False
                    existing.deleted_at = None
                    existing.save()
                    updated_count += 1
                else:
                    kwargs = {
                        'name': name,
                        'kitchen': user_kitchen,
                        'price': token_val,
                        'price_inr': price_inr,
                        'category': category,
                        'is_available': is_available,
                        'is_deleted': False
                    }
                    if food_type:
                        kwargs['food_type'] = food_type
                    if is_veg is not None:
                        kwargs['is_veg'] = is_veg
                    MenuItem.objects.create(**kwargs)
                    created_count += 1

        return Response({
            'status': 'success',
            'created': created_count,
            'updated': updated_count,
            'total': created_count + updated_count,
            'message': f'Successfully imported {created_count} new and updated {updated_count} menu items from TXT.'
        })



# Staff: Order management
class StaffOrderViewSet(viewsets.ModelViewSet):
    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Orders cannot be deleted for auditing and token integrity purposes.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    queryset = Order.objects.select_related('user', 'kitchen', 'kitchen__office').prefetch_related('order_items__menu_item').all()
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related('user', 'kitchen', 'kitchen__office').prefetch_related('order_items__menu_item').all()
        kitchen_id = self.request.query_params.get('kitchen_id')
        if kitchen_id:
            queryset = queryset.filter(kitchen_id=kitchen_id)
        elif user.is_authenticated and user.role in ['staff', 'staff_admin']:
            k = user.get_kitchen()
            if k:
                queryset = queryset.filter(kitchen=k)

        search = self.request.query_params.get('search')
        if search:
            query = Q(user__username__icontains=search) | Q(user__user_id__icontains=search)
            if str(search).isdigit():
                try:
                    query = query | Q(id=int(search))
                except ValueError:
                    pass
            queryset = queryset.filter(query)

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        category_param = self.request.query_params.get('category')
        if category_param and category_param != 'all':
            queryset = queryset.filter(order_items__menu_item__category=category_param).distinct()

        return queryset

    @action(detail=False, methods=['get'])
    def live_feed(self, request):
        """
        Lightweight status polling endpoint for Kitchen Display.
        Minimizes DB queries using prefetching and aggregate counts.
        """
        user = request.user
        today = timezone.now().date()
        today_orders = Order.objects.filter(created_at__date=today)
        if user.is_authenticated and user.role in ['staff', 'staff_admin']:
            k = user.get_kitchen()
            if k:
                today_orders = today_orders.filter(kitchen=k)

        counts = {
            'pending': today_orders.filter(status='pending').count(),
            'approved': today_orders.filter(status='approved').count(),
            'completed': today_orders.filter(status='completed').count(),
            'declined': today_orders.filter(status='declined').count(),
            'total': today_orders.count(),
        }

        latest_order = Order.objects.order_by('-id').first()
        latest_order_id = latest_order.id if latest_order else 0

        since_id = request.query_params.get('since_id')
        new_orders = []
        if since_id and str(since_id).isdigit():
            qs = Order.objects.filter(id__gt=int(since_id)).select_related('user').prefetch_related('order_items__menu_item').order_by('-id')[:20]
            new_orders = OrderSerializer(qs, many=True).data

        return Response({
            'counts': counts,
            'latest_order_id': latest_order_id,
            'server_time': timezone.now().isoformat(),
            'new_orders': new_orders,
        })

    @action(detail=True, methods=['patch', 'post'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response({'error': 'Status field is required'}, status=status.HTTP_400_BAD_REQUEST)

        valid_transitions = {
            'pending': ['approved', 'declined'],
            'approved': ['completed', 'declined'],
            'declined': [],
            'completed': [],
        }

        allowed = valid_transitions.get(order.status, [])
        if new_status not in allowed:
            if order.status in ['declined', 'completed']:
                return Response(
                    {'error': f'Order #{order.id} is already {order.status} and cannot be modified.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': f'Cannot transition order #{order.id} from "{order.status}" to "{new_status}". Allowed transitions: {allowed}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            refunded = False
            if new_status == 'declined':
                refunded = order.refund_tokens()

            order.status = new_status
            order.save()

            serializer = self.get_serializer(order)
            data = dict(serializer.data)
            if refunded:
                data['refund_message'] = f'{order.total_tokens} tokens have been refunded to {order.user.username}.'
            return Response(data)


# Admin: Shift token allocations
class ShiftTokenAllocationViewSet(viewsets.ModelViewSet):
    queryset = ShiftTokenAllocation.objects.all().order_by('-allocation_month')
    serializer_class = ShiftTokenAllocationSerializer
    permission_classes = [IsAdmin]


# Admin: Per-user token distributions
class TokenDistributionViewSet(viewsets.ModelViewSet):
    queryset = TokenDistribution.objects.select_related('user').all().order_by('-allocation_month')
    serializer_class = TokenDistributionSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user')
        month = self.request.query_params.get('month')  # format YYYY-MM or YYYY-MM-01
        if user_id:
            qs = qs.filter(user_id=user_id)
        if month:
            try:
                # Accept YYYY-MM or full date; normalize to first of month
                from datetime import datetime
                if len(month) == 7:
                    month = f"{month}-01"
                dt = datetime.strptime(month, "%Y-%m-%d").date().replace(day=1)
                qs = qs.filter(allocation_month=dt)
            except Exception:
                pass
        return qs


# Employee: View menu
@api_view(['GET'])
@permission_classes([IsEmployee])
def employee_menu(request):
    ensure_user_monthly_tokens(request.user)
    user_kitchen = request.user.get_kitchen()
    menu_items = MenuItem.objects.filter(is_deleted=False, is_available=True)
    if user_kitchen:
        menu_items = menu_items.filter(kitchen=user_kitchen)
    food_type = request.query_params.get('food_type')
    if food_type in ['veg', 'non_veg']:
        menu_items = menu_items.filter(food_type=food_type)
    is_veg = request.query_params.get('is_veg')
    if is_veg is not None:
        if str(is_veg).lower() in ['true', '1']:
            menu_items = menu_items.filter(is_veg=True)
        elif str(is_veg).lower() in ['false', '0']:
            menu_items = menu_items.filter(is_veg=False)
    serializer = MenuItemSerializer(menu_items, many=True)
    return Response(serializer.data)


def _get_shift_boundary_start(user, now_kolkata, mode='shift_based'):
    """
    Computes shift-based quota reset boundary for Asia/Kolkata:
    Day Shift: 06:00:00 IST
    Mid Shift: 14:00:00 IST
    Night Shift: 22:00:00 IST (handles spanning midnight)
    """
    tz = ZoneInfo("Asia/Kolkata")
    if mode == 'daily_window':
        return datetime.combine(now_kolkata.date(), time.min).replace(tzinfo=tz)

    shift = (getattr(user, 'work_shift', None) or 'day').lower()
    today = now_kolkata.date()
    yesterday = today - timedelta(days=1)

    if shift == 'mid':
        shift_start = datetime.combine(today, time(14, 0)).replace(tzinfo=tz)
        if now_kolkata < shift_start:
            shift_start = datetime.combine(yesterday, time(14, 0)).replace(tzinfo=tz)
        return shift_start
    elif shift == 'night':
        if now_kolkata.hour < 6:
            return datetime.combine(yesterday, time(22, 0)).replace(tzinfo=tz)
        elif now_kolkata.hour >= 22:
            return datetime.combine(today, time(22, 0)).replace(tzinfo=tz)
        else:
            return datetime.combine(yesterday, time(22, 0)).replace(tzinfo=tz)
    else:
        shift_start = datetime.combine(today, time(6, 0)).replace(tzinfo=tz)
        if now_kolkata < shift_start:
            shift_start = datetime.combine(yesterday, time(6, 0)).replace(tzinfo=tz)
        return shift_start


def _process_order_placement(request):
    """
    Unified transactional order placement with:
    - Shift-based order limit and item quota checks (Asia/Kolkata timezone)
    - Row-level lock on user (select_for_update) to prevent concurrency double-spending
    - Strict validation: menu_item exists, is_deleted=False, is_available=True, quantity is positive int >= 1
    - Server-side total calculation (never trusts client totals)
    - INR valuation alongside token cost
    - Atomic token deduction and Order + OrderItem creation
    """
    ensure_user_monthly_tokens(request.user)
    items = request.data.get('items', [])
    if not isinstance(items, list) or len(items) == 0:
        return Response({'error': 'No items provided for the order'}, status=status.HTTP_400_BAD_REQUEST)

    # Timezone-aware date for Asia/Kolkata
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = timezone.now().astimezone(kolkata_tz)

    # Daily Limits from CanteenSetting
    setting = CanteenSetting.get_settings()
    shift_start_dt = _get_shift_boundary_start(request.user, now_kolkata, setting.shift_reset_mode)

    validated_items = []
    total_tokens_needed = 0
    total_amount_inr = 0.0

    with transaction.atomic():
        # Lock user record to prevent concurrent double-spending
        user = CustomUser.objects.select_for_update().get(id=request.user.id)

        # Enforce max orders per user per shift
        if setting.max_orders_per_user_per_day and setting.max_orders_per_user_per_day > 0:
            orders_today_count = Order.objects.filter(
                user=user,
                created_at__gte=shift_start_dt
            ).exclude(status__in=['cancelled', 'declined']).count()
            if orders_today_count >= setting.max_orders_per_user_per_day:
                return Response(
                    {'error': f'Daily order limit reached. You can place a maximum of {setting.max_orders_per_user_per_day} orders per shift/day.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        for item in items:
            if not isinstance(item, dict):
                return Response({'error': 'Malformed item payload'}, status=status.HTTP_400_BAD_REQUEST)

            item_id = item.get('menu_item_id')
            if not item_id:
                return Response({'error': 'Each item must specify a menu_item_id'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                quantity = int(item.get('quantity', 0))
            except (ValueError, TypeError):
                return Response({'error': 'Quantity must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

            if quantity <= 0:
                return Response({'error': 'Quantity must be at least 1'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                menu_item = MenuItem.objects.get(id=item_id, is_deleted=False)
            except MenuItem.DoesNotExist:
                return Response({'error': f'Menu item #{item_id} does not exist or has been removed'}, status=status.HTTP_400_BAD_REQUEST)

            if not menu_item.is_available:
                return Response({'error': f'"{menu_item.name}" is currently unavailable'}, status=status.HTTP_400_BAD_REQUEST)

            # Enforce max quantity per item per shift
            if setting.max_qty_per_item_per_day and setting.max_qty_per_item_per_day > 0:
                ordered_item_qty_today = OrderItem.objects.filter(
                    order__user=user,
                    order__created_at__gte=shift_start_dt,
                    menu_item=menu_item
                ).exclude(order__status__in=['cancelled', 'declined']).aggregate(total=Sum('quantity'))['total'] or 0

                if ordered_item_qty_today + quantity > setting.max_qty_per_item_per_day:
                    return Response(
                        {
                            'error': f'Daily limit exceeded for "{menu_item.name}". '
                                     f'Maximum allowed is {setting.max_qty_per_item_per_day} per shift/day '
                                     f'(already ordered: {ordered_item_qty_today}).'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            tokens_for_item = menu_item.price * quantity
            total_tokens_needed += tokens_for_item
            item_inr = (float(menu_item.price_inr) if menu_item.price_inr else 0.0) * quantity
            total_amount_inr += item_inr
            validated_items.append((menu_item, quantity, menu_item.price, menu_item.price_inr or 0.0))

        # Enforce shift-wise daily token spending limit (Day: 300, Mid: 250, Night: 300 tk default)
        shift_daily_limit = setting.get_daily_token_limit_for_user(user)
        if shift_daily_limit and shift_daily_limit > 0:
            tokens_spent_today = Order.objects.filter(
                user=user,
                created_at__gte=shift_start_dt
            ).exclude(status__in=['cancelled', 'declined']).aggregate(total=Sum('total_tokens'))['total'] or 0

            if tokens_spent_today + total_tokens_needed > shift_daily_limit:
                shift_name = (user.work_shift or 'Day').replace('_shift', '').capitalize()
                remaining_limit = max(0, shift_daily_limit - tokens_spent_today)
                return Response(
                    {
                        'error': f'Daily limit reached for {shift_name} Shift ({shift_daily_limit} tokens). '
                                 f'You have already spent {tokens_spent_today} tokens this shift. '
                                 f'Remaining allowance: {remaining_limit} tokens.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        available_tokens = user.current_tokens()
        if available_tokens < total_tokens_needed:
            return Response(
                {'error': f'Insufficient tokens. Required: {total_tokens_needed}, Available: {available_tokens}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deduct tokens atomically
        user.monthly_tokens -= total_tokens_needed
        user.save(update_fields=['monthly_tokens'])

        # Create Order
        user_kitchen = user.get_kitchen()
        order = Order.objects.create(
            user=user,
            kitchen=user_kitchen,
            status='pending',
            total_tokens=total_tokens_needed,
            total_amount_inr=total_amount_inr,
            tokens_refunded=False
        )

        # Create OrderItems
        for menu_item, quantity, unit_tokens, unit_inr in validated_items:
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                tokens_per_item=unit_tokens,
                price_inr_per_item=unit_inr,
                status='fulfilled'
            )

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ✅ Employee: Place order
@api_view(['POST'])
@permission_classes([IsEmployee])
def employee_place_order(request):
    return _process_order_placement(request)


# Employee: View orders
@api_view(['GET'])
@permission_classes([IsEmployee])
def employee_orders(request):
    ensure_user_monthly_tokens(request.user)
    orders = Order.objects.filter(user=request.user).select_related('user').prefetch_related('order_items__menu_item')
    today = timezone.now().date()

    today_orders = orders.filter(created_at__date=today)
    past_orders = orders.exclude(created_at__date=today)

    today_serializer = OrderSerializer(today_orders, many=True)
    past_serializer = OrderSerializer(past_orders, many=True)

    return Response({
        'today_orders': today_serializer.data,
        'past_orders': past_serializer.data,
        'server_time': timezone.now().isoformat(),
        'tokens_balance': request.user.current_tokens(),
    })


# ✅ Guest: View menu
@api_view(['GET'])
@permission_classes([IsGuest])
def guest_menu(request):
    ensure_user_monthly_tokens(request.user)
    user_kitchen = request.user.get_kitchen()
    menu_items = MenuItem.objects.filter(is_deleted=False, is_available=True)
    if user_kitchen:
        menu_items = menu_items.filter(kitchen=user_kitchen)
    food_type = request.query_params.get('food_type')
    if food_type in ['veg', 'non_veg']:
        menu_items = menu_items.filter(food_type=food_type)
    is_veg = request.query_params.get('is_veg')
    if is_veg is not None:
        if str(is_veg).lower() in ['true', '1']:
            menu_items = menu_items.filter(is_veg=True)
        elif str(is_veg).lower() in ['false', '0']:
            menu_items = menu_items.filter(is_veg=False)
    serializer = MenuItemSerializer(menu_items, many=True)
    return Response(serializer.data)


# ✅ Guest: View orders
@api_view(['GET'])
@permission_classes([IsGuest])
def guest_orders(request):
    ensure_user_monthly_tokens(request.user)
    orders = Order.objects.filter(user=request.user).select_related('user').prefetch_related('order_items__menu_item')
    today = timezone.now().date()

    today_orders = orders.filter(created_at__date=today)
    past_orders = orders.exclude(created_at__date=today)

    today_serializer = OrderSerializer(today_orders, many=True)
    past_serializer = OrderSerializer(past_orders, many=True)

    return Response({
        'today_orders': today_serializer.data,
        'past_orders': past_serializer.data,
        'server_time': timezone.now().isoformat(),
        'tokens_balance': request.user.current_tokens(),
    })


# ✅ Guest: Place order
@api_view(['POST'])
@permission_classes([IsGuest])
def guest_place_order(request):
    return _process_order_placement(request)


# 🧾 Digital Receipt Generator
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_order_receipt(request, order_id):
    """
    Retrieve structured, corporate-audit-ready digital token receipt for an order.
    Allowed only for order owner or staff/admin.
    """
    try:
        order = Order.objects.select_related('user').prefetch_related('order_items__menu_item').get(id=order_id)
    except Order.DoesNotExist:
        return Response({'error': f'Order #{order_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Security check: must be owner or staff/admin
    if order.user != request.user and request.user.role not in ['admin', 'staff', 'staff_admin'] and not request.user.is_superuser:
        return Response({'error': 'You do not have permission to view this receipt.'}, status=status.HTTP_403_FORBIDDEN)

    user = order.user
    items_breakdown = []
    for item in order.order_items.all():
        items_breakdown.append({
            'id': item.id,
            'name': item.menu_item.name,
            'category': getattr(item.menu_item, 'category', 'meal'),
            'quantity': item.quantity,
            'tokens_per_item': item.tokens_per_item,
            'total_tokens': item.total_tokens,
        })

    receipt_number = f"VDART-RCPT-{order.id:05d}"
    user_id_tag = (user.user_id or user.username)[:6].upper()
    verification_code = f"VDC-{order.id}-{order.total_tokens}TK-{user_id_tag}"

    receipt_data = {
        'receipt_number': receipt_number,
        'order_id': order.id,
        'created_at': order.created_at.isoformat(),
        'updated_at': order.updated_at.isoformat(),
        'status': order.status,
        'total_tokens': order.total_tokens,
        'tokens_refunded': order.tokens_refunded,
        'user': {
            'id': user.id,
            'username': user.username,
            'name': user.get_full_name() or user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'user_id': user.user_id,
            'work_shift': user.work_shift,
            'role': user.role,
        },
        'items': items_breakdown,
        'items_count': sum(i['quantity'] for i in items_breakdown),
        'payment_method': 'Corporate Shift Token Allowance',
        'cafe_info': {
            'name': 'VDart Cafe',
            'tagline': 'Corporate Canteen & Refreshment Lounge',
            'location': 'VDart Technologies Global Headquarters',
            'canteen_code': 'VDART-HQ-01',
            'support_contact': 'canteen-helpdesk@vdart.com',
        },
        'verification_code': verification_code,
    }
    return Response(receipt_data)


# Token Management
def _parse_token_amount(raw_value):
    """Return a valid non-negative integer token amount, or None if invalid."""
    if raw_value is None or str(raw_value).strip() == '':
        return None
    try:
        amount = int(float(str(raw_value).strip()))
    except (ValueError, TypeError):
        return None
    if amount < 0:
        return None
    return amount


def _allocate_shift_tokens(shift, token_amount, cycle_start, admin_user=None):
    """Create/update the audit record and sync every user's wallet in the shift."""
    ShiftTokenAllocation.objects.update_or_create(
        shift=shift,
        allocation_month=cycle_start,
        defaults={'tokens_per_user': token_amount},
    )
    users = CustomUser.objects.filter(
        work_shift=shift,
        role__in=['employee', 'guest'],
        is_deleted=False
    )
    updated = 0
    month_name = cycle_start.strftime('%B %Y')
    today = timezone.now().date()
    for user in users:
        TokenDistribution.objects.update_or_create(
            user=user,
            allocation_month=cycle_start,
            defaults={'tokens_allocated': token_amount},
        )
        FinancialTransaction.objects.create(
            user=user,
            transaction_type='manual_payment',
            amount_tokens=token_amount,
            amount_inr=token_amount,
            payment_method='token_transfer',
            payment_reference=f"MANUAL-{cycle_start.strftime('%Y%m%d')}-{user.id}",
            notes=f"Manual token allocation for {month_name} on {today.strftime('%Y-%m-%d')} by {admin_user.username if admin_user else 'Admin'}",
            created_by=admin_user
        )
        user.monthly_tokens = token_amount
        user.last_token_reset = cycle_start
        user.save(update_fields=['monthly_tokens', 'last_token_reset'])
        updated += 1
    return updated


@api_view(['POST'])
@permission_classes([IsAdmin])
def assign_tokens(request):
    shift = (request.data.get('shift') or '').strip().lower()
    # Normalize shift if it comes with '_shift' suffix
    shift = shift.replace('_shift', '')
    raw_tokens = request.data.get('tokens')
    month_start = get_current_cycle_start()
    cycle_dates = get_billing_cycle_dates(month_start)

    # Support allocating all shifts in a single atomic transaction
    if shift == 'all':
        amounts = {}
        if isinstance(raw_tokens, dict):
            for s in ['day', 'mid', 'night']:
                value = raw_tokens.get(s, raw_tokens.get(f'{s}_shift'))
                amount = _parse_token_amount(value)
                if amount is None:
                    return Response(
                        {'error': f'A valid token amount is required for the {s} shift.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                amounts[s] = amount
        else:
            shared_amount = _parse_token_amount(raw_tokens)
            if shared_amount is None:
                return Response(
                    {'error': 'Provide token amounts for all shifts, e.g. {"tokens": {"day": 50, "mid": 75, "night": 100}}.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            amounts = {s: shared_amount for s in ['day', 'mid', 'night']}

        with transaction.atomic():
            total_updated = 0
            total_distributed = 0
            details = {}
            for s in ['day', 'mid', 'night']:
                cnt = _allocate_shift_tokens(s, amounts[s], month_start, admin_user=request.user)
                total_updated += cnt
                total_distributed += amounts[s] * cnt
                details[s] = {'tokens': amounts[s], 'users': cnt}

            TokenResetApproval.objects.update_or_create(
                cycle_month=month_start,
                defaults={
                    'cycle_end': cycle_dates['cycle_end'],
                    'reset_date': timezone.now().date(),
                    'status': 'approved',
                    'allocation_mode': 'manual',
                    'distributed_tokens': total_distributed,
                    'affected_users_count': total_updated,
                    'approved_by': request.user,
                    'approved_at': timezone.now(),
                    'allocated_at': timezone.now(),
                    'draft_quotas': amounts,
                    'notes': f"Manual allocation for all shifts by {request.user.username}"
                }
            )

            TokenAllocationAuditLog.objects.create(
                event_type='manual_allocation',
                billing_cycle_start=month_start,
                billing_cycle_end=cycle_dates['cycle_end'],
                performed_by=request.user,
                details={'shift': 'all', 'tokens': amounts, 'updated_users': total_updated, 'distributed_tokens': total_distributed},
                notes=f"Manual allocation executed across all shifts by {request.user.username}"
            )

            return Response({
                'status': 'success',
                'message': f'Successfully allocated monthly tokens across all shifts ({total_updated} users updated).',
                'updated': total_updated,
                'details': details,
                'allocation_month': month_start.strftime('%Y-%m-%d')
            })

    if not shift or shift not in ['day', 'mid', 'night']:
        return Response(
            {'error': f'Invalid shift "{shift}". Must be day, mid, night, or all.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    token_amount = _parse_token_amount(raw_tokens)
    if token_amount is None:
        return Response(
            {'error': 'A valid token amount is required. Enter the number of tokens to allocate.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    with transaction.atomic():
        updated_count = _allocate_shift_tokens(shift, token_amount, month_start, admin_user=request.user)
        total_credited = token_amount * updated_count

        TokenResetApproval.objects.update_or_create(
            cycle_month=month_start,
            defaults={
                'cycle_end': cycle_dates['cycle_end'],
                'reset_date': timezone.now().date(),
                'status': 'approved',
                'allocation_mode': 'manual',
                'distributed_tokens': total_credited,
                'affected_users_count': updated_count,
                'approved_by': request.user,
                'approved_at': timezone.now(),
                'allocated_at': timezone.now(),
                'notes': f"Manual allocation for {shift} shift by {request.user.username}"
            }
        )

        TokenAllocationAuditLog.objects.create(
            event_type='manual_allocation',
            billing_cycle_start=month_start,
            billing_cycle_end=cycle_dates['cycle_end'],
            performed_by=request.user,
            details={'shift': shift, 'tokens': token_amount, 'updated_users': updated_count, 'distributed_tokens': total_credited},
            notes=f"Manual allocation executed for {shift} shift ({token_amount} tk) by {request.user.username}"
        )

        return Response({
            'status': 'success',
            'message': f'Successfully allocated {token_amount} tokens to {updated_count} users in {shift} shift.',
            'updated': updated_count,
            'tokens_assigned': token_amount,
            'shift': shift,
            'allocation_month': month_start.strftime('%Y-%m-%d')
        })

@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_token_summary(request):
    users = CustomUser.objects.filter(
        role__in=['employee', 'guest'],
        is_deleted=False
    ).order_by('work_shift', 'username')
    
    month_start = get_current_cycle_start()
    month_name = month_start.strftime('%B %Y')

    summary = {
        'day_shift': {
            'users': [], 
            'total_tokens': 0, 
            'total_distributed': 0, 
            'total_spent': 0, 
            'total_unused': 0,
            'quota_per_user': get_shift_monthly_quota('day', month_start)
        },
        'mid_shift': {
            'users': [], 
            'total_tokens': 0, 
            'total_distributed': 0, 
            'total_spent': 0, 
            'total_unused': 0,
            'quota_per_user': get_shift_monthly_quota('mid', month_start)
        },
        'night_shift': {
            'users': [], 
            'total_tokens': 0, 
            'total_distributed': 0, 
            'total_spent': 0, 
            'total_unused': 0,
            'quota_per_user': get_shift_monthly_quota('night', month_start)
        }
    }
    
    total_distributed_all = 0
    total_spent_all = 0
    total_unused_all = 0

    def _compute_user_summary(u):
        try:
            full_name = f"{u.first_name} {u.last_name}".strip()
            metrics = get_user_token_metrics(u, month_start)
            raw_shift = (u.work_shift or 'day').replace('_shift', '')
            shift_key = f"{raw_shift}_shift"
            if shift_key not in ['day_shift', 'mid_shift', 'night_shift']:
                shift_key = 'day_shift'
            user_data = {
                'id': u.id,
                'username': u.username,
                'name': full_name if full_name else u.username,
                'user_id': u.user_id,
                'email': u.email,
                'tokens': metrics['tokens_unused'],
                'role': u.role,
                'work_shift': u.work_shift,
                'tokens_distributed': metrics['tokens_distributed'],
                'tokens_spent': metrics['tokens_spent'],
                'tokens_unused': metrics['tokens_unused'],
                'all_time_spent': metrics['all_time_spent'],
                'month_orders_count': metrics['month_orders_count'],
                'last_token_reset': u.last_token_reset.strftime('%Y-%m-%d') if u.last_token_reset else None
            }
            return shift_key, user_data, metrics
        finally:
            if not connection.in_atomic_block:
                connection.close()

    user_list = list(users)
    if connection.in_atomic_block or len(user_list) <= 1:
        processed_users = [_compute_user_summary(u) for u in user_list]
    else:
        max_workers = min(12, max(2, (os.cpu_count() or 4) * 2))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            processed_users = list(executor.map(_compute_user_summary, user_list))

    for shift_key, user_data, metrics in processed_users:
        summary[shift_key]['users'].append(user_data)
        summary[shift_key]['total_tokens'] += metrics['tokens_unused']
        summary[shift_key]['total_distributed'] += metrics['tokens_distributed']
        summary[shift_key]['total_spent'] += metrics['tokens_spent']
        summary[shift_key]['total_unused'] += metrics['tokens_unused']

        total_distributed_all += metrics['tokens_distributed']
        total_spent_all += metrics['tokens_spent']
        total_unused_all += metrics['tokens_unused']
    
    summary['overall'] = {
        'month': month_name,
        'month_start': month_start.strftime('%Y-%m-%d'),
        'total_users': users.count(),
        'total_distributed': total_distributed_all,
        'total_spent': total_spent_all,
        'total_unused': total_unused_all
    }

    # Include token reset approval status, advance reminder, and past month metrics
    summary['reset_approval_info'] = get_token_reset_status_and_reminder()
    
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_user_token_transactions(request, user_id):
    """
    Detailed audit endpoint to track all token transactions for an individual user:
    - Monthly tokens distributed, spent, and unused
    - Full list of orders with items and token deductions
    - Token allocation history
    - Financial transaction ledger
    """
    user = get_object_or_404(CustomUser, pk=user_id)
    if request.user.role == 'staff_admin':
        if user.role in ['admin', 'staff_admin']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        my_k = request.user.get_kitchen()
        if my_k and user.get_kitchen() != my_k:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    month_start = get_current_cycle_start()
    metrics = get_user_token_metrics(user, month_start)

    # 1. Orders
    orders = Order.objects.filter(user=user).order_by('-created_at')[:50]
    orders_data = []
    for o in orders:
        items = [{
            'name': item.menu_item.name if item.menu_item else 'Item',
            'quantity': item.quantity,
            'tokens_per_item': item.tokens_per_item,
            'total_tokens': item.tokens_per_item * item.quantity
        } for item in o.order_items.all()]
        orders_data.append({
            'id': o.id,
            'created_at': o.created_at.strftime('%Y-%m-%d %H:%M'),
            'status': o.status,
            'total_tokens': o.total_tokens,
            'items': items
        })

    # 2. Token distributions
    distributions = TokenDistribution.objects.filter(user=user).order_by('-allocation_month')[:24]
    dist_data = [{
        'id': d.id,
        'month': d.allocation_month.strftime('%B %Y'),
        'tokens_allocated': d.tokens_allocated,
        'created_at': d.allocation_month.strftime('%Y-%m-%d 00:00')
    } for d in distributions]

    # 3. Financial ledger
    ledger = FinancialTransaction.objects.filter(user=user).order_by('-created_at')[:50]
    ledger_data = [{
        'id': l.id,
        'transaction_type': l.transaction_type,
        'amount_tokens': l.amount_tokens,
        'payment_reference': l.payment_reference,
        'notes': l.notes,
        'created_at': l.created_at.strftime('%Y-%m-%d %H:%M')
    } for l in ledger]

    full_name = f"{user.first_name} {user.last_name}".strip()
    return Response({
        'user': {
            'id': user.id,
            'username': user.username,
            'name': full_name if full_name else user.username,
            'user_id': user.user_id,
            'email': user.email,
            'role': user.role,
            'work_shift': user.work_shift,
            'monthly_tokens': user.monthly_tokens,
            'last_token_reset': user.last_token_reset.strftime('%Y-%m-%d') if user.last_token_reset else None
        },
        'metrics': metrics,
        'orders': orders_data,
        'distributions': dist_data,
        'ledger': ledger_data
    })

# Token Reset Approval & Reminder endpoints
@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_token_reset_approval_status(request):
    """
    Returns the token reset approval status for the current/upcoming cycle,
    advance reminder notification data, past month consumption metrics,
    and shift quotas.
    """
    data = get_token_reset_status_and_reminder()
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def approve_token_reset(request):
    """
    Super Admin endpoint to review and approve monthly token reset & distribution.
    Tokens are distributed based on past month counts and shift quotas,
    tracking the exact reset date.
    """
    custom_quotas = request.data.get('quotas') or request.data.get('tokens')
    notes = request.data.get('notes', '')
    result = distribute_approved_monthly_tokens(
        admin_user=request.user,
        custom_quotas=custom_quotas,
        notes=notes
    )
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAdmin])
def reject_token_reset_view(request):
    """
    Super Admin endpoint to reject monthly token allocation proposal.
    """
    notes = request.data.get('notes', '')
    result = reject_token_reset(
        admin_user=request.user,
        notes=notes
    )
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAdmin])
def set_token_allocation_mode_view(request):
    """
    Super Admin endpoint to switch Monthly Token Allocation Mode between Automatic and Manual.
    Persisted directly in backend CanteenSetting and recorded in audit log.
    """
    new_mode = (request.data.get('mode') or '').strip().lower()
    if new_mode not in ['automatic', 'manual']:
        return Response(
            {'error': 'Invalid allocation mode. Must be "automatic" or "manual".'},
            status=status.HTTP_400_BAD_REQUEST
        )

    setting = CanteenSetting.get_settings()
    prev_mode = setting.monthly_token_allocation_mode
    setting.monthly_token_allocation_mode = new_mode
    setting.updated_by = request.user
    setting.save(update_fields=['monthly_token_allocation_mode', 'updated_by', 'updated_at'])

    cycle_info = get_billing_cycle_dates()

    TokenAllocationAuditLog.objects.create(
        event_type='mode_change',
        billing_cycle_start=cycle_info['cycle_start'],
        billing_cycle_end=cycle_info['cycle_end'],
        performed_by=request.user,
        details={'previous_mode': prev_mode, 'new_mode': new_mode},
        notes=f"Monthly token allocation mode changed from {prev_mode} to {new_mode} by {request.user.username}"
    )

    mode_explanation = (
        "Automatic Mode: Token allocations are calculated automatically from saved shift policy quotas and active diner headcounts. Wallets are credited strictly upon Super Admin review and approval."
        if new_mode == 'automatic' else
        "Manual Mode: Scheduled automated token runs are disabled. Authorized Super Admins must enter token amounts manually and submit the allocation for each billing cycle."
    )

    return Response({
        'status': 'success',
        'message': f'Monthly token allocation mode set to {new_mode.capitalize()}.',
        'mode': new_mode,
        'mode_display': new_mode.capitalize(),
        'mode_explanation': mode_explanation,
        'previous_mode': prev_mode,
        'cycle_info': {
            'cycle_start': cycle_info['cycle_start'].isoformat(),
            'cycle_end': cycle_info['cycle_end'].isoformat(),
            'cycle_label': cycle_info['cycle_label'],
            'next_allocation_date': cycle_info['next_allocation_date'].isoformat(),
            'upcoming_cycle_start': cycle_info['upcoming_cycle_start'].isoformat(),
            'upcoming_cycle_end': cycle_info['upcoming_cycle_end'].isoformat(),
        }
    })


@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_token_allocation_history_view(request):
    """
    Returns dedicated monthly allocation history across past, current, and upcoming cycles.
    Supports filtering by shift, mode, status, and billing cycle.
    """
    filters = {
        'shift': request.query_params.get('shift'),
        'mode': request.query_params.get('mode'),
        'status': request.query_params.get('status'),
        'cycle': request.query_params.get('cycle'),
    }
    history = get_monthly_allocation_history(filters)
    audit_logs = TokenAllocationAuditLog.objects.all().order_by('-created_at')[:50]
    audit_serializer = TokenAllocationAuditLogSerializer(audit_logs, many=True)
    available_cycles = [c['cycle_start'] for c in history if isinstance(c, dict) and 'cycle_start' in c]
    return Response({
        'cycles': history,
        'audit_logs': audit_serializer.data,
        'available_cycle_starts': available_cycles,
    })



# Dashboard views
@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_dashboard_stats(request):
    """Get statistics for the admin dashboard with token allocation cycle revenue"""
    try:
        kolkata_tz = ZoneInfo("Asia/Kolkata")
        now_kolkata = timezone.now().astimezone(kolkata_tz)
        today = now_kolkata.date()
        now_dt = now_kolkata
        yesterday = today - timedelta(days=1)
        last_month = now_dt - timedelta(days=30)
        cycle_info = get_billing_cycle_dates(today)

        # Multi-threaded query tasks for dashboard analytics
        def _fetch_user_stats():
            try:
                tot_users = CustomUser.objects.count()
                prev_users = CustomUser.objects.filter(date_joined__lt=last_month).count()
                u_growth = ((tot_users - prev_users) / prev_users * 100) if prev_users > 0 else 0

                s_employees = list(CustomUser.objects.filter(role='employee').values('work_shift').annotate(count=Count('id')))
                s_guests = list(CustomUser.objects.filter(role='guest').values('work_shift').annotate(count=Count('id')))
                t_staff = CustomUser.objects.filter(role='staff').count()
                t_guests = CustomUser.objects.filter(role='guest').count()
                t_employees = CustomUser.objects.filter(role='employee').count()

                s_data = {
                    'employees': {item['work_shift']: item['count'] for item in s_employees if item.get('work_shift')},
                    'guests': {item['work_shift']: item['count'] for item in s_guests if item.get('work_shift')}
                }
                for sh in ['day', 'mid', 'night']:
                    s_data['employees'].setdefault(sh, 0)
                    s_data['guests'].setdefault(sh, 0)

                return {
                    'totalUsers': tot_users,
                    'totalEmployees': t_employees,
                    'totalStaff': t_staff,
                    'totalGuests': t_guests,
                    'userGrowth': round(u_growth, 1),
                    'shiftData': s_data
                }
            finally:
                if not connection.in_atomic_block:
                    connection.close()

        def _fetch_menu_stats():
            try:
                tot_items = MenuItem.objects.count()
                avail_items = MenuItem.objects.filter(is_available=True).count()
                new_week = MenuItem.objects.filter(created_at__gte=now_dt - timedelta(days=7)).count()
                return {
                    'totalMenuItems': tot_items,
                    'availableMenuItems': avail_items,
                    'newItemsThisWeek': new_week
                }
            finally:
                if not connection.in_atomic_block:
                    connection.close()

        def _fetch_revenue_stats():
            try:
                todays_orders = Order.objects.filter(created_at__date=today, status='completed')
                todays_rev = todays_orders.aggregate(total=Sum('total_tokens'))['total'] or 0

                yesterdays_orders = Order.objects.filter(created_at__date=yesterday, status='completed')
                yesterdays_rev = yesterdays_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
                rev_change = ((todays_rev - yesterdays_rev) / yesterdays_rev * 100) if yesterdays_rev > 0 else 0

                pending_cnt = Order.objects.filter(status='pending').count()
                yest_pending = Order.objects.filter(created_at__date=yesterday, status='pending').count()
                pending_chg = pending_cnt - yest_pending

                return {
                    'todaysRevenue': float(todays_rev),
                    'revenueChange': round(rev_change, 1),
                    'pendingOrders': pending_cnt,
                    'pendingChange': pending_chg
                }
            except Exception:
                return {
                    'todaysRevenue': 0.0,
                    'revenueChange': 0.0,
                    'pendingOrders': 0,
                    'pendingChange': 0
                }
            finally:
                if not connection.in_atomic_block:
                    connection.close()

        def _fetch_cycle_stats():
            try:
                c_start = cycle_info['cycle_start']
                c_end = cycle_info['cycle_end']
                next_alloc = cycle_info['next_allocation_date']
                last_alloc_date = cycle_info.get('last_token_allocated_date')
                has_past = cycle_info.get('has_past_reset', False)

                c_orders = Order.objects.filter(
                    created_at__date__gte=c_start,
                    created_at__date__lte=today,
                    status='completed'
                )
                c_rev_tokens = c_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
                c_orders_count = c_orders.count()

                p_cycle_start = cycle_info['prev_cycle_start']
                if p_cycle_start:
                    p_comp_end = p_cycle_start + timedelta(days=cycle_info['days_elapsed'] - 1)
                    p_cycle_orders = Order.objects.filter(
                        created_at__date__gte=p_cycle_start,
                        created_at__date__lte=p_comp_end,
                        status='completed'
                    )
                    p_cycle_rev = p_cycle_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
                else:
                    p_cycle_rev = 0
                c_rev_change = ((c_rev_tokens - p_cycle_rev) / p_cycle_rev * 100) if p_cycle_rev > 0 else 0

                # Actual credited tokens for this cycle
                c_tokens_alloc = TokenDistribution.objects.filter(
                    allocation_month=c_start
                ).aggregate(total=Sum('tokens_allocated'))['total'] or 0
                approval = TokenResetApproval.objects.filter(cycle_month=c_start, status='approved').first()
                if c_tokens_alloc == 0 and approval and approval.distributed_tokens > 0:
                    c_tokens_alloc = approval.distributed_tokens

                # Proposed tokens based on policy quotas
                proposed_tokens_alloc = 0
                active_diners = CustomUser.objects.filter(role__in=['employee', 'guest'], is_deleted=False)
                for diner in active_diners:
                    sh = (diner.work_shift or 'day').replace('_shift', '')
                    proposed_tokens_alloc += get_shift_monthly_quota(sh, c_start)

                # Current spendable balance
                c_tokens_rem = active_diners.aggregate(total=Sum('monthly_tokens'))['total'] or 0

                # Previous cycle metrics
                past_metrics = get_past_cycle_token_metrics(today)
                past_spent = past_metrics.get('past_total_spent', 0)
                past_allocated = past_metrics.get('past_total_allocated', 0)
                past_unused = past_metrics.get('current_unused_total', 0)

                daily_burn = round(c_rev_tokens / max(1, cycle_info['days_elapsed']), 1)
                proj_rev = round(daily_burn * cycle_info['total_days'])
                # If tokens allocated > 0, utilization against actual; otherwise against proposed
                util_base = c_tokens_alloc if c_tokens_alloc > 0 else proposed_tokens_alloc
                c_util = round((c_rev_tokens / max(1, util_base)) * 100, 1) if util_base > 0 else 0

                return {
                    'cycleStart': c_start.isoformat(),
                    'cycleEnd': c_end.isoformat() if c_end else None,
                    'cycleLabel': cycle_info.get('cycle_label', f"{c_start.strftime('%d %b %Y')} – {c_end.strftime('%d %b %Y')}"),
                    'nextAllocationDate': next_alloc.isoformat() if next_alloc else None,
                    'lastTokenAllocatedDate': last_alloc_date.isoformat() if last_alloc_date else None,
                    'hasPastReset': has_past or (last_alloc_date is not None),
                    'currentDate': today.isoformat(),
                    'daysElapsed': cycle_info['days_elapsed'],
                    'totalDays': cycle_info['total_days'],
                    'daysRemaining': cycle_info['days_remaining'],
                    'allocationDay': cycle_info['allocation_day'],
                    'cycleRevenueTokens': int(c_rev_tokens),
                    'cycleOrdersCount': c_orders_count,
                    'cycleTokensAllocated': int(c_tokens_alloc),
                    'proposedTokensAllocated': int(proposed_tokens_alloc),
                    'cycleTokensRemaining': int(c_tokens_rem),
                    'pastCycleSpentTokens': int(past_spent),
                    'pastCycleAllocatedTokens': int(past_allocated),
                    'pastCycleUnusedTokens': int(past_unused),
                    'dailyBurnRate': daily_burn,
                    'projectedCycleRevenue': proj_rev,
                    'utilizationPct': c_util,
                    'prevCycleRevenueTokens': int(p_cycle_rev),
                    'cycleRevenueChange': round(c_rev_change, 1),
                }
            finally:
                if not connection.in_atomic_block:
                    connection.close()

        # Execute metric tasks concurrently via ThreadPoolExecutor when not in test atomic block
        if connection.in_atomic_block:
            user_res = _fetch_user_stats()
            menu_res = _fetch_menu_stats()
            rev_res = _fetch_revenue_stats()
            cycle_data = _fetch_cycle_stats()
        else:
            with ThreadPoolExecutor(max_workers=4) as executor:
                fut_user = executor.submit(_fetch_user_stats)
                fut_menu = executor.submit(_fetch_menu_stats)
                fut_rev = executor.submit(_fetch_revenue_stats)
                fut_cycle = executor.submit(_fetch_cycle_stats)

                user_res = fut_user.result()
                menu_res = fut_menu.result()
                rev_res = fut_rev.result()
                cycle_data = fut_cycle.result()

        response_data = {
            **user_res,
            **menu_res,
            **rev_res,
            'cycleData': cycle_data,
            'tokenResetReminder': get_token_reset_status_and_reminder(today),
            'status': 'success'
        }
        
        return Response(response_data)
        
    except Exception as e:
        return Response(
            {'error': 'Failed to load dashboard statistics', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_recent_orders(request):
    """Get recent orders for the admin dashboard"""
    limit = int(request.query_params.get('limit', 5))
    orders = Order.objects.select_related('user')\
                         .prefetch_related('order_items__menu_item')\
                         .order_by('-created_at')[:limit]
    
    data = []
    for order in orders:
        user_name = order.user.username
        items = [f"{item.quantity}x {item.menu_item.name}" for item in order.order_items.all()]
        
        data.append({
            'id': order.id,
            'userName': user_name,
            'items': items,
            'totalAmount': float(order.total_amount),
            'status': order.status,
            'createdAt': order.created_at
        })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_revenue_data(request):
    """Get revenue data for charts"""
    period = request.query_params.get('period', 'week')
    end_date = timezone.now().date()
    
    if period == 'week':
        start_date = end_date - timedelta(days=6)
        date_range = [start_date + timedelta(days=x) for x in range(7)]
    elif period == 'month':
        start_date = end_date - timedelta(days=29)
        date_range = [start_date + timedelta(days=x) for x in range(30)]
    elif period == 'cycle':
        cycle_info = get_billing_cycle_dates(end_date)
        start_date = cycle_info['cycle_start']
        days_span = (end_date - start_date).days + 1
        date_range = [start_date + timedelta(days=x) for x in range(days_span)]
    else:  # year
        start_date = end_date - timedelta(days=364)
        date_range = [start_date + timedelta(days=x*30) for x in range(12)]
    
    orders = (
        Order.objects.filter(
            created_at__date__range=[start_date, end_date], status='completed'
        )
        .values('created_at__date')
        .annotate(amount=Sum('total_tokens'))
    )

    revenue_by_date = {row['created_at__date']: float(row['amount'] or 0) for row in orders}
    
    data = []
    for date_item in date_range:
        data.append({
            'date': date_item,
            'amount': revenue_by_date.get(date_item, 0)
        })
    
    return Response(data)


# Cycle Revenue & Advanced Analytics View
@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def get_cycle_revenue_data(request):
    """
    Detailed cycle-based revenue analytics calculated from token allocated date to current date.
    Provides daily velocity, shift-wise distribution, food category and dietary breakdown,
    token utilization tiers, and top dishes consumed.
    """
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = timezone.now().astimezone(kolkata_tz)
    today = now_kolkata.date()

    target_date_str = request.query_params.get('date')
    target_date = date.fromisoformat(target_date_str) if target_date_str else today

    cycle_info = get_billing_cycle_dates(target_date)
    cycle_start = cycle_info['cycle_start']
    cycle_end = cycle_info['cycle_end']
    next_allocation_date = cycle_info['next_allocation_date']
    last_alloc_date = cycle_info.get('last_token_allocated_date')
    has_past = cycle_info.get('has_past_reset', False)

    # Completed orders in cycle up to target_date
    completed_orders = Order.objects.filter(
        created_at__date__gte=cycle_start,
        created_at__date__lte=target_date,
        status='completed'
    ).select_related('user')

    total_revenue_tokens = completed_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
    total_orders_count = completed_orders.count()

    # Previous cycle comparison (up to same relative day)
    prev_cycle_start = cycle_info['prev_cycle_start']
    if prev_cycle_start:
        prev_comp_end = prev_cycle_start + timedelta(days=cycle_info['days_elapsed'] - 1)
        prev_orders = Order.objects.filter(
            created_at__date__gte=prev_cycle_start,
            created_at__date__lte=prev_comp_end,
            status='completed'
        )
        prev_revenue = prev_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
    else:
        prev_revenue = 0
    revenue_growth = 0
    if prev_revenue > 0:
        revenue_growth = round(((total_revenue_tokens - prev_revenue) / prev_revenue) * 100, 1)

    # Tokens allocated for cycle: actual credited records from TokenDistribution or TokenResetApproval
    cycle_tokens_allocated = TokenDistribution.objects.filter(
        allocation_month=cycle_start
    ).aggregate(total=Sum('tokens_allocated'))['total'] or 0

    approval = TokenResetApproval.objects.filter(cycle_month=cycle_start, status='approved').first()
    if cycle_tokens_allocated == 0 and approval and approval.distributed_tokens > 0:
        cycle_tokens_allocated = approval.distributed_tokens

    # Calculate proposed quota for reference
    active_users = CustomUser.objects.filter(role__in=['employee', 'guest'], is_deleted=False)
    proposed_tokens_allocated = 0
    for u in active_users:
        s = (u.work_shift or 'day').replace('_shift', '')
        proposed_tokens_allocated += get_shift_monthly_quota(s, cycle_start)

    cycle_tokens_remaining = active_users.aggregate(total=Sum('monthly_tokens'))['total'] or 0

    burn_rate = round(total_revenue_tokens / max(1, cycle_info['days_elapsed']), 1)
    projected_revenue = round(burn_rate * cycle_info['total_days'])
    
    util_base = cycle_tokens_allocated if cycle_tokens_allocated > 0 else proposed_tokens_allocated
    utilization_pct = round((total_revenue_tokens / max(1, util_base)) * 100, 1) if util_base > 0 else 0

    # Daily revenue series from cycle_start to target_date
    daily_aggregates = {
        row['created_at__date']: {
            'tokens': row['tokens'] or 0,
            'count': row['count']
        }
        for row in completed_orders.values('created_at__date').annotate(
            tokens=Sum('total_tokens'),
            count=Count('id')
        )
    }

    daily_series = []
    curr = cycle_start
    cum_tokens = 0
    while curr <= target_date:
        entry = daily_aggregates.get(curr, {'tokens': 0, 'count': 0})
        tokens_val = int(entry['tokens'])
        cum_tokens += tokens_val
        daily_series.append({
            'date': curr.isoformat(),
            'label': curr.strftime('%b %d'),
            'tokens': tokens_val,
            'orders': entry['count'],
            'cumulative_tokens': cum_tokens
        })
        curr += timedelta(days=1)

    # Shift-wise breakdown (diners, allocated, spent, balance, utilization)
    shift_analytics = {}
    for shift_key in ['day', 'mid', 'night']:
        shift_users = CustomUser.objects.filter(role__in=['employee', 'guest'], work_shift=shift_key, is_deleted=False).count()
        s_orders = completed_orders.filter(user__work_shift=shift_key)
        s_spent = s_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
        s_count = s_orders.count()
        
        # Shift allocation from actual distribution if available, otherwise approval/quota
        s_dist = TokenDistribution.objects.filter(
            allocation_month=cycle_start,
            user__work_shift=shift_key
        ).aggregate(total=Sum('tokens_allocated'))['total'] or 0
        if s_dist > 0:
            s_allocated = s_dist
        elif approval and approval.draft_quotas and shift_key in approval.draft_quotas:
            s_allocated = approval.draft_quotas[shift_key] * shift_users
        else:
            s_quota = get_shift_monthly_quota(shift_key, cycle_start)
            s_allocated = s_quota * shift_users

        s_balance = CustomUser.objects.filter(
            role__in=['employee', 'guest'],
            work_shift=shift_key,
            is_deleted=False
        ).aggregate(total=Sum('monthly_tokens'))['total'] or 0

        shift_analytics[shift_key] = {
            'users': shift_users,
            'allocated': int(s_allocated),
            'spent': int(s_spent),
            'balance': int(s_balance),
            'orders': s_count,
            'utilization': round((s_spent / max(1, s_allocated)) * 100, 1) if s_allocated > 0 else 0
        }

    # Food Category & Dietary Breakdown
    order_items = OrderItem.objects.filter(order__in=completed_orders).select_related('menu_item')
    categories = {
        'meal': {'tokens': 0, 'count': 0, 'label': 'Meals'},
        'snack': {'tokens': 0, 'count': 0, 'label': 'Snacks'},
        'beverage': {'tokens': 0, 'count': 0, 'label': 'Beverages'}
    }
    dietary = {
        'veg': {'tokens': 0, 'count': 0, 'label': 'Vegetarian'},
        'non_veg': {'tokens': 0, 'count': 0, 'label': 'Non-Vegetarian'}
    }
    
    item_stats = {}
    for item in order_items:
        cat = getattr(item.menu_item, 'category', 'meal') or 'meal'
        if cat not in categories:
            categories[cat] = {'tokens': 0, 'count': 0, 'label': cat.capitalize()}
        categories[cat]['tokens'] += item.total_tokens
        categories[cat]['count'] += item.quantity

        is_veg = getattr(item.menu_item, 'is_veg', True)
        diet_key = 'veg' if is_veg else 'non_veg'
        dietary[diet_key]['tokens'] += item.total_tokens
        dietary[diet_key]['count'] += item.quantity

        m_name = item.menu_item.name
        if m_name not in item_stats:
            item_stats[m_name] = {
                'name': m_name,
                'category': cat,
                'is_veg': is_veg,
                'count': 0,
                'tokens': 0
            }
        item_stats[m_name]['count'] += item.quantity
        item_stats[m_name]['tokens'] += item.total_tokens

    top_items = sorted(item_stats.values(), key=lambda x: x['tokens'], reverse=True)[:10]

    # Token Utilization non-overlapping tiers for active employees
    user_spends = {
        row['user_id']: row['spent'] or 0
        for row in completed_orders.values('user_id').annotate(spent=Sum('total_tokens'))
    }
    dist_map = {
        dist.user_id: dist.tokens_allocated
        for dist in TokenDistribution.objects.filter(allocation_month=cycle_start)
    }
    tiers = {
        'low_0_25': 0,
        'mid_26_50': 0,
        'high_51_75': 0,
        'max_76_100': 0,
        # Backward compatibility aliases
        'mid_25_50': 0,
        'high_50_75': 0,
        'max_75_100': 0,
    }
    for u in active_users:
        u_spent = user_spends.get(u.id, 0)
        u_alloc = dist_map.get(u.id)
        if not u_alloc or u_alloc == 0:
            u_alloc = get_shift_monthly_quota(u.work_shift or 'day', cycle_start)
        pct = (u_spent / max(1, u_alloc)) * 100
        if pct <= 25:
            tiers['low_0_25'] += 1
        elif pct <= 50:
            tiers['mid_26_50'] += 1
            tiers['mid_25_50'] += 1
        elif pct <= 75:
            tiers['high_51_75'] += 1
            tiers['high_50_75'] += 1
        else:
            tiers['max_76_100'] += 1
            tiers['max_75_100'] += 1

    past_metrics = get_past_cycle_token_metrics(target_date)

    return Response({
        'cycle_info': {
            'cycle_start': cycle_start.isoformat(),
            'cycle_end': cycle_end.isoformat() if cycle_end else None,
            'cycle_label': cycle_info.get('cycle_label', f"{cycle_start.strftime('%d %b %Y')} – {cycle_end.strftime('%d %b %Y')}"),
            'next_allocation_date': next_allocation_date.isoformat() if next_allocation_date else None,
            'last_token_allocated_date': last_alloc_date.isoformat() if last_alloc_date else None,
            'has_past_reset': has_past or (last_alloc_date is not None),
            'current_date': target_date.isoformat(),
            'days_elapsed': cycle_info['days_elapsed'],
            'total_days': cycle_info['total_days'],
            'days_remaining': cycle_info['days_remaining'],
            'allocation_day': cycle_info['allocation_day'],
            'total_revenue_tokens': int(total_revenue_tokens),
            'total_orders_count': total_orders_count,
            'tokens_allocated': int(cycle_tokens_allocated),
            'proposed_tokens_allocated': int(proposed_tokens_allocated),
            'tokens_remaining': int(cycle_tokens_remaining),
            'past_cycle_spent': int(past_metrics.get('past_total_spent', 0)),
            'past_cycle_allocated': int(past_metrics.get('past_total_allocated', 0)),
            'past_cycle_unused': int(past_metrics.get('current_unused_total', 0)),
            'burn_rate': burn_rate,
            'projected_revenue': projected_revenue,
            'utilization_pct': utilization_pct,
            'prev_revenue': int(prev_revenue),
            'revenue_growth': revenue_growth,
        },
        'daily_series': daily_series,
        'shift_analytics': shift_analytics,
        'category_analytics': categories,
        'dietary_analytics': dietary,
        'top_items': top_items,
        'utilization_tiers': tiers
    })


# Dedicated Staff Admin Dashboard View: STRICTLY CAFETERIA TRANSACTIONS ONLY
@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
def staff_admin_dashboard_view(request):
    """
    Dedicated dashboard for Staff Admin showing STRICTLY Cafeteria Transactions
    and cafeteria operational analytics (food orders, revenue, dish volume, rush curves).
    No access to token distribution or company payroll balances.
    """
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = timezone.now().astimezone(kolkata_tz)
    today = now_kolkata.date()

    kitchen = request.user.get_kitchen() if request.user.role == 'staff_admin' else None

    today_orders = Order.objects.filter(created_at__date=today).select_related('user').prefetch_related('order_items__menu_item')
    if kitchen:
        today_orders = today_orders.filter(kitchen=kitchen)
    
    # Today's transaction status counts
    queue_counts = {
        'pending': today_orders.filter(status='pending').count(),
        'approved': today_orders.filter(status='approved').count(),
        'completed': today_orders.filter(status='completed').count(),
        'declined': today_orders.filter(status='declined').count(),
        'cancelled': today_orders.filter(status='cancelled').count(),
        'total': today_orders.count()
    }

    # Revenue from completed cafeteria orders today
    completed_today = today_orders.filter(status='completed')
    today_tokens_revenue = completed_today.aggregate(total=Sum('total_tokens'))['total'] or 0

    # Total dishes served today
    today_items = OrderItem.objects.filter(order__in=completed_today).select_related('menu_item')
    today_dishes_served = today_items.aggregate(total=Sum('quantity'))['total'] or 0

    # Past 7 days completed cafeteria transactions tokens
    week_start = today - timedelta(days=6)
    week_orders = Order.objects.filter(created_at__date__gte=week_start, created_at__date__lte=today, status='completed')
    if kitchen:
        week_orders = week_orders.filter(kitchen=kitchen)
    week_tokens_revenue = week_orders.aggregate(total=Sum('total_tokens'))['total'] or 0

    # Shift-wise order counts today
    shift_breakdown = {
        'day': completed_today.filter(user__work_shift='day').count(),
        'mid': completed_today.filter(user__work_shift='mid').count(),
        'night': completed_today.filter(user__work_shift='night').count(),
    }

    # Food category breakdown today
    categories = {'meal': 0, 'snack': 0, 'beverage': 0}
    for item in today_items:
        cat = getattr(item.menu_item, 'category', 'meal') or 'meal'
        categories[cat] = categories.get(cat, 0) + item.quantity

    # Top 5 cafeteria dishes today
    dish_map = {}
    for item in today_items:
        name = item.menu_item.name
        if name not in dish_map:
            dish_map[name] = {
                'name': name,
                'category': getattr(item.menu_item, 'category', 'meal'),
                'is_veg': getattr(item.menu_item, 'is_veg', True),
                'quantity': 0,
                'tokens': 0
            }
        dish_map[name]['quantity'] += item.quantity
        dish_map[name]['tokens'] += item.total_tokens
    top_dishes = sorted(dish_map.values(), key=lambda x: x['quantity'], reverse=True)[:5]

    # Multi-threaded hourly cafeteria rush distribution today (hours 8 to 22)
    def _fetch_hour_rush(h):
        try:
            h_orders = completed_today.filter(created_at__hour=h)
            h_tokens = h_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
            return {
                'h': h,
                'hour': f"{h:02d}:00",
                'orders': h_orders.count(),
                'tokens': int(h_tokens)
            }
        finally:
            if not connection.in_atomic_block:
                connection.close()

    if connection.in_atomic_block:
        rush_data = [_fetch_hour_rush(h) for h in range(8, 23)]
    else:
        with ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as executor:
            rush_data = list(executor.map(_fetch_hour_rush, range(8, 23)))
    rush_data.sort(key=lambda x: x['h'])
    hourly_rush = [{'hour': item['hour'], 'orders': item['orders'], 'tokens': item['tokens']} for item in rush_data]

    # Recent 50 live cafeteria transactions
    recent_transactions = []
    recent_orders_qs = Order.objects.select_related('user').prefetch_related('order_items__menu_item')
    if kitchen:
        recent_orders_qs = recent_orders_qs.filter(kitchen=kitchen)
    recent_orders = recent_orders_qs.order_by('-created_at')[:50]
    for o in recent_orders:
        items_desc = [
            f"{it.quantity}x {it.menu_item.name} ({'Veg' if getattr(it.menu_item, 'is_veg', True) else 'Non-Veg'})"
            for it in o.order_items.all()
        ]
        recent_transactions.append({
            'id': o.id,
            'created_at': o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M:%S'),
            'user_id': o.user.user_id or '',
            'username': o.user.username,
            'customer_name': o.user.get_full_name() or o.user.username,
            'role': o.user.role,
            'work_shift': o.user.work_shift,
            'total_tokens': o.total_tokens,
            'status': o.status,
            'items': items_desc,
            'items_count': sum(it.quantity for it in o.order_items.all())
        })

    return Response({
        'today_date': today.isoformat(),
        'today_tokens_revenue': int(today_tokens_revenue),
        'today_orders_count': completed_today.count(),
        'today_dishes_served': int(today_dishes_served),
        'week_tokens_revenue': int(week_tokens_revenue),
        'queue_counts': queue_counts,
        'shift_breakdown': shift_breakdown,
        'category_breakdown': categories,
        'top_dishes': top_dishes,
        'hourly_rush': hourly_rush,
        'live_transactions': recent_transactions
    })


# Update password view (for authenticated users)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_password_view(request):
    """Update user password for logged-in employee, staff, guest, or admin"""
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')
    
    if not old_password or not new_password:
        return Response(
            {'error': 'Both current password and new password are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if old password is correct
    if not user.check_password(old_password):
        return Response(
            {'error': 'Current password is incorrect'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate new password length
    if len(new_password) < 6:
        return Response(
            {'error': 'New password must be at least 6 characters long'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    if confirm_password and new_password != confirm_password:
        return Response(
            {'error': 'New password and confirmation do not match'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if old_password == new_password:
        return Response(
            {'error': 'New password must be different from current password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update password
    user.set_password(new_password)
    user.save()
    
    return Response({
        'status': 'success',
        'message': 'Password updated successfully!'
    })


# Self-service Password Reset view (for employees and staff)
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAttemptThrottle])
@ensure_csrf_cookie
def reset_password_view(request):
    """
    Public self-service password reset.

    The new password is only applied when a Super Admin has approved the
    account's reset request (CustomUser.password_reset_allowed). Every other
    outcome - unknown identifier, wrong email, admin account, no approval -
    returns the identical generic response, so the endpoint cannot be used to
    probe which accounts exist.
    """
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)

    identifier = (request.data.get('identifier') or request.data.get('username') or request.data.get('user_id') or '').strip()
    email = (request.data.get('email') or '').strip()
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not identifier:
        return Response({'error': 'Please enter your Username or Employee/Staff ID'}, status=status.HTTP_400_BAD_REQUEST)
    if not email:
        return Response({'error': 'Please enter your registered Email address'}, status=status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({'error': 'Please enter a new password'}, status=status.HTTP_400_BAD_REQUEST)
    if confirm_password and new_password != confirm_password:
        return Response({'error': 'New password and confirm password do not match'}, status=status.HTTP_400_BAD_REQUEST)

    # Password strength is validated before any account lookup, so a weak
    # password never reveals whether the account exists.
    try:
        validate_password(new_password, None)
    except DjangoValidationError as exc:
        return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    generic = {
        'status': 'received',
        'message': 'If this account is eligible for a password reset, the new password has been applied. Please sign in with it.',
    }

    user = CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(user_id__iexact=identifier),
        is_deleted=False,
    ).first()

    if not user or user.role == 'admin' or user.is_superuser:
        return Response(generic, status=status.HTTP_202_ACCEPTED)
    if not user.email or user.email.lower() != email.lower():
        return Response(generic, status=status.HTTP_202_ACCEPTED)
    if not user.password_reset_allowed:
        return Response(generic, status=status.HTTP_202_ACCEPTED)

    with transaction.atomic():
        if not user.consume_password_reset_permission(new_password):
            return Response(generic, status=status.HTTP_202_ACCEPTED)
        latest = PasswordResetRequest.objects.filter(user=user, status='approved').first()
        if latest:
            latest.mark_consumed(ip_address=request.META.get('REMOTE_ADDR'))

    return Response(generic, status=status.HTTP_202_ACCEPTED)


# Submit Password Reset Request (Requires Admin Approval)
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAttemptThrottle])
@ensure_csrf_cookie
def submit_password_reset_request(request):
    """
    Public endpoint to request a password reset. The request goes to a Super
    Admin for approval. The response is identical for every outcome so it
    cannot be used to enumerate accounts, and it never reveals a password.
    """
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)

    identifier = (request.data.get('identifier') or request.data.get('username') or request.data.get('user_id') or '').strip()
    email = (request.data.get('email') or '').strip()
    reason = (request.data.get('reason') or '').strip()

    if not identifier:
        return Response({'error': 'Please enter your Username or Employee/Staff ID'}, status=status.HTTP_400_BAD_REQUEST)
    if not email:
        return Response({'error': 'Please enter your registered Email address'}, status=status.HTTP_400_BAD_REQUEST)

    generic = {
        'status': 'received',
        'message': 'If this account exists and is eligible, the request has been submitted for review.',
    }

    user = CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(user_id__iexact=identifier),
        is_deleted=False,
    ).first()

    if not user or user.role == 'admin' or user.is_superuser:
        return Response(generic, status=status.HTTP_202_ACCEPTED)
    if not user.email or user.email.lower() != email.lower():
        return Response(generic, status=status.HTTP_202_ACCEPTED)

    PasswordResetRequest.objects.filter(user=user, status='pending').delete()
    PasswordResetRequest.objects.create(user=user, reason=reason, status='pending')

    return Response(generic, status=status.HTTP_202_ACCEPTED)


# Admin Password Reset Requests ViewSet
class AdminPasswordResetViewSet(viewsets.ModelViewSet):
    """ViewSet for Super Admin to view, approve, and reject password reset requests"""
    queryset = PasswordResetRequest.objects.select_related('user', 'reviewed_by').all()
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return PasswordResetRequest.objects.select_related('user', 'reviewed_by').all()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the request. The password is never set or revealed here -
        the user receives a one-time permission to choose their own password."""
        reset_req = self.get_object()
        if reset_req.status != 'pending':
            return Response(
                {'error': f'Cannot approve request that is already {reset_req.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reset_req.approve(request.user)
        return Response({
            'status': 'success',
            'message': f'Approved. {reset_req.user.username} can now set a new password from the reset page.',
            'user_id': reset_req.user.user_id,
            'username': reset_req.user.username
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject password reset request"""
        reset_req = self.get_object()
        if reset_req.status != 'pending':
            return Response(
                {'error': f'Cannot reject request that is already {reset_req.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        notes = request.data.get('notes', '')
        reset_req.reject(request.user, notes)
        return Response({
            'status': 'success',
            'message': f'Password reset request for {reset_req.user.username} has been rejected.'
        })


# Early Order Cancellation
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_order_view(request, order_id):
    """
    Allows user (or staff/admin) to cancel an order early if status is 'pending'.
    Restores tokens immediately and records cancellation details.
    """
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': f'Order #{order_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Permission check: must be owner (employee or guest) or staff/admin
        if order.user != request.user and request.user.role not in ['admin', 'staff', 'staff_admin'] and not request.user.is_superuser:
            return Response({'error': 'You do not have permission to cancel this order.'}, status=status.HTTP_403_FORBIDDEN)

        if order.status != 'pending':
            return Response(
                {'error': f'Order #{order.id} cannot be cancelled because its status is "{order.status}". Only pending orders can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'Cancelled by user').strip()

        order.status = 'cancelled'
        order.cancelled_at = timezone.now()
        order.cancelled_by = request.user
        order.cancellation_reason = reason
        refunded = order.refund_tokens()
        order.save()

    return Response({
        'status': 'cancelled',
        'message': f'Order #{order.id} has been cancelled successfully. {order.total_tokens} tokens have been refunded.',
        'order_id': order.id,
        'tokens_refunded': refunded,
        'current_balance': order.user.current_tokens()
    })


# Canteen Settings
@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([IsStaffAdminOrAdmin])
def canteen_settings_view(request):
    setting = CanteenSetting.get_settings()
    if request.method == 'GET':
        serializer = CanteenSettingSerializer(setting)
        return Response(serializer.data)

    if request.user.role != 'admin' and not request.user.is_superuser:
        return Response(
            {'error': 'Only Super Admin can modify canteen limit and shift settings.'},
            status=status.HTTP_403_FORBIDDEN
        )

    prev_mode = setting.monthly_token_allocation_mode
    serializer = CanteenSettingSerializer(setting, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    updated_setting = serializer.save(updated_by=request.user)

    if 'monthly_token_allocation_mode' in request.data and updated_setting.monthly_token_allocation_mode != prev_mode:
        cycle_info = get_billing_cycle_dates()
        TokenAllocationAuditLog.objects.create(
            event_type='mode_change',
            billing_cycle_start=cycle_info['cycle_start'],
            billing_cycle_end=cycle_info['cycle_end'],
            performed_by=request.user,
            details={'previous_mode': prev_mode, 'new_mode': updated_setting.monthly_token_allocation_mode},
            notes=f"Monthly token allocation mode changed from {prev_mode} to {updated_setting.monthly_token_allocation_mode} by {request.user.username}"
        )

    return Response(serializer.data)


# Financial Ledger Management
class FinancialTransactionViewSet(viewsets.ModelViewSet):
    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Financial ledger transactions cannot be deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    queryset = FinancialTransaction.objects.all().order_by('-created_at')
    serializer_class = FinancialTransactionSerializer
    permission_classes = [IsStaffAdminOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        tx_type = self.request.query_params.get('transaction_type')
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(notes__icontains=search) |
                Q(payment_reference__icontains=search) |
                Q(user__username__icontains=search) |
                Q(user__user_id__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        total_tokens = qs.aggregate(total=Sum('amount_tokens'))['total'] or qs.aggregate(total=Sum('amount_inr'))['total'] or 0
        payments = qs.filter(transaction_type='manual_payment').aggregate(total=Sum('amount_tokens'))['total'] or qs.filter(transaction_type='manual_payment').aggregate(total=Sum('amount_inr'))['total'] or 0
        order_debits = qs.filter(transaction_type='order_debit').aggregate(total=Sum('amount_tokens'))['total'] or qs.filter(transaction_type='order_debit').aggregate(total=Sum('amount_inr'))['total'] or 0
        refunds = qs.filter(transaction_type='refund').aggregate(total=Sum('amount_tokens'))['total'] or qs.filter(transaction_type='refund').aggregate(total=Sum('amount_inr'))['total'] or 0
        count = qs.count()
        return Response({
            'total_transactions': count,
            'total_volume_tokens': int(total_tokens),
            'manual_payments_tokens': int(payments),
            'order_debits_tokens': int(order_debits),
            'refunds_tokens': int(refunds),
            # Backwards-compatible aliases
            'total_volume_inr': float(total_tokens),
            'manual_payments_inr': float(payments),
            'order_debits_inr': float(order_debits),
            'refunds_inr': float(refunds),
        })


# Company Billing & Settlement
class CompanyBillViewSet(viewsets.ModelViewSet):
    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Company bills cannot be deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    queryset = CompanyBill.objects.all().order_by('-billing_period_end')
    serializer_class = CompanyBillSerializer
    permission_classes = [IsStaffAdminOrAdmin]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate company bill for a billing cycle (configured token reset day of prev month to day prior of target month)
        in Asia/Kolkata timezone.
        """
        kolkata_tz = ZoneInfo("Asia/Kolkata")
        now_kolkata = timezone.now().astimezone(kolkata_tz)

        year = int(request.data.get('year', now_kolkata.year))
        month = int(request.data.get('month', now_kolkata.month))

        start_date_req = request.data.get('start_date') or request.data.get('billing_period_start')
        end_date_req = request.data.get('end_date') or request.data.get('billing_period_end')

        if start_date_req and end_date_req:
            try:
                period_start = date.fromisoformat(str(start_date_req))
                period_end = date.fromisoformat(str(end_date_req))
            except (ValueError, TypeError):
                period_start = None
                period_end = None
        else:
            period_start = None
            period_end = None

        if not period_start or not period_end:
            if year == now_kolkata.year and month == now_kolkata.month:
                c_info = get_billing_cycle_dates(now_kolkata.date())
                period_start = c_info['cycle_start']
                period_end = c_info['cycle_end']
            else:
                c_info = get_billing_cycle_dates(date(year, month, 1))
                period_start = c_info['cycle_start']
                period_end = c_info['cycle_end']

        orders = Order.objects.filter(
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
            status='completed'
        )

        total_orders = orders.count()
        total_tokens = orders.aggregate(total=Sum('total_tokens'))['total'] or 0
        inr_aggregate = orders.aggregate(total=Sum('total_amount_inr'))['total'] or 0.00
        total_amount = round(float(inr_aggregate), 2)

        bill, created = CompanyBill.objects.update_or_create(
            bill_number=f'VDART-BILL-{year}{month:02d}',
            defaults={
                'billing_period_start': period_start,
                'billing_period_end': period_end,
                'total_orders_count': total_orders,
                'total_tokens_spent': total_tokens,
                'total_tokens_billed': total_tokens,
                'outstanding_tokens': total_tokens,
                'total_amount_inr': total_amount,
                'outstanding_inr': total_amount,
                'status': 'generated',
                'generated_by': request.user,
                'notes': request.data.get('notes', f'Audit billing cycle: {period_start} to {period_end}')
            }
        )

        serializer = self.get_serializer(bill)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        bill = self.get_object()
        payment_amount = float(request.data.get('amount') or bill.outstanding_tokens or bill.outstanding_inr or bill.total_tokens_spent or bill.total_amount_inr)
        ref = request.data.get('payment_reference', '').strip()
        method = request.data.get('payment_method', 'token_transfer')

        bill.total_tokens_settled = int(bill.total_tokens_settled or 0) + int(payment_amount)
        bill.outstanding_tokens = max(0, int(bill.total_tokens_spent or 0) - int(bill.total_tokens_settled))
        bill.total_paid_inr = float(bill.total_paid_inr or 0.0) + payment_amount
        bill.outstanding_inr = max(0.0, float(bill.total_amount_inr or 0.0) - float(bill.total_paid_inr))
        if bill.outstanding_tokens <= 0 and bill.outstanding_inr <= 0:
            bill.status = 'paid'
        else:
            bill.status = 'partially_paid'
        bill.save()

        # Create FinancialTransaction entry in tokens
        FinancialTransaction.objects.create(
            company_bill=bill,
            transaction_type='manual_payment',
            amount_tokens=int(payment_amount),
            amount_inr=payment_amount,
            payment_method=method,
            payment_reference=ref or bill.bill_number,
            notes=f'Token settlement towards Company Bill {bill.bill_number}',
            created_by=request.user
        )

        return Response({
            'status': 'success',
            'message': f'Settlement of {int(payment_amount)} tokens recorded for {bill.bill_number}.',
            'bill': self.get_serializer(bill).data
        })


# Monthly Audit & Pre-Allocation Report (Total Transactions Details + Token Allocated Details)
@api_view(['GET'])
@permission_classes([IsStaffAdminOrAdmin])
@renderer_classes([CSVExportRenderer, XLSXExportRenderer, PDFExportRenderer, JSONRenderer])
def audit_export_view(request):
    """
    Exports full monthly audit data for the cycle (configured token reset day prev month -> day prior current month).
    Generates:
      1. Executive Analytics & Summary
      2. Token Allocated Details (per employee/guest)
      3. Total Transactions Details (itemized order ledger)
    Supports xlsx (multi-sheet), csv, pdf, and json formats.
    Sanitizes against CSV/formula injection.
    """
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = timezone.now().astimezone(kolkata_tz)

    query_params = getattr(request, 'query_params', request.GET)
    year = int(query_params.get('year', now_kolkata.year))
    month = int(query_params.get('month', now_kolkata.month))
    fmt = (query_params.get('export_format') or query_params.get('format') or 'csv').lower()
    report_type = (query_params.get('report_type') or 'all').lower()

    if month == 1:
        prev_year = year - 1
        prev_month = 12
    else:
        prev_year = year
        prev_month = month - 1

    start_date_param = query_params.get('start_date')
    end_date_param = query_params.get('end_date')
    cycle_param = query_params.get('cycle')

    has_custom_range = bool(start_date_param and end_date_param)
    has_custom_month = ('year' in query_params and 'month' in query_params)

    if cycle_param and cycle_param not in ('current', 'all'):
        try:
            target_dt = date.fromisoformat(cycle_param)
            c_info = get_billing_cycle_dates(target_dt)
            period_start = c_info['cycle_start']
            period_end = c_info['cycle_end']
        except ValueError:
            c_info = get_billing_cycle_dates(now_kolkata.date())
            period_start = c_info['cycle_start']
            period_end = c_info['cycle_end']
    elif cycle_param == 'current' or (not cycle_param and not has_custom_range and not has_custom_month):
        c_info = get_billing_cycle_dates(now_kolkata.date())
        period_start = c_info['cycle_start']
        period_end = c_info['cycle_end']
    elif start_date_param and end_date_param:
        try:
            period_start = date.fromisoformat(start_date_param)
            period_end = date.fromisoformat(end_date_param)
            c_info = get_billing_cycle_dates(period_start)
        except ValueError:
            c_info = get_billing_cycle_dates(now_kolkata.date())
            period_start = c_info['cycle_start']
            period_end = c_info['cycle_end']
    else:
        if year == now_kolkata.year and month == now_kolkata.month:
            c_info = get_billing_cycle_dates(now_kolkata.date())
            period_start = c_info['cycle_start']
            period_end = c_info['cycle_end']
        else:
            c_info = get_billing_cycle_dates(date(year, month, 1))
            period_start = c_info['cycle_start']
            period_end = c_info['cycle_end']

    cycle_approval = TokenResetApproval.objects.filter(cycle_month=period_start, status='approved').first()
    if not cycle_approval:
        cycle_approval = TokenResetApproval.objects.filter(status='approved').order_by('-cycle_month').first()

    reset_day = c_info.get('allocation_day', 20)
    actual_reset_date = cycle_approval.reset_date if (cycle_approval and cycle_approval.reset_date) else None
    reset_date_str = actual_reset_date.strftime('%d %b %Y') if actual_reset_date else 'Scheduled on Reset Day'
    approved_by_user = cycle_approval.approved_by.username if (cycle_approval and cycle_approval.approved_by) else 'Administrator'

    orders = Order.objects.filter(
        created_at__date__gte=period_start,
        created_at__date__lte=period_end
    ).select_related('user').prefetch_related('order_items__menu_item').order_by('created_at')

    # Apply query filters for shift, status, and search
    shift_param = (query_params.get('shift') or '').strip().lower()
    status_param = (query_params.get('status') or '').strip().lower()
    search_param = (query_params.get('search') or query_params.get('q') or '').strip()

    if shift_param and shift_param != 'all':
        norm_shift = shift_param.replace('_shift', '')
        orders = orders.filter(user__work_shift=norm_shift)

    if status_param and status_param != 'all':
        orders = orders.filter(status=status_param)

    if search_param:
        from django.db.models import Q
        orders = orders.filter(
            Q(user__username__icontains=search_param) |
            Q(user__user_id__icontains=search_param) |
            Q(user__first_name__icontains=search_param) |
            Q(user__last_name__icontains=search_param) |
            Q(id__icontains=search_param)
        )

    completed_orders = orders.filter(status='completed')

    # Formula injection defense helper
    def sanitize(val):
        s = str(val if val is not None else '')
        if s.startswith(('=', '+', '-', '@', '\t', '\r')):
            return f"'{s}"
        return s

    # 1. Calculate Token Allocation details for all active diners in this cycle
    active_users = CustomUser.objects.filter(
        role__in=['employee', 'guest'],
        is_deleted=False
    ).order_by('work_shift', 'username')

    if shift_param and shift_param != 'all':
        active_users = active_users.filter(work_shift=shift_param.replace('_shift', ''))

    if search_param:
        from django.db.models import Q
        active_users = active_users.filter(
            Q(username__icontains=search_param) |
            Q(user_id__icontains=search_param) |
            Q(first_name__icontains=search_param) |
            Q(last_name__icontains=search_param)
        )

    user_order_stats = {
        row['user_id']: {
            'spent': row['spent'] or 0,
            'orders_count': row['count']
        }
        for row in completed_orders.values('user_id').annotate(
            spent=Sum('total_tokens'),
            count=Count('id')
        )
    }

    dist_map = {
        dist.user_id: dist.tokens_allocated
        for dist in TokenDistribution.objects.filter(
            allocation_month=period_start
        )
    }

    token_allocations_data = []
    total_tokens_allocated = 0
    total_tokens_spent = 0
    total_tokens_remaining = 0

    for u in active_users:
        shift_key = (u.work_shift or 'day').replace('_shift', '')
        alloc = dist_map.get(u.id)
        if alloc is None or alloc == 0:
            alloc = get_shift_monthly_quota(shift_key, period_start)
        
        u_stats = user_order_stats.get(u.id, {'spent': 0, 'orders_count': 0})
        u_spent = int(u_stats['spent'])
        u_rem = max(0, u.monthly_tokens)
        u_orders_count = u_stats['orders_count']
        u_util = round((u_spent / max(1, alloc)) * 100, 1) if alloc > 0 else 0

        total_tokens_allocated += alloc
        total_tokens_spent += u_spent
        total_tokens_remaining += u_rem

        token_allocations_data.append({
            'user_id': u.user_id or '',
            'username': u.username,
            'name': u.get_full_name() or u.username,
            'role': u.role,
            'shift': u.work_shift,
            'tokens_allocated': alloc,
            'tokens_spent': u_spent,
            'tokens_remaining': u_rem,
            'orders_count': u_orders_count,
            'utilization_pct': u_util
        })

    # Summary metrics
    overall_utilization = round((total_tokens_spent / max(1, total_tokens_allocated)) * 100, 1) if total_tokens_allocated > 0 else 0
    shift_summary = {}
    for sk in ['day', 'mid', 'night']:
        s_users = [row for row in token_allocations_data if row['shift'] == sk]
        s_alloc = sum(r['tokens_allocated'] for r in s_users)
        s_spent = sum(r['tokens_spent'] for r in s_users)
        s_orders = sum(r['orders_count'] for r in s_users)
        shift_summary[sk] = {
            'users_count': len(s_users),
            'allocated': s_alloc,
            'spent': s_spent,
            'orders_count': s_orders,
            'utilization': round((s_spent / max(1, s_alloc)) * 100, 1) if s_alloc > 0 else 0
        }

    # Food Category breakdown
    order_items_qs = OrderItem.objects.filter(order__in=completed_orders).select_related('menu_item')
    category_summary = {'meal': {'count': 0, 'tokens': 0}, 'snack': {'count': 0, 'tokens': 0}, 'beverage': {'count': 0, 'tokens': 0}}
    for it in order_items_qs:
        cat = getattr(it.menu_item, 'category', 'meal') or 'meal'
        if cat not in category_summary:
            category_summary[cat] = {'count': 0, 'tokens': 0}
        category_summary[cat]['count'] += it.quantity
        category_summary[cat]['tokens'] += it.total_tokens

    if fmt == 'json':
        transactions_data = []
        for o in orders:
            transactions_data.append({
                'order_id': o.id,
                'date': o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M:%S'),
                'username': o.user.username,
                'name': o.user.get_full_name() or o.user.username,
                'user_id': o.user.user_id or '',
                'role': o.user.role,
                'shift': o.user.work_shift,
                'status': o.status,
                'total_tokens': o.total_tokens,
                'items_count': sum(it.quantity for it in o.order_items.all()),
                'items': [
                    {
                        'item': item.menu_item.name,
                        'qty': item.quantity,
                        'is_veg': getattr(item.menu_item, 'is_veg', True),
                        'food_type': getattr(item.menu_item, 'food_type', 'veg'),
                        'tokens': item.tokens_per_item
                    } for item in o.order_items.all()
                ]
            })

        # Available cycles: past 12 cycles from current date
        avail_cycles = []
        cur_cycle = get_billing_cycle_dates(now_kolkata.date())
        temp_date = cur_cycle['cycle_start']
        for _ in range(12):
            c_info_item = get_billing_cycle_dates(temp_date)
            avail_cycles.append({
                'cycle_start': c_info_item['cycle_start'].isoformat(),
                'cycle_end': c_info_item['cycle_end'].isoformat(),
                'cycle_label': c_info_item.get('cycle_label', f"{c_info_item['cycle_start'].strftime('%d %b %Y')} – {c_info_item['cycle_end'].strftime('%d %b %Y')}"),
                'is_current': c_info_item['cycle_start'] == cur_cycle['cycle_start']
            })
            temp_date = c_info_item['prev_cycle_start']

        return Response({
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(),
            'token_reset_day': reset_day,
            'actual_reset_date': actual_reset_date.isoformat() if actual_reset_date else None,
            'reset_status': cycle_approval.status if cycle_approval else 'pending',
            'approved_by': approved_by_user,
            'timezone': 'Asia/Kolkata',
            'summary': {
                'total_tokens_allocated': total_tokens_allocated,
                'total_tokens_spent': total_tokens_spent,
                'total_tokens_remaining': total_tokens_remaining,
                'overall_utilization_pct': overall_utilization,
                'orders_count': orders.count(),
                'completed_orders_count': completed_orders.count(),
                'active_diners_count': len(token_allocations_data),
                'shift_summary': shift_summary,
                'category_summary': category_summary,
                'token_reset_day': reset_day,
                'actual_reset_date': actual_reset_date.strftime('%Y-%m-%d') if actual_reset_date else None,
                'approved_by': approved_by_user,
            },
            'token_allocations': token_allocations_data,
            'orders_count': len(transactions_data),
            'orders': transactions_data,
            'transactions': transactions_data,
            'available_cycles': avail_cycles
        })

    elif fmt == 'xlsx':
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb = Workbook()

        # Styles
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        sub_header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
        title_font = Font(name="Calibri", size=16, bold=True, color="1E3A8A")
        subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
        bold_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
        regular_font = Font(name="Calibri", size=10, color="0F172A")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )
        zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        # -------------------------------------------------------------
        # SHEET 1: Executive Analytics & Summary
        # -------------------------------------------------------------
        ws_sum = wb.active
        ws_sum.title = "Executive Summary"
        ws_sum.views.sheetView[0].showGridLines = True

        ws_sum["A1"] = "VDart Cafe — Monthly Executive Analytics & Token Audit"
        ws_sum["A1"].font = title_font
        ws_sum["A2"] = f"Cycle Period: {period_start.strftime('%d %b %Y')} to {period_end.strftime('%d %b %Y')} (Token Reset Day: {reset_day}) | Actual Reset Date: {reset_date_str} | Approved By: {approved_by_user} | Generated: {now_kolkata.strftime('%Y-%m-%d %H:%M:%S IST')}"
        ws_sum["A2"].font = subtitle_font

        # Key Metrics Table
        ws_sum["A4"] = "KEY REVENUE & TOKEN METRICS"
        ws_sum["A4"].font = bold_font

        kpi_headers = ["Metric", "Value", "Units / Notes"]
        ws_sum.append([])
        row_idx = 5
        for col_idx, h in enumerate(kpi_headers, 1):
            cell = ws_sum.cell(row=row_idx, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        kpis = [
            ("Monthly Token Reset Schedule", f"Day {reset_day} of each month", f"Cycle reset day configured by Super Admin"),
            ("Actual Token Reset Execution", reset_date_str, f"Approved & distributed by {approved_by_user}"),
            ("Total Tokens Allocated", total_tokens_allocated, "Tokens credited to employee/guest wallets for this cycle"),
            ("Cycle Revenue (Tokens Spent)", total_tokens_spent, "Total cafeteria tokens redeemed in completed orders"),
            ("Remaining Wallet Tokens", total_tokens_remaining, "Active tokens currently available in diner wallets"),
            ("Overall Token Utilization", f"{overall_utilization}%", "Ratio of spent tokens to allocated tokens"),
            ("Total Transactions Completed", completed_orders.count(), "Orders fulfilled at cafeteria counter"),
            ("Active Diners Count", len(token_allocations_data), "Employees and guests registered in system"),
        ]

        for kpi in kpis:
            row_idx += 1
            ws_sum.append(list(kpi))
            for col_idx in range(1, 4):
                c = ws_sum.cell(row=row_idx, column=col_idx)
                c.font = regular_font
                c.border = thin_border
                if col_idx == 2:
                    c.alignment = right_align
                    c.font = bold_font

        # Shift Breakdown Table
        row_idx += 2
        ws_sum.cell(row=row_idx, column=1, value="SHIFT-WISE CONSUMPTION & TOKEN AUDIT").font = bold_font
        row_idx += 1
        shift_headers = ["Shift", "Active Diners", "Tokens Allocated", "Tokens Spent", "Orders Count", "Utilization Rate"]
        for col_idx, h in enumerate(shift_headers, 1):
            cell = ws_sum.cell(row=row_idx, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = sub_header_fill
            cell.alignment = center_align

        for sk, name in [('day', 'Day Shift'), ('mid', 'Mid Shift'), ('night', 'Night Shift')]:
            row_idx += 1
            s = shift_summary.get(sk, {})
            ws_sum.append([
                name,
                s.get('users_count', 0),
                s.get('allocated', 0),
                s.get('spent', 0),
                s.get('orders_count', 0),
                f"{s.get('utilization', 0)}%"
            ])
            for col_idx in range(1, 7):
                c = ws_sum.cell(row=row_idx, column=col_idx)
                c.font = regular_font
                c.border = thin_border
                if col_idx > 1:
                    c.alignment = center_align

        # Auto-adjust column widths for Sheet 1
        for col in ws_sum.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws_sum.column_dimensions[col_letter].width = max(max_len + 4, 14)

        # -------------------------------------------------------------
        # SHEET 2: Token Allocated Details (Per User)
        # -------------------------------------------------------------
        ws_tok = wb.create_sheet(title="Token Allocated Details")
        ws_tok.views.sheetView[0].showGridLines = True

        tok_headers = [
            'User ID', 'Employee Name', 'Username', 'Role', 'Work Shift',
            'Tokens Allocated', 'Tokens Spent (Cycle)', 'Tokens Remaining', 'Orders Placed', 'Utilization Rate'
        ]
        ws_tok.append(tok_headers)
        for col_idx in range(1, len(tok_headers) + 1):
            cell = ws_tok.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        for r_idx, row in enumerate(token_allocations_data, 2):
            ws_tok.append([
                sanitize(row['user_id']),
                sanitize(row['name']),
                sanitize(row['username']),
                row['role'].capitalize(),
                row['shift'].capitalize() if row['shift'] else 'Day',
                row['tokens_allocated'],
                row['tokens_spent'],
                row['tokens_remaining'],
                row['orders_count'],
                f"{row['utilization_pct']}%"
            ])
            use_zebra = (r_idx % 2 == 1)
            for col_idx in range(1, len(tok_headers) + 1):
                c = ws_tok.cell(row=r_idx, column=col_idx)
                c.font = regular_font
                c.border = thin_border
                if use_zebra:
                    c.fill = zebra_fill
                if col_idx in [6, 7, 8, 9, 10]:
                    c.alignment = right_align

        for col in ws_tok.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws_tok.column_dimensions[col_letter].width = max(max_len + 3, 14)

        # -------------------------------------------------------------
        # SHEET 3: Total Transactions Details (All Orders)
        # -------------------------------------------------------------
        ws_tx = wb.create_sheet(title="Total Transactions Details")
        ws_tx.views.sheetView[0].showGridLines = True

        tx_headers = [
            'Order ID', 'Date & Time (IST)', 'User ID', 'Customer Name', 'Username',
            'Role', 'Shift', 'Status', 'Total Tokens', 'Dish Items Summary'
        ]
        ws_tx.append(tx_headers)
        for col_idx in range(1, len(tx_headers) + 1):
            cell = ws_tx.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        for r_idx, o in enumerate(orders, 2):
            items_str = ", ".join(
                f"{it.menu_item.name} [{'Veg' if getattr(it.menu_item, 'is_veg', True) else 'Non-Veg'}] x{it.quantity}"
                for it in o.order_items.all()
            )
            dt_str = o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M:%S')
            ws_tx.append([
                o.id,
                dt_str,
                sanitize(o.user.user_id or ''),
                sanitize(o.user.get_full_name() or o.user.username),
                sanitize(o.user.username),
                o.user.role.capitalize(),
                o.user.work_shift.capitalize() if o.user.work_shift else 'Day',
                o.status.capitalize(),
                o.total_tokens,
                items_str
            ])
            use_zebra = (r_idx % 2 == 1)
            for col_idx in range(1, len(tx_headers) + 1):
                c = ws_tx.cell(row=r_idx, column=col_idx)
                c.font = regular_font
                c.border = thin_border
                if use_zebra:
                    c.fill = zebra_fill
                if col_idx in [1, 8, 9]:
                    c.alignment = center_align

        for col in ws_tx.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws_tx.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 60)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="VDart_Audit_{year}_{month:02d}.xlsx"'
        return response

    elif fmt == 'pdf':
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20
        )
        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#1E3A8A'),
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'SubTitleStyle',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#475569'),
            spaceAfter=12
        )

        elements.append(Paragraph("VDart Cafe — Corporate Monthly Audit & Revenue Report", title_style))
        elements.append(Paragraph(
            f"<b>Billing Period:</b> {period_start.strftime('%d %b %Y')} to {period_end.strftime('%d %b %Y')} (Reset Day: {reset_day}) | "
            f"<b>Reset Date:</b> {reset_date_str} | <b>Approved By:</b> {approved_by_user} | "
            f"<b>Total Revenue:</b> {total_tokens_spent} tokens | <b>Allocated:</b> {total_tokens_allocated} tokens | "
            f"<b>Orders:</b> {completed_orders.count()} | <b>Generated:</b> {now_kolkata.strftime('%Y-%m-%d %H:%M:%S IST')}",
            subtitle_style
        ))

        table_data = [
            ['Order ID', 'Date & Time (IST)', 'User ID', 'Username', 'Role', 'Shift', 'Status', 'Total Tokens', 'Items']
        ]
        cell_style = ParagraphStyle('CellText', parent=styles['Normal'], fontSize=7.5, leading=9.5)

        for o in orders[:250]:
            items_str = ", ".join(f"{it.menu_item.name} ({'Veg' if getattr(it.menu_item, 'is_veg', True) else 'Non-Veg'}) x{it.quantity}" for it in o.order_items.all())
            dt_str = o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M')
            table_data.append([
                str(o.id),
                dt_str,
                str(o.user.user_id or ''),
                str(o.user.username),
                str(o.user.role),
                str(o.user.work_shift),
                str(o.status),
                str(o.total_tokens),
                Paragraph(items_str[:75] + ('...' if len(items_str) > 75 else ''), cell_style)
            ])

        col_widths = [45, 85, 55, 75, 55, 45, 60, 50, 260]
        report_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (-1, 1), (-1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('TOPPADDING', (0, 0), (-1, 0), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7.5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        elements.append(report_table)
        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="VDart_Audit_{year}_{month:02d}.pdf"'
        return response

    else:
        # CSV Export — supports report_type='allocations', 'transactions', or 'all'
        output = io.StringIO()
        output.write(f"# VDart Cafe Corporate Monthly Audit & Revenue Report\n")
        output.write(f"# Billing Period: {period_start.strftime('%d %b %Y')} to {period_end.strftime('%d %b %Y')} (Token Reset Day: {reset_day}) | Actual Reset Date: {reset_date_str} | Approved By: {approved_by_user}\n")
        writer = csv.writer(output)

        if report_type == 'allocations':
            writer.writerow([
                'User ID', 'Employee Name', 'Username', 'Role', 'Shift',
                'Tokens Allocated', 'Tokens Spent (Cycle)', 'Tokens Remaining', 'Orders Placed', 'Utilization Rate'
            ])
            for r in token_allocations_data:
                writer.writerow([
                    sanitize(r['user_id']),
                    sanitize(r['name']),
                    sanitize(r['username']),
                    sanitize(r['role']),
                    sanitize(r['shift']),
                    sanitize(r['tokens_allocated']),
                    sanitize(r['tokens_spent']),
                    sanitize(r['tokens_remaining']),
                    sanitize(r['orders_count']),
                    sanitize(f"{r['utilization_pct']}%")
                ])
            filename = f"VDart_Token_Allocations_{year}_{month:02d}.csv"
        elif report_type == 'transactions':
            writer.writerow([
                'Order ID', 'Date & Time (IST)', 'User ID', 'Username', 'Employee Name', 'Role', 'Shift',
                'Status', 'Total Tokens', 'Items'
            ])
            for o in orders:
                items_str = "; ".join(f"{it.menu_item.name} [{'Veg' if getattr(it.menu_item, 'is_veg', True) else 'Non-Veg'}] x{it.quantity}" for it in o.order_items.all())
                dt_str = o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M:%S')
                writer.writerow([
                    sanitize(o.id),
                    sanitize(dt_str),
                    sanitize(o.user.user_id or ''),
                    sanitize(o.user.username),
                    sanitize(o.user.get_full_name() or o.user.username),
                    sanitize(o.user.role),
                    sanitize(o.user.work_shift),
                    sanitize(o.status),
                    sanitize(o.total_tokens),
                    sanitize(items_str)
                ])
            filename = f"VDart_Total_Transactions_{year}_{month:02d}.csv"
        else:
            # Default / 'all': writes full transaction ledger with summary
            writer.writerow([
                'Order ID', 'Date & Time (IST)', 'User ID', 'Username', 'Employee Name', 'Role', 'Shift',
                'Status', 'Total Tokens', 'Items'
            ])
            for o in orders:
                items_str = "; ".join(f"{it.menu_item.name} [{'Veg' if getattr(it.menu_item, 'is_veg', True) else 'Non-Veg'}] x{it.quantity}" for it in o.order_items.all())
                dt_str = o.created_at.astimezone(kolkata_tz).strftime('%Y-%m-%d %H:%M:%S')
                writer.writerow([
                    sanitize(o.id),
                    sanitize(dt_str),
                    sanitize(o.user.user_id or ''),
                    sanitize(o.user.username),
                    sanitize(o.user.get_full_name() or o.user.username),
                    sanitize(o.user.role),
                    sanitize(o.user.work_shift),
                    sanitize(o.status),
                    sanitize(o.total_tokens),
                    sanitize(items_str)
                ])
            filename = f"VDart_Audit_{year}_{month:02d}.csv"

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# Alias for explicit clarity
monthly_audit_report_view = audit_export_view



