from datetime import date, timedelta
from zoneinfo import ZoneInfo
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, Q
from .models import (
    CustomUser, 
    ShiftTokenAllocation, 
    TokenDistribution, 
    FinancialTransaction, 
    Order,
    TokenResetApproval,
    TokenAllocationAuditLog,
    CanteenSetting
)

def _to_date(val):
    """Safely normalizes date or datetime to a datetime.date object."""
    if val is None:
        return None
    if hasattr(val, 'date') and callable(val.date):
        return val.date()
    return val

def get_current_month_start(target_date=None):
    """Returns the 1st of the month for the given date (defaults to current date)."""
    d = _to_date(target_date) or timezone.now().date()
    return d.replace(day=1)

def get_last_token_reset_date():
    """
    Returns the date when tokens were last actually reset and distributed,
    or None if tokens have never been reset yet.
    """
    approval = TokenResetApproval.objects.filter(status='approved').order_by('-reset_date', '-approved_at').first()
    if approval and approval.reset_date:
        return approval.reset_date
    latest_user_reset = (
        CustomUser.objects.filter(role__in=['employee', 'guest'])
        .exclude(last_token_reset=None)
        .order_by('-last_token_reset')
        .values_list('last_token_reset', flat=True)
        .first()
    )
    return latest_user_reset

def get_current_cycle_start(target_date=None):
    """Canonical billing-cycle key: the cycle start date.

    Every token record is keyed by this value - never by the 1st of the month
    and never by a wall-clock date. The cycle is derived dynamically from the
    configured token_allocation_day (default 20, for 20th-to-19th billing cycles).
    """
    return get_billing_cycle_dates(target_date)['cycle_start']

def get_billing_cycle_dates(target_date=None, allocation_day=None, reference_date=None):
    """
    Computes billing cycle dates dynamically using Asia/Kolkata timezone.

    The cycle start is the configured allocation day (e.g. the 20th) of the
    month the target date falls in. The VDart Cafe billing cycle runs from the
    20th of one month through the 19th of the next month inclusive.
    Examples:
      October 20 – November 19
      November 20 – December 19
    """
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    now_kolkata = timezone.now().astimezone(kolkata_tz)

    if target_date is None:
        target_date = reference_date if reference_date is not None else now_kolkata.date()

    if isinstance(target_date, str):
        target_date = date.fromisoformat(target_date)
    elif hasattr(target_date, 'date') and callable(target_date.date):
        target_date = target_date.date()

    setting = CanteenSetting.get_settings()
    if allocation_day is None:
        allocation_day = getattr(setting, 'token_allocation_day', None) or 20

    # Ensure valid day range (1 to 28 safe for all months)
    allocation_day = max(1, min(28, allocation_day))

    y = target_date.year
    m = target_date.month
    d = target_date.day

    if d >= allocation_day:
        cycle_start = date(y, m, allocation_day)
        next_m = 1 if m == 12 else m + 1
        next_y = y + 1 if m == 12 else y
        next_allocation_date = date(next_y, next_m, allocation_day)
    else:
        prev_m = 12 if m == 1 else m - 1
        prev_y = y - 1 if m == 1 else y
        cycle_start = date(prev_y, prev_m, allocation_day)
        next_allocation_date = date(y, m, allocation_day)

    cycle_end = next_allocation_date - timedelta(days=1)
    reminder_days = getattr(setting, 'reminder_days_before_reset', 3) or 3
    days_remaining = max(0, (next_allocation_date - target_date).days)
    days_elapsed = max(1, (target_date - cycle_start).days + 1)
    total_days = max(1, (cycle_end - cycle_start).days + 1)

    # Previous cycle
    prev_cycle_end = cycle_start - timedelta(days=1)
    pcm = 12 if cycle_start.month == 1 else cycle_start.month - 1
    pcy = cycle_start.year - 1 if cycle_start.month == 1 else cycle_start.year
    prev_cycle_start = date(pcy, pcm, allocation_day)

    # Upcoming cycle
    upcoming_cycle_start = next_allocation_date
    unm = 1 if next_allocation_date.month == 12 else next_allocation_date.month + 1
    uny = next_allocation_date.year + 1 if next_allocation_date.month == 12 else next_allocation_date.year
    upcoming_next_date = date(uny, unm, allocation_day)
    upcoming_cycle_end = upcoming_next_date - timedelta(days=1)

    # When tokens were last actually reset - display metadata, never a key.
    last_reset_date = get_last_token_reset_date()
    has_past_reset = last_reset_date is not None

    return {
        'cycle_start': cycle_start,
        'cycle_end': cycle_end,
        'next_allocation_date': next_allocation_date,
        'current_date': target_date,
        'days_elapsed': days_elapsed,
        'total_days': total_days,
        'days_remaining': days_remaining,
        'allocation_day': allocation_day,
        'reminder_days_before_reset': reminder_days,
        'prev_cycle_start': prev_cycle_start,
        'prev_cycle_end': prev_cycle_end,
        'upcoming_cycle_start': upcoming_cycle_start,
        'upcoming_cycle_end': upcoming_cycle_end,
        'cycle_label': f"{cycle_start.strftime('%d %b %Y')} – {cycle_end.strftime('%d %b %Y')}",
        'prev_cycle_label': f"{prev_cycle_start.strftime('%d %b %Y')} – {prev_cycle_end.strftime('%d %b %Y')}",
        'upcoming_cycle_label': f"{upcoming_cycle_start.strftime('%d %b %Y')} – {upcoming_cycle_end.strftime('%d %b %Y')}",
        'last_token_allocated_date': last_reset_date,
        'has_past_reset': has_past_reset,
        'planned_cycle_start': cycle_start,
    }

def get_shift_monthly_quota(shift, month_start=None):
    """
    Finds the allocated monthly tokens for a shift for the given billing cycle.
    If explicitly allocated for this cycle, returns that allocated amount.
    Otherwise, returns the SAVED POLICY QUOTA for that shift from CanteenSetting.
    NEVER falls back to previous cycle's historical actual allocation!
    """
    month_start = _to_date(month_start) or get_current_cycle_start()
    shift = (shift or 'day').lower().replace('_shift', '')

    # 1. Exact match for this specific billing cycle
    alloc = ShiftTokenAllocation.objects.filter(shift=shift, allocation_month=month_start).first()
    if alloc and alloc.tokens_per_user > 0:
        return alloc.tokens_per_user

    # 2. Return the saved policy quota for this shift (never historical allocation!)
    setting = CanteenSetting.get_settings()
    return setting.get_shift_policy_quota(shift)

def get_allocation_proposal(cycle_start=None):
    """
    Calculates proposed monthly allocation for a cycle using saved token policy,
    active eligible personnel, and shift assignments.
    """
    cycle_start = _to_date(cycle_start) or get_current_cycle_start()
    setting = CanteenSetting.get_settings()

    active_users = CustomUser.objects.filter(
        role__in=['employee', 'guest'],
        is_deleted=False
    )

    shift_breakdown = {}
    total_proposed = 0

    for s in ['day', 'mid', 'night']:
        s_users = active_users.filter(work_shift=s)
        users_count = s_users.count()
        policy_quota = setting.get_shift_policy_quota(s)
        shift_total = policy_quota * users_count
        total_proposed += shift_total

        # Check if actual allocation already exists for this cycle
        alloc = ShiftTokenAllocation.objects.filter(shift=s, allocation_month=cycle_start).first()

        shift_breakdown[s] = {
            'users_count': users_count,
            'policy_quota': policy_quota,
            'proposed_total': shift_total,
            'actual_allocated': alloc.tokens_per_user if alloc else 0,
            'is_allocated': alloc is not None and alloc.tokens_per_user > 0
        }

    return {
        'cycle_start': cycle_start.isoformat(),
        'total_proposed': total_proposed,
        'total_proposed_tokens': total_proposed,
        'eligible_users_count': active_users.count(),
        'total_eligible_diners': active_users.count(),
        'shift_breakdown': shift_breakdown,
        'policy_snapshot': {
            'day': setting.day_shift_policy_quota,
            'mid': setting.mid_shift_policy_quota,
            'night': setting.night_shift_policy_quota,
            'allocation_day': setting.token_allocation_day,
            'mode': setting.monthly_token_allocation_mode,
        }
    }

def get_past_cycle_token_metrics(target_date=None):
    """
    Computes precise token accounting for the past cycle:
    - Tokens spent by diners in the previous cycle
    - Tokens allocated in the previous cycle
    - Current unused token wallet balance
    - Order counts
    - Shift-wise breakdown (Day, Mid, Night)
    If no token reset has happened yet (no past data), returns 0.
    """
    cycle_info = get_billing_cycle_dates(target_date)
    prev_start = cycle_info['prev_cycle_start']
    prev_end = cycle_info['prev_cycle_end']
    target_month_start = cycle_info['cycle_start']

    # 1. Orders completed in previous cycle
    if not cycle_info['has_past_reset'] or not prev_start:
        past_orders = Order.objects.none()
        past_total_spent = 0
        past_orders_count = 0
        past_total_allocated = 0
    else:
        past_orders = Order.objects.filter(
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
            status='completed'
        )
        past_total_spent = past_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
        past_orders_count = past_orders.count()
        past_dists = TokenDistribution.objects.filter(allocation_month=prev_start)
        past_total_allocated = past_dists.aggregate(total=Sum('tokens_allocated'))['total'] or 0

    # 3. Active diners
    active_users = CustomUser.objects.filter(
        role__in=['employee', 'guest'],
        is_deleted=False
    )
    current_unused_total = active_users.aggregate(total=Sum('monthly_tokens'))['total'] or 0

    # 4. Shift breakdown
    shift_breakdown = {}
    total_proposed = 0

    for shift_key in ['day', 'mid', 'night']:
        shift_users = active_users.filter(work_shift=shift_key)
        users_count = shift_users.count()

        shift_spent = past_orders.filter(user__work_shift=shift_key).aggregate(total=Sum('total_tokens'))['total'] or 0 if past_orders.exists() else 0
        shift_allocated = past_dists.filter(user__work_shift=shift_key).aggregate(total=Sum('tokens_allocated'))['total'] or 0 if (cycle_info['has_past_reset'] and prev_start) else 0
        shift_unused = shift_users.aggregate(total=Sum('monthly_tokens'))['total'] or 0
        proposed_per_user = get_shift_monthly_quota(shift_key, target_month_start)
        shift_proposed_total = proposed_per_user * users_count
        total_proposed += shift_proposed_total

        shift_breakdown[shift_key] = {
            'users_count': users_count,
            'past_spent': int(shift_spent),
            'past_allocated': int(shift_allocated),
            'current_unused': int(shift_unused),
            'proposed_per_user': proposed_per_user,
            'total_proposed': shift_proposed_total,
        }

    return {
        'prev_cycle_start': prev_start.isoformat() if prev_start else None,
        'prev_cycle_end': prev_end.isoformat() if prev_end else None,
        'past_total_spent': int(past_total_spent),
        'past_total_allocated': int(past_total_allocated),
        'current_unused_total': int(current_unused_total),
        'past_orders_count': past_orders_count,
        'active_users_count': active_users.count(),
        'total_proposed': total_proposed,
        'shift_breakdown': shift_breakdown,
        'cycle_info': {
            'cycle_start': cycle_info['cycle_start'].isoformat() if cycle_info['cycle_start'] else None,
            'cycle_end': cycle_info['cycle_end'].isoformat() if cycle_info['cycle_end'] else None,
            'next_allocation_date': cycle_info['next_allocation_date'].isoformat() if cycle_info['next_allocation_date'] else None,
            'last_token_allocated_date': cycle_info['last_token_allocated_date'].isoformat() if cycle_info['last_token_allocated_date'] else None,
            'has_past_reset': cycle_info['has_past_reset'],
            'allocation_day': cycle_info['allocation_day'],
            'days_remaining': cycle_info['days_remaining'],
        }
    }

def get_token_reset_status_and_reminder(target_date=None):
    """
    Checks token reset status for the current billing cycle and returns:
    - Persisted Monthly Token Allocation Mode (automatic vs manual)
    - Next billing cycle dates and next allocation run date
    - Last successful allocation date
    - Approval status
    - Calculated proposal for Day, Mid, Night shifts
    """
    cycle_info = get_billing_cycle_dates(target_date)
    today = cycle_info['current_date']
    cycle_month = cycle_info['cycle_start']
    next_date = cycle_info['next_allocation_date']
    days_remaining = cycle_info['days_remaining']
    reminder_days = cycle_info['reminder_days_before_reset']
    setting = CanteenSetting.get_settings()
    mode = setting.monthly_token_allocation_mode

    # Check for approval record for current cycle
    approval = TokenResetApproval.objects.filter(cycle_month=cycle_month).first()
    is_approved = (approval is not None and approval.status == 'approved')
    approval_status = approval.status if approval else 'pending'

    # Reminder status
    is_reminder_active = (days_remaining <= reminder_days) and not is_approved
    is_due = (today == next_date) and not is_approved
    is_overdue = (today > next_date) and not is_approved

    proposal = get_allocation_proposal(cycle_month)
    past_metrics = get_past_cycle_token_metrics(target_date)
    latest_approval = TokenResetApproval.objects.filter(status='approved').order_by('-cycle_month', '-approved_at').first()

    mode_explanation = (
        "Automatic Mode: Token allocations are calculated automatically from saved shift policy quotas and active diner headcounts. Wallets are credited strictly upon Super Admin review and approval."
        if mode == 'automatic' else
        "Manual Mode: Scheduled automated token runs are disabled. Authorized Super Admins must enter token amounts manually and submit the allocation for each billing cycle."
    )

    return {
        'mode': mode,
        'allocation_mode': mode,
        'mode_display': 'Automatic' if mode == 'automatic' else 'Manual',
        'mode_explanation': mode_explanation,
        'is_approved': is_approved,
        'status': approval_status,
        'approval_status': approval_status,
        'billing_cycle': {
            'cycle_start': cycle_info['cycle_start'].isoformat() if cycle_info['cycle_start'] else None,
            'cycle_end': cycle_info['cycle_end'].isoformat() if cycle_info['cycle_end'] else None,
            'cycle_label': cycle_info['cycle_label'],
            'token_allocation_day': cycle_info['allocation_day'],
            'next_allocation_run_date': next_date.isoformat() if next_date else None,
            'last_successful_allocation_date': cycle_info['last_token_allocated_date'].isoformat() if cycle_info['last_token_allocated_date'] else None,
        },
        'approval_record': {
            'id': approval.id if approval else None,
            'status': approval.status if approval else 'pending',
            'allocation_mode': approval.allocation_mode if approval else mode,
            'reset_date': approval.reset_date.isoformat() if approval and approval.reset_date else None,
            'approved_at': approval.approved_at.isoformat() if approval and approval.approved_at else None,
            'allocated_at': approval.allocated_at.isoformat() if approval and approval.allocated_at else None,
            'approved_by': approval.approved_by.username if approval and approval.approved_by else None,
            'distributed_tokens': approval.distributed_tokens if approval else 0,
            'affected_users_count': approval.affected_users_count if approval else 0,
            'notes': approval.notes if approval else '',
        } if approval else None,
        'proposal': proposal,
        'reminder': {
            'is_active': is_reminder_active,
            'is_due': is_due,
            'is_overdue': is_overdue,
            'days_remaining': days_remaining,
            'reminder_days_before_reset': reminder_days,
            'token_allocation_day': cycle_info['allocation_day'],
            'next_allocation_date': next_date.isoformat() if next_date else None,
            'cycle_start': cycle_info['cycle_start'].isoformat() if cycle_info['cycle_start'] else None,
            'cycle_end': cycle_info['cycle_end'].isoformat() if cycle_info['cycle_end'] else None,
            'cycle_label': cycle_info['cycle_label'],
            'last_token_allocated_date': cycle_info['last_token_allocated_date'].isoformat() if cycle_info['last_token_allocated_date'] else None,
            'has_past_reset': cycle_info['has_past_reset'],
            'upcoming_cycle_start': cycle_info['upcoming_cycle_start'].isoformat(),
            'upcoming_cycle_end': cycle_info['upcoming_cycle_end'].isoformat(),
            'upcoming_cycle_label': cycle_info['upcoming_cycle_label'],
        },
        'past_month_metrics': past_metrics,
        'last_approved_reset': {
            'cycle_month': latest_approval.cycle_month.isoformat() if latest_approval else None,
            'reset_date': latest_approval.reset_date.isoformat() if latest_approval and latest_approval.reset_date else None,
            'status': latest_approval.status if latest_approval else 'none',
            'allocation_mode': latest_approval.allocation_mode if latest_approval else 'automatic',
            'distributed_tokens': latest_approval.distributed_tokens if latest_approval else 0,
            'approved_by': latest_approval.approved_by.username if latest_approval and latest_approval.approved_by else None,
            'approved_at': latest_approval.approved_at.isoformat() if latest_approval and latest_approval.approved_at else None,
        } if latest_approval else None
    }

def distribute_approved_monthly_tokens(admin_user, custom_quotas=None, target_date=None, notes='', mode=None):
    """
    Distributes tokens to all active diners for the billing cycle ONLY AFTER admin approval.
    Records the actual token reset date, updates user balances, and creates TokenResetApproval audit entry.
    Snapshots policy, eligible personnel, and actual allocations.
    """
    cycle_info = get_billing_cycle_dates(target_date)
    cycle_month = cycle_info['cycle_start']
    cycle_end = cycle_info['cycle_end']
    today = timezone.now().date()
    month_name = cycle_month.strftime('%B %Y')
    setting = CanteenSetting.get_settings()
    alloc_mode = mode or setting.monthly_token_allocation_mode

    past_metrics = get_past_cycle_token_metrics(target_date)
    approval_rec = TokenResetApproval.objects.filter(cycle_month=cycle_month).first()

    quotas = {}
    for shift in ['day', 'mid', 'night']:
        if custom_quotas and shift in custom_quotas and custom_quotas[shift] is not None and str(custom_quotas[shift]).strip() != '':
            quotas[shift] = max(0, int(custom_quotas[shift]))
        elif approval_rec and approval_rec.draft_quotas and shift in approval_rec.draft_quotas:
            quotas[shift] = max(0, int(approval_rec.draft_quotas[shift]))
        else:
            existing_shift_alloc = ShiftTokenAllocation.objects.filter(shift=shift, allocation_month=cycle_month).first()
            if existing_shift_alloc and existing_shift_alloc.tokens_per_user > 0:
                quotas[shift] = existing_shift_alloc.tokens_per_user
            else:
                quotas[shift] = setting.get_shift_policy_quota(shift)

    policy_snapshot = {
        'day': setting.day_shift_policy_quota,
        'mid': setting.mid_shift_policy_quota,
        'night': setting.night_shift_policy_quota,
        'allocation_day': setting.token_allocation_day,
        'mode': alloc_mode,
    }

    total_distributed = 0
    updated_users = 0
    details = {'day': 0, 'mid': 0, 'night': 0}

    with transaction.atomic():
        active_users = CustomUser.objects.select_for_update().filter(
            role__in=['employee', 'guest'],
            is_deleted=False
        )

        # 1. Update Shift Token Allocation rules for this cycle
        for shift, amt in quotas.items():
            ShiftTokenAllocation.objects.update_or_create(
                shift=shift,
                allocation_month=cycle_month,
                defaults={'tokens_per_user': amt}
            )

        # 2. Allocate tokens to all diners
        for user in active_users:
            shift = (user.work_shift or 'day').replace('_shift', '')
            tokens_to_assign = quotas.get(shift, 0)

            dist = TokenDistribution.objects.filter(
                user=user,
                allocation_month=cycle_month
            ).first()

            # Already credited with this exact quota for this cycle: no-op to prevent duplicate credits
            if dist is not None and dist.tokens_allocated == tokens_to_assign:
                continue

            if dist is None:
                TokenDistribution.objects.create(
                    user=user,
                    allocation_month=cycle_month,
                    tokens_allocated=tokens_to_assign,
                )
            else:
                dist.tokens_allocated = tokens_to_assign
                dist.save(update_fields=['tokens_allocated'])

            FinancialTransaction.objects.create(
                user=user,
                transaction_type='manual_payment',
                amount_tokens=tokens_to_assign,
                amount_inr=tokens_to_assign,
                payment_method='token_transfer',
                payment_reference=f"ALLOC-{cycle_month.strftime('%Y%m%d')}-{user.id}",
                notes=f"Admin approved monthly token allocation for {month_name} on {today.strftime('%Y-%m-%d')} by {admin_user.username}",
                created_by=admin_user
            )

            # Reset wallet balance to the approved quota (unspent tokens expire)
            user.monthly_tokens = tokens_to_assign
            user.last_token_reset = cycle_month  # cycle marker
            user.save(update_fields=['monthly_tokens', 'last_token_reset'])

            total_distributed += tokens_to_assign
            updated_users += 1
            if shift in details:
                details[shift] += 1

        # 3. Create or update the TokenResetApproval record
        approval, _ = TokenResetApproval.objects.update_or_create(
            cycle_month=cycle_month,
            defaults={
                'cycle_end': cycle_end,
                'reset_date': today,
                'status': 'approved',
                'allocation_mode': alloc_mode,
                'past_month_total_spent': past_metrics['past_total_spent'],
                'past_month_total_allocated': past_metrics['past_total_allocated'],
                'past_month_total_unused': past_metrics['current_unused_total'],
                'proposed_tokens': past_metrics['total_proposed'],
                'distributed_tokens': total_distributed,
                'affected_users_count': updated_users,
                'shift_breakdown': past_metrics['shift_breakdown'],
                'policy_snapshot': policy_snapshot,
                'draft_quotas': quotas,
                'approved_by': admin_user,
                'approved_at': timezone.now(),
                'allocated_at': timezone.now(),
                'notes': notes or f"Approved by {admin_user.username} on {today.strftime('%Y-%m-%d')}"
            }
        )

        # 4. Create TokenAllocationAuditLog entry
        TokenAllocationAuditLog.objects.create(
            event_type='allocated',
            billing_cycle_start=cycle_month,
            billing_cycle_end=cycle_end,
            performed_by=admin_user,
            details={
                'mode': alloc_mode,
                'distributed_tokens': total_distributed,
                'affected_users_count': updated_users,
                'quotas': quotas,
                'policy_snapshot': policy_snapshot,
            },
            notes=notes or f"Allocated by {admin_user.username}"
        )

    return {
        'status': 'success',
        'message': f'Monthly tokens approved and distributed for {month_name} ({total_distributed} tk to {updated_users} diners on reset day {today.strftime("%d %b %Y")})',
        'cycle_month': cycle_month.strftime('%Y-%m-%d'),
        'reset_date': today.strftime('%Y-%m-%d'),
        'total_tokens_distributed': total_distributed,
        'total_users_allocated': updated_users,
        'quotas_applied': quotas,
        'details': details,
        'approval_id': approval.id
    }

def reject_token_reset(admin_user, target_date=None, notes=''):
    """
    Super Admin action to reject proposed monthly token allocation.
    """
    cycle_info = get_billing_cycle_dates(target_date)
    cycle_month = cycle_info['cycle_start']
    cycle_end = cycle_info['cycle_end']

    with transaction.atomic():
        approval, _ = TokenResetApproval.objects.update_or_create(
            cycle_month=cycle_month,
            defaults={
                'cycle_end': cycle_end,
                'status': 'rejected',
                'approved_by': admin_user,
                'approved_at': timezone.now(),
                'notes': notes or f"Rejected by Super Admin {admin_user.username}"
            }
        )

        TokenAllocationAuditLog.objects.create(
            event_type='rejected',
            billing_cycle_start=cycle_month,
            billing_cycle_end=cycle_end,
            performed_by=admin_user,
            details={'status': 'rejected'},
            notes=notes or f"Rejected by Super Admin {admin_user.username}"
        )

    return {
        'status': 'success',
        'message': f'Monthly allocation proposal rejected for cycle {cycle_month.strftime("%B %Y")}',
        'cycle_month': cycle_month.strftime('%Y-%m-%d'),
        'approval_id': approval.id
    }

def ensure_user_monthly_tokens(user):
    """
    Checks if this user's current billing cycle has an approved token distribution.
    Only credits tokens if the admin has already approved the distribution for this cycle!
    """
    if not user or not user.is_authenticated or user.role not in ['employee', 'guest']:
        return False
        
    cycle_info = get_billing_cycle_dates()
    cycle_month = cycle_info['cycle_start']
    
    # Check if an approved distribution exists for this cycle!
    has_approval = TokenResetApproval.objects.filter(
        cycle_month=cycle_month,
        status='approved'
    ).exists()
    
    if not has_approval:
        return False
        
    has_distribution = TokenDistribution.objects.filter(user=user, allocation_month=cycle_month).exists()
    reset_date = _to_date(user.last_token_reset)
    already_reset = (reset_date and reset_date == cycle_month)
    
    if has_distribution or already_reset:
        return False

    with transaction.atomic():
        shift = (user.work_shift or 'day').replace('_shift', '')
        tokens_to_assign = get_shift_monthly_quota(shift, cycle_month)
        
        dist, _ = TokenDistribution.objects.update_or_create(
            user=user,
            allocation_month=cycle_month,
            defaults={'tokens_allocated': tokens_to_assign}
        )
        
        FinancialTransaction.objects.create(
            user=user,
            transaction_type='manual_payment',
            amount_tokens=tokens_to_assign,
            amount_inr=tokens_to_assign,
            payment_method='token_transfer',
            payment_reference=f"AUTO-SYNC-{cycle_month.strftime('%Y%m%d')}-{user.id}",
            notes=f"Synced with approved monthly distribution for {cycle_month.strftime('%B %Y')}",
        )
        
        user.monthly_tokens = tokens_to_assign
        user.last_token_reset = cycle_month  # cycle marker, not wall clock
        user.save(update_fields=['monthly_tokens', 'last_token_reset'])
        return True

def get_user_token_metrics(user, month_start=None):
    """
    Computes precise token accounting for a single user:
    - tokens_distributed: tokens allocated for the given month
    - tokens_spent: tokens consumed in orders for the given month
    - tokens_unused: current available tokens in user wallet
    - total_spent_all_time: cumulative token consumption across all orders
    """
    month_start = _to_date(month_start) or get_current_cycle_start()
    cycle_info = get_billing_cycle_dates(month_start)
    cycle_end = cycle_info['cycle_end']
    
    dist = TokenDistribution.objects.filter(user=user, allocation_month=month_start).first()
    if dist and dist.tokens_allocated > 0:
        tokens_distributed = dist.tokens_allocated
    else:
        shift = (user.work_shift or 'day').replace('_shift', '')
        tokens_distributed = get_shift_monthly_quota(shift, month_start)
        
    month_orders = Order.objects.filter(
        user=user,
        created_at__date__gte=month_start,
        created_at__date__lte=cycle_end
    ).exclude(status__in=['cancelled', 'declined'])
    tokens_spent = month_orders.aggregate(total=Sum('total_tokens'))['total'] or 0
    
    tokens_unused = user.current_tokens()
    
    all_time_spent = Order.objects.filter(
        user=user
    ).exclude(status__in=['cancelled', 'declined']).aggregate(total=Sum('total_tokens'))['total'] or 0

    return {
        'tokens_distributed': tokens_distributed,
        'tokens_spent': tokens_spent,
        'tokens_unused': tokens_unused,
        'all_time_spent': all_time_spent,
        'month_orders_count': month_orders.count()
    }

def get_monthly_allocation_history(filters=None):
    """
    Returns structured historical records for:
    - Previous cycle
    - Current cycle
    - Upcoming cycle
    - Historical completed cycles
    With full support for the 13 required audit columns and expandable per-user records.
    """
    filters = filters or {}
    shift_filter = filters.get('shift')
    mode_filter = filters.get('mode')
    status_filter = filters.get('status')
    cycle_filter = filters.get('cycle')

    setting = CanteenSetting.get_settings()
    current_dates = get_billing_cycle_dates()
    
    # Collect distinct cycle start dates from approvals, shift allocations, and distributions
    cycle_starts = set(TokenResetApproval.objects.values_list('cycle_month', flat=True))
    cycle_starts.update(ShiftTokenAllocation.objects.values_list('allocation_month', flat=True))
    cycle_starts.update(TokenDistribution.objects.values_list('allocation_month', flat=True))
    cycle_starts.add(current_dates['cycle_start'])
    if current_dates['prev_cycle_start']:
        cycle_starts.add(current_dates['prev_cycle_start'])
    if current_dates['upcoming_cycle_start']:
        cycle_starts.add(current_dates['upcoming_cycle_start'])
    
    sorted_cycles = sorted([c for c in cycle_starts if c is not None], reverse=True)
    history_records = []

    for c_start in sorted_cycles:
        dates = get_billing_cycle_dates(c_start)
        c_end = dates['cycle_end']
        cycle_label = f"{c_start.strftime('%d %b %Y')} – {c_end.strftime('%d %b %Y')}"

        approval = TokenResetApproval.objects.filter(cycle_month=c_start).first()
        is_current = (c_start == current_dates['cycle_start'])
        is_upcoming = (c_start == current_dates['upcoming_cycle_start'])
        is_past = (c_start < current_dates['cycle_start'])

        # Mode
        alloc_mode = approval.allocation_mode if (approval and approval.allocation_mode) else setting.monthly_token_allocation_mode
        alloc_mode_display = 'Automatic' if alloc_mode == 'automatic' else 'Manual'

        # Approval Status
        if approval:
            if approval.status == 'approved':
                alloc_status = 'Allocated'
            elif approval.status == 'rejected':
                alloc_status = 'Rejected'
            else:
                alloc_status = 'Awaiting Super Admin Approval'
        else:
            if is_upcoming:
                alloc_status = 'Upcoming Proposal'
            elif is_current:
                alloc_status = 'Awaiting Super Admin Approval' if alloc_mode == 'automatic' else 'Draft (Manual)'
            else:
                alloc_status = 'Historical'

        # Query orders completed during this cycle
        cycle_orders = Order.objects.filter(
            created_at__date__gte=c_start,
            created_at__date__lte=c_end,
            status='completed'
        )
        total_cycle_spent = cycle_orders.aggregate(total=Sum('total_tokens'))['total'] or 0

        # Query distributions for this cycle
        cycle_dists = TokenDistribution.objects.filter(allocation_month=c_start)
        total_cycle_allocated = cycle_dists.aggregate(total=Sum('tokens_allocated'))['total'] or 0
        if approval and approval.distributed_tokens > 0:
            total_cycle_allocated = max(total_cycle_allocated, approval.distributed_tokens)

        # Unused tokens
        if is_current:
            active_d = CustomUser.objects.filter(role__in=['employee', 'guest'], is_deleted=False)
            total_unused = active_d.aggregate(total=Sum('monthly_tokens'))['total'] or 0
        else:
            total_unused = max(0, total_cycle_allocated - total_cycle_spent)

        # Shift breakdown calculations
        shift_rows = []
        for s in ['day', 'mid', 'night']:
            policy_q = setting.get_shift_policy_quota(s)
            s_users = CustomUser.objects.filter(role__in=['employee', 'guest'], work_shift=s, is_deleted=False)
            s_count = s_users.count()
            s_proposed = policy_q * s_count

            s_alloc = ShiftTokenAllocation.objects.filter(shift=s, allocation_month=c_start).first()
            s_actual_rate = s_alloc.tokens_per_user if s_alloc else 0

            s_dists = cycle_dists.filter(user__work_shift=s)
            s_actual_total = s_dists.aggregate(total=Sum('tokens_allocated'))['total'] or (s_actual_rate * s_count if s_alloc else 0)

            s_spent = cycle_orders.filter(user__work_shift=s).aggregate(total=Sum('total_tokens'))['total'] or 0
            if is_current:
                s_unused = s_users.aggregate(total=Sum('monthly_tokens'))['total'] or 0
            else:
                s_unused = max(0, s_actual_total - s_spent)

            shift_rows.append({
                'shift': s,
                'shift_name': f"{s.capitalize()} Shift",
                'eligible_count': s_count,
                'policy_quota': policy_q,
                'proposed_allocation': s_proposed,
                'actual_allocated': s_actual_total,
                'tokens_spent': s_spent,
                'unused_tokens': s_unused,
            })

        # Overall proposal
        total_eligible = sum(r['eligible_count'] for r in shift_rows)
        total_proposed = sum(r['proposed_allocation'] for r in shift_rows)

        # Per-user allocation records for expandable view
        user_records = []
        for d in cycle_dists.select_related('user'):
            if d.user:
                u_spent = cycle_orders.filter(user=d.user).aggregate(total=Sum('total_tokens'))['total'] or 0
                user_records.append({
                    'id': d.user.id,
                    'user_id': d.user.user_id or 'N/A',
                    'username': d.user.username,
                    'name': d.user.get_full_name() or d.user.username,
                    'shift': (d.user.work_shift or 'day').capitalize(),
                    'tokens_allocated': d.tokens_allocated,
                    'tokens_spent': u_spent,
                    'current_wallet': d.user.monthly_tokens,
                })

        # Audit events for this cycle
        audit_events = list(TokenAllocationAuditLog.objects.filter(
            billing_cycle_start=c_start
        ).values('id', 'event_type', 'notes', 'details', 'created_at', 'performed_by__username'))

        record = {
            'id': f"cycle-{c_start.strftime('%Y%m%d')}",
            'billing_cycle': cycle_label,
            'cycle_start': c_start.isoformat(),
            'cycle_end': c_end.isoformat(),
            'is_current': is_current,
            'is_upcoming': is_upcoming,
            'is_past': is_past,
            'allocation_mode': alloc_mode_display,
            'allocation_mode_raw': alloc_mode,
            'eligible_personnel_count': total_eligible,
            'policy_quota_summary': f"Day: {setting.day_shift_policy_quota} · Mid: {setting.mid_shift_policy_quota} · Night: {setting.night_shift_policy_quota} tk",
            'proposed_allocation': total_proposed,
            'actual_allocated_tokens': total_cycle_allocated,
            'tokens_spent': total_cycle_spent,
            'unused_or_expired_tokens': total_unused,
            'allocation_status': alloc_status,
            'approved_by': approval.approved_by.username if (approval and approval.approved_by) else None,
            'approved_at': approval.approved_at.isoformat() if (approval and approval.approved_at) else None,
            'allocated_at': approval.allocated_at.isoformat() if (approval and approval.allocated_at) else (approval.approved_at.isoformat() if (approval and approval.status == 'approved' and approval.approved_at) else None),
            'notes': approval.notes if approval else '',
            'shift_breakdown': shift_rows,
            'user_records': user_records,
            'audit_events': audit_events,
        }

        # Apply filters
        if mode_filter and mode_filter != 'all' and alloc_mode != mode_filter:
            continue
        if status_filter and status_filter != 'all':
            if status_filter == 'approved' and alloc_status != 'Allocated':
                continue
            if status_filter == 'pending' and 'Approval' not in alloc_status and 'Draft' not in alloc_status:
                continue
            if status_filter == 'rejected' and alloc_status != 'Rejected':
                continue
        if cycle_filter and cycle_filter not in [c_start.isoformat(), cycle_label]:
            continue

        history_records.append(record)

    return history_records
