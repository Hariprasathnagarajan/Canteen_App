const normalizeShiftBreakdown = (breakdown) => {
  if (!Array.isArray(breakdown)) {
    return breakdown || {};
  }

  return breakdown.reduce((acc, row) => {
    if (!row?.shift) return acc;
    acc[`${row.shift}_shift`] = {
      ...row,
      name: row.shift_name,
      proposed_tokens: row.proposed_allocation,
      actual_allocated_tokens: row.actual_allocated,
      tokens_unused: row.unused_tokens,
    };
    return acc;
  }, {});
};

const normalizeUsers = (cycle) => {
  if (Array.isArray(cycle.users) && cycle.users.length > 0) {
    return cycle.users;
  }

  return (cycle.user_records || []).map((user) => ({
    ...user,
    tokens_credited: user.tokens_allocated,
    tokens_unused: user.current_wallet,
    status: (user.current_wallet ?? 0) > 0 ? 'Active' : 'Depleted',
  }));
};

const normalizeAllocationMode = (cycle) => {
  if (cycle.allocation_mode_raw) {
    return cycle.allocation_mode_raw;
  }

  return typeof cycle.allocation_mode === 'string'
    ? cycle.allocation_mode.toLowerCase()
    : cycle.allocation_mode;
};

export const normalizeHistoryCycle = (cycle) => {
  if (!cycle) return cycle;

  return {
    ...cycle,
    cycle_label: cycle.cycle_label || cycle.billing_cycle,
    status: cycle.status || cycle.allocation_status,
    allocation_mode_raw: normalizeAllocationMode(cycle),
    total_eligible_users: cycle.total_eligible_users ?? cycle.eligible_personnel_count,
    total_proposed_tokens: cycle.total_proposed_tokens ?? cycle.proposed_allocation,
    total_allocated_tokens: cycle.total_allocated_tokens ?? cycle.actual_allocated_tokens,
    total_spent_tokens: cycle.total_spent_tokens ?? cycle.tokens_spent,
    total_unused_tokens: cycle.total_unused_tokens ?? cycle.unused_or_expired_tokens,
    shift_breakdown: normalizeShiftBreakdown(cycle.shift_breakdown),
    users: normalizeUsers(cycle),
  };
};
