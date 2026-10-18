import csv
import io
import json
from datetime import timedelta, date
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Count, Sum, F, IntegerField, ExpressionWrapper
from django.utils import timezone
from django.contrib.auth import login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .permissions import IsAdmin, IsStaffOrAdmin, IsEmployee, IsGuest
from .models import CustomUser, MenuItem, Order, OrderItem, ShiftTokenAllocation, TokenDistribution, PasswordResetRequest
from .serializers import (
    CustomUserSerializer, CustomUserCreateSerializer, LoginSerializer,
    MenuItemSerializer, OrderSerializer, ShiftTokenAllocationSerializer, TokenDistributionSerializer,
    PasswordResetRequestSerializer
)


# ---------------------------------------------------------------------------
# Bulk import helpers — accept CSV, JSON or Excel (.xlsx) file uploads,
# pasted text, or a plain JSON array so admins can load data in any format.
# ---------------------------------------------------------------------------
def _normalize_key(value):
    return str(value or '').strip().lower().replace('-', '_').replace(' ', '_')


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


def _rows_from_csv_text(text):
    reader = csv.DictReader(io.StringIO(text))
    return [
        {_normalize_key(k): v for k, v in row.items()}
        for row in reader
    ]


def _rows_from_uploaded_file(uploaded):
    name = str(uploaded.name or '').lower()
    raw = uploaded.read()

    if name.endswith('.xlsx'):
        try:
            from openpyxl import load_workbook
        except ImportError:
            raise ValueError('Excel support is not available on the server. Upload CSV or JSON instead.')
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [_normalize_key(h) for h in rows[0]]
        return [
            dict(zip(headers, row))
            for row in rows[1:]
            if any(cell is not None and str(cell).strip() != '' for cell in row)
        ]

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
            if fmt == 'json' or text_str[:1] in ('[', '{'):
                return _rows_from_json_text(text_str)
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
    # Get the CSRF token from the request
    csrf_token = request.META.get('CSRF_COOKIE', '')
    
    # Create the response
    response = Response({
        'message': 'CSRF cookie set',
        'csrftoken': csrf_token
    })
    
    # Set CORS headers
    origin = request.META.get('HTTP_ORIGIN')
    if origin in settings.CORS_ALLOWED_ORIGINS:
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'X-CSRFToken, Content-Type, X-Requested-With, Authorization'
        response['Access-Control-Expose-Headers'] = 'X-CSRFToken'
    
    # Note: @ensure_csrf_cookie already sets the CSRF cookie using
    # settings.CSRF_COOKIE_NAME (namespaced), so no manual set_cookie here.
    return response


# Login view
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def login_view(request):
    if request.method == 'OPTIONS':
        response = Response()
        response['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'X-CSRFToken, Content-Type, X-Requested-With'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response
        
    serializer = LoginSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    login(request, user)
    
    # Set session to expire when browser is closed
    if not request.data.get('remember_me'):
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
        'tokens': user.current_tokens() if user.role not in ['admin', 'staff'] else 0,
        'monthly_tokens': user.monthly_tokens,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    })
    
    # Set session cookie (namespaced name; SessionMiddleware also sets this on login())
    response.set_cookie(
        settings.SESSION_COOKIE_NAME, 
        request.session.session_key,
        path='/',
        httponly=True,
        samesite=getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax'),
        secure=getattr(settings, 'SESSION_COOKIE_SECURE', False),
        max_age=1209600  # 2 weeks
    )
    return response


# Logout view
@api_view(['POST', 'OPTIONS'])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie
def logout_view(request):
    # Handle OPTIONS preflight request
    if request.method == 'OPTIONS':
        response = Response(status=200)
    else:
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
        
        # Create response
        response = Response({'message': 'Logout successful'}, status=200)
    
    # Get the origin from the request
    origin = request.META.get('HTTP_ORIGIN')
    
    # Set CORS headers if the origin is allowed
    if origin in settings.CORS_ALLOWED_ORIGINS:
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS, GET, PUT, PATCH, DELETE, HEAD'
        response['Access-Control-Allow-Headers'] = 'X-CSRFToken, Content-Type, X-Requested-With, Authorization, Accept, Accept-Encoding, Accept-Language, Cache-Control, Connection, Host, Pragma, Referer, User-Agent'
        response['Access-Control-Expose-Headers'] = 'X-CSRFToken, Content-Type, Content-Length, Content-Range, Content-Disposition, Authorization'
        response['Access-Control-Max-Age'] = '86400'  # 24 hours
    
    # Always set these headers for the response
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
    serializer = CustomUserSerializer(request.user)
    return Response(serializer.data)


# Admin user management
class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.exclude(role='admin')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return CustomUserCreateSerializer
        return CustomUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Tokens are managed through the monthly_tokens field in CustomUser model
        # No need to create separate MonthlyToken objects
            
        output_serializer = CustomUserSerializer(user)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        if user.is_superuser and not request.user.is_superuser:
            return Response({'error': 'Only superusers can reset another superuser\'s password.'}, status=status.HTTP_403_FORBIDDEN)

        new_password = (request.data.get('new_password') or '').strip()
        if not new_password:
            # Default to resetting to their user_id
            new_password = user.user_id or 'Password123!'
        elif len(new_password) < 6:
            return Response(
                {'error': 'Password must be at least 6 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        return Response({
            'status': 'success',
            'message': f'Password for {user.username} has been reset to "{new_password}".'
        })

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        try:
            rows = _extract_bulk_rows(request, ['users'])
        except (ValueError, json.JSONDecodeError) as exc:
            return Response({'error': f'Could not parse the uploaded data: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response(
                {'error': 'No user rows found. Upload a CSV, JSON or Excel file, or paste the data.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        updated_count = 0
        errors = []

        for index, row in enumerate(rows, start=1):
            try:
                username = str(_row_lookup(row, 'username', 'user_name', 'login') or '').strip()
                if not username:
                    errors.append(f'Row {index}: username is required.')
                    continue

                role = str(_row_lookup(row, 'role', 'user_role') or 'employee').strip().lower()
                if role not in ['employee', 'guest', 'staff']:
                    errors.append(f'Row {index}: role must be employee, guest or staff.')
                    continue

                work_shift = str(_row_lookup(row, 'work_shift', 'shift') or 'day').strip().lower()
                work_shift = work_shift.replace(' shift', '').replace('_shift', '').strip()
                if work_shift not in ['day', 'mid', 'night']:
                    errors.append(f'Row {index}: work_shift must be day, mid or night.')
                    continue

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
                        errors.append(f'Row {index}: tokens must be a non-negative number.')
                        continue

                if user_id and CustomUser.objects.filter(user_id__iexact=user_id).exclude(username__iexact=username).exists():
                    errors.append(f'Row {index}: User ID "{user_id}" is already assigned to another user.')
                    continue

                existing = CustomUser.objects.filter(username__iexact=username).first()
                if existing:
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
                    updated_count += 1
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
                    user.set_password(password or user_id or username)
                    if role == 'staff':
                        user.is_staff = True
                    user.save()
                    created_count += 1
            except Exception as exc:
                errors.append(f'Row {index}: {exc}')

        return Response({
            'status': 'success',
            'created': created_count,
            'updated': updated_count,
            'total': len(rows),
            'errors': errors,
            'message': f'Imported {created_count} new and updated {updated_count} existing users.'
        })


# Token refresh
@api_view(['POST'])
@permission_classes([IsAdmin])
def refresh_monthly_tokens(request):
    token_count = _parse_token_amount(request.data.get('count'))
    if token_count is None or token_count <= 0:
        return Response(
            {'error': 'A positive token count is required. Provide "count" in the request body.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get all non-admin, non-staff users
    users = CustomUser.objects.exclude(role__in=['admin', 'staff'])
    now = timezone.now().date()

    # Update tokens for each user
    updated = users.update(
        monthly_tokens=token_count,
        last_token_reset=now
    )

    return Response({
        'message': f'Successfully refreshed tokens for {updated} users',
        'tokens_assigned': token_count,
        'users_updated': updated,
        'reset_date': now
    })


# Staff: Menu management
class StaffMenuViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    permission_classes = [IsStaffOrAdmin]

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        try:
            rows = _extract_bulk_rows(request, ['items', 'menu', 'menu_items'])
        except (ValueError, json.JSONDecodeError) as exc:
            return Response({'error': f'Could not parse the uploaded data: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response(
                {'error': 'No menu rows found. Upload a CSV, JSON or Excel file, or paste the data.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

                existing = MenuItem.objects.filter(name__iexact=name).first()
                if existing:
                    existing.price = price
                    existing.description = description
                    existing.is_available = is_available
                    if category:
                        existing.category = category
                    existing.save()
                    updated_count += 1
                else:
                    item = MenuItem(
                        name=name,
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


# Staff: Order management
class StaffOrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('user').prefetch_related('order_items__menu_item').all()
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        queryset = Order.objects.select_related('user').prefetch_related('order_items__menu_item').all()
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
        today = timezone.now().date()
        today_orders = Order.objects.filter(created_at__date=today)

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
    menu_items = MenuItem.objects.filter(is_available=True)
    serializer = MenuItemSerializer(menu_items, many=True)
    return Response(serializer.data)


def _process_order_placement(request):
    """
    Unified transactional order placement with:
    - Row-level lock on user (select_for_update) to prevent concurrency double-spending
    - Strict validation: menu_item exists, is_available=True, quantity is positive int >= 1
    - Server-side total calculation (never trusts client totals)
    - Atomic token deduction and Order + OrderItem creation
    """
    items = request.data.get('items', [])
    if not isinstance(items, list) or len(items) == 0:
        return Response({'error': 'No items provided for the order'}, status=status.HTTP_400_BAD_REQUEST)

    validated_items = []
    total_tokens_needed = 0

    with transaction.atomic():
        # Lock user record to prevent concurrent double-spending
        user = CustomUser.objects.select_for_update().get(id=request.user.id)

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
                menu_item = MenuItem.objects.get(id=item_id)
            except MenuItem.DoesNotExist:
                return Response({'error': f'Menu item #{item_id} does not exist'}, status=status.HTTP_400_BAD_REQUEST)

            if not menu_item.is_available:
                return Response({'error': f'"{menu_item.name}" is currently unavailable'}, status=status.HTTP_400_BAD_REQUEST)

            tokens_for_item = menu_item.price * quantity
            total_tokens_needed += tokens_for_item
            validated_items.append((menu_item, quantity, menu_item.price))

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
        order = Order.objects.create(
            user=user,
            status='pending',
            total_tokens=total_tokens_needed,
            tokens_refunded=False
        )

        # Create OrderItems
        for menu_item, quantity, unit_tokens in validated_items:
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                tokens_per_item=unit_tokens
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
    menu_items = MenuItem.objects.filter(is_available=True)
    serializer = MenuItemSerializer(menu_items, many=True)
    return Response(serializer.data)


# ✅ Guest: View orders
@api_view(['GET'])
@permission_classes([IsGuest])
def guest_orders(request):
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
    if order.user != request.user and request.user.role not in ['admin', 'staff'] and not request.user.is_superuser:
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


def _allocate_shift_tokens(shift, token_amount, month_start):
    """Create/update the audit record and sync every user's wallet in the shift."""
    allocation, _ = ShiftTokenAllocation.objects.get_or_create(
        shift=shift,
        allocation_month=month_start,
        defaults={'tokens_per_user': token_amount}
    )
    allocation.tokens_per_user = token_amount
    allocation.save()  # Triggers TokenDistribution sync for employees + guests

    return CustomUser.objects.filter(
        work_shift=shift,
        role__in=['employee', 'guest']
    ).count()


@api_view(['POST'])
@permission_classes([IsAdmin])
def assign_tokens(request):
    shift = (request.data.get('shift') or '').strip().lower()
    # Normalize shift if it comes with '_shift' suffix
    shift = shift.replace('_shift', '')
    raw_tokens = request.data.get('tokens')
    month_start = timezone.now().date().replace(day=1)

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
            details = {}
            for s in ['day', 'mid', 'night']:
                cnt = _allocate_shift_tokens(s, amounts[s], month_start)
                total_updated += cnt
                details[s] = {'tokens': amounts[s], 'users': cnt}

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
        updated_count = _allocate_shift_tokens(shift, token_amount, month_start)

        return Response({
            'status': 'success',
            'message': f'Successfully allocated {token_amount} tokens to {updated_count} users in {shift} shift.',
            'updated': updated_count,
            'tokens_assigned': token_amount,
            'shift': shift,
            'allocation_month': month_start.strftime('%Y-%m-%d')
        })

@api_view(['GET'])
@permission_classes([IsAdmin])
def get_token_summary(request):
    users = CustomUser.objects.filter(
        role__in=['employee', 'guest']
    ).order_by('work_shift', 'username')
    
    summary = {
        'day_shift': {'users': [], 'total_tokens': 0},
        'mid_shift': {'users': [], 'total_tokens': 0},
        'night_shift': {'users': [], 'total_tokens': 0}
    }
    
    for user in users:
        full_name = f"{user.first_name} {user.last_name}".strip()
        user_data = {
            'id': user.id,
            'username': user.username,
            'name': full_name if full_name else user.username,
            'user_id': user.user_id,
            'email': user.email,
            'tokens': user.monthly_tokens,
            'role': user.role,
            'work_shift': user.work_shift
        }
        
        shift_key = f"{user.work_shift}_shift" if user.work_shift and not user.work_shift.endswith('_shift') else user.work_shift
        if shift_key in summary:
            summary[shift_key]['users'].append(user_data)
            summary[shift_key]['total_tokens'] += user.monthly_tokens
    
    return Response(summary)

# Dashboard views
@api_view(['GET'])
@permission_classes([IsAdmin])
def get_dashboard_stats(request):
    """Get statistics for the admin dashboard"""
    try:
        # Total users count
        total_users = CustomUser.objects.count()
        
        # User growth (percentage change from last month)
        last_month = timezone.now() - timedelta(days=30)
        previous_users = CustomUser.objects.filter(
            date_joined__lt=last_month
        ).count()
        
        user_growth = 0
        if previous_users > 0:
            user_growth = ((total_users - previous_users) / previous_users) * 100
        
        # Menu items count
        total_menu_items = MenuItem.objects.count()
        
        # New items this week
        new_items_this_week = MenuItem.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        
        # Today's revenue
        today = timezone.now().date()
        
        try:
            value_expr = ExpressionWrapper(
                F('order_items__tokens_per_item') * F('order_items__quantity'),
                output_field=IntegerField(),
            )

            todays_orders = (
                Order.objects.filter(created_at__date=today, status='completed')
                .annotate(total_value=value_expr)
            )
            todays_revenue = todays_orders.aggregate(total=Sum('total_value'))['total'] or 0

            # Revenue change from yesterday
            yesterday = today - timedelta(days=1)
            yesterdays_orders = (
                Order.objects.filter(created_at__date=yesterday, status='completed')
                .annotate(total_value=value_expr)
            )
            yesterdays_revenue = yesterdays_orders.aggregate(total=Sum('total_value'))['total'] or 0

            revenue_change = 0
            if yesterdays_revenue > 0:
                revenue_change = ((todays_revenue - yesterdays_revenue) / yesterdays_revenue) * 100
        except Exception:
            todays_revenue = 0
            revenue_change = 0
        
        # Pending orders
        try:
            pending_orders = Order.objects.filter(status='pending').count()
            
            # Pending change from yesterday
            yesterday = timezone.now().date() - timedelta(days=1)
            yesterdays_pending = Order.objects.filter(
                created_at__date=yesterday,
                status='pending'
            ).count()
            pending_change = pending_orders - yesterdays_pending
        except Exception as e:
            pending_orders = 0
            pending_change = 0
        
        # Get shift-wise employee counts
        try:
            shift_employees = list(CustomUser.objects.filter(role='employee').values('work_shift').annotate(
                count=Count('id')
            ))
            
            # Get shift-wise guest counts
            shift_guests = list(CustomUser.objects.filter(role='guest').values('work_shift').annotate(
                count=Count('id')
            ))
        except Exception as e:
            shift_employees = []
            shift_guests = []
        
        # Get total staff, guest, and employee counts
        total_staff = CustomUser.objects.filter(role='staff').count()
        total_guests = CustomUser.objects.filter(role='guest').count()
        total_employees = CustomUser.objects.filter(role='employee').count()
        
        # Format shift data with default values
        shift_data = {
            'employees': {item['work_shift']: item['count'] for item in shift_employees if item.get('work_shift')},
            'guests': {item['work_shift']: item['count'] for item in shift_guests if item.get('work_shift')}
        }
        
        # Ensure all shifts have values
        for shift in ['day', 'mid', 'night']:
            if shift not in shift_data['employees']:
                shift_data['employees'][shift] = 0
            if shift not in shift_data['guests']:
                shift_data['guests'][shift] = 0
        
        response_data = {
            'totalUsers': total_users,
            'totalEmployees': total_employees,
            'userGrowth': round(user_growth, 1),
            'totalMenuItems': total_menu_items,
            'newItemsThisWeek': new_items_this_week,
            'todaysRevenue': float(todays_revenue),
            'revenueChange': round(revenue_change, 1),
            'pendingOrders': pending_orders,
            'pendingChange': pending_change,
            'shiftData': shift_data,
            'totalStaff': total_staff,
            'totalGuests': total_guests,
            'status': 'success'
        }
        
        return Response(response_data)
        
    except Exception as e:
        return Response(
            {'error': 'Failed to load dashboard statistics', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAdmin])
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
@permission_classes([IsAdmin])
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
    else:  # year
        start_date = end_date - timedelta(days=364)
        date_range = [start_date + timedelta(days=x*30) for x in range(12)]
    
    # Get completed orders in the date range and aggregate in DB
    value_expr = ExpressionWrapper(
        F('order_items__tokens_per_item') * F('order_items__quantity'),
        output_field=IntegerField(),
    )

    orders = (
        Order.objects.filter(
            created_at__date__range=[start_date, end_date], status='completed'
        )
        .annotate(total_value=value_expr)
        .values('created_at__date')
        .annotate(amount=Sum('total_value'))
    )

    # Group by date
    revenue_by_date = {row['created_at__date']: float(row['amount'] or 0) for row in orders}
    
    # Fill in missing dates with 0
    data = []
    for date in date_range:
        data.append({
            'date': date,
            'amount': revenue_by_date.get(date, 0)
        })
    
    return Response(data)


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
@ensure_csrf_cookie
def reset_password_view(request):
    """
    Public self-service password reset module for employees and staff.
    Accepts:
    - identifier: username or user_id (Employee/Staff ID)
    - email: user's registered email
    - new_password: new password (min 6 characters)
    - confirm_password: confirmation matching new_password
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
    if len(new_password) < 6:
        return Response({'error': 'New password must be at least 6 characters long'}, status=status.HTTP_400_BAD_REQUEST)
    if confirm_password and new_password != confirm_password:
        return Response({'error': 'New password and confirm password do not match'}, status=status.HTTP_400_BAD_REQUEST)

    # Search user by username OR user_id (case-insensitive)
    user = CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(user_id__iexact=identifier)
    ).first()

    if not user:
        return Response({'error': 'No account found matching this Username or Employee/Staff ID'}, status=status.HTTP_404_NOT_FOUND)

    # Protect admin and superuser accounts from public self-service reset
    if user.role == 'admin' or user.is_superuser:
        return Response({'error': 'Admin accounts cannot be reset via public self-service. Please contact the server administrator directly.'}, status=status.HTTP_403_FORBIDDEN)

    # Verify registered email
    if not user.email or user.email.lower() != email.lower():
        return Response({'error': 'The email provided does not match our records for this account'}, status=status.HTTP_400_BAD_REQUEST)

    # Update password
    user.set_password(new_password)
    user.save()

    return Response({
        'status': 'success',
        'message': f'Password for {user.username} ({user.role.capitalize()}) has been reset successfully! You can now log in.',
        'username': user.username,
        'role': user.role
    }, status=status.HTTP_200_OK)


# Submit Password Reset Request (Requires Admin Approval)
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def submit_password_reset_request(request):
    """
    Public endpoint for employees and staff to request a password reset.
    The request goes to the Admin for approval.
    Once approved by Admin, the user's password will be reset to their default Employee ID.
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

    # Search user by username OR user_id (case-insensitive)
    user = CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(user_id__iexact=identifier)
    ).first()

    if not user:
        return Response({'error': 'No account found matching this Username or Employee/Staff ID'}, status=status.HTTP_404_NOT_FOUND)

    # Protect admin and superuser accounts from public reset requests
    if user.role == 'admin' or user.is_superuser:
        return Response({'error': 'Admin accounts cannot request a reset via this portal. Please contact the server administrator directly.'}, status=status.HTTP_403_FORBIDDEN)

    # Verify registered email
    if not user.email or user.email.lower() != email.lower():
        return Response({'error': 'The email provided does not match our records for this account'}, status=status.HTTP_400_BAD_REQUEST)

    # Check for existing pending request
    existing_request = PasswordResetRequest.objects.filter(user=user, status='pending').first()
    if existing_request:
        return Response({
            'status': 'pending',
            'message': f'A password reset request for {user.username} is already pending Admin approval. Once approved, your password will be reset to your default Employee ID ({user.user_id or "User ID"}).',
            'user_id': user.user_id,
            'username': user.username
        }, status=status.HTTP_200_OK)

    reset_req = PasswordResetRequest.objects.create(
        user=user,
        reason=reason,
        status='pending'
    )

    return Response({
        'status': 'success',
        'message': f'Password reset request submitted for {user.username}! The Admin will review and approve it. Once approved, you can log in using your Employee ID ({user.user_id or "User ID"}) as your password.',
        'user_id': user.user_id,
        'username': user.username,
        'request_id': reset_req.id
    }, status=status.HTTP_201_CREATED)


# Check Password Reset Request Status
@api_view(['GET', 'OPTIONS'])
@permission_classes([AllowAny])
def check_password_reset_status(request):
    """Public endpoint to check if an employee or staff reset request has been approved by admin"""
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)

    identifier = (request.query_params.get('identifier') or '').strip()
    if not identifier:
        return Response({'error': 'Identifier parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

    user = CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(user_id__iexact=identifier)
    ).first()

    if not user:
        return Response({'error': 'No account found'}, status=status.HTTP_404_NOT_FOUND)

    latest_req = PasswordResetRequest.objects.filter(user=user).first()
    if not latest_req:
        return Response({'has_request': False, 'message': 'No password reset requests found.'})

    return Response({
        'has_request': True,
        'status': latest_req.status,
        'created_at': latest_req.created_at,
        'reviewed_at': latest_req.reviewed_at,
        'admin_notes': latest_req.admin_notes,
        'default_password_hint': f'Your Employee ID ({user.user_id})' if latest_req.status == 'approved' else None,
        'user_id': user.user_id,
        'username': user.username
    })


# Admin Password Reset Requests ViewSet
class AdminPasswordResetViewSet(viewsets.ModelViewSet):
    """ViewSet for Admin to view, approve, and reject password reset requests"""
    queryset = PasswordResetRequest.objects.select_related('user', 'reviewed_by').all()
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [IsAdmin]

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve password reset request and set password to user's default employee user_id"""
        reset_req = self.get_object()
        if reset_req.status != 'pending':
            return Response(
                {'error': f'Cannot approve request that is already {reset_req.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reset_req.approve(request.user)
        return Response({
            'status': 'success',
            'message': f'Approved! Password for {reset_req.user.username} has been reset to their default Employee ID ({reset_req.user.user_id or "Password123!"}).',
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

