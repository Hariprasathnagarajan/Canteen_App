import { describe, expect, it } from 'vitest';
import { normalizeHistoryCycle } from './tokenHistory';

const backendCycle = {
  id: 'cycle-20261020',
  billing_cycle: '20 Oct 2026 – 19 Nov 2026',
  cycle_start: '2026-10-20',
  cycle_end: '2026-11-19',
  allocation_mode: 'Automatic',
  allocation_mode_raw: 'automatic',
  eligible_personnel_count: 6,
  proposed_allocation: 600,
  actual_allocated_tokens: 600,
  tokens_spent: 120,
  unused_or_expired_tokens: 480,
  allocation_status: 'Allocated',
  approved_by: 'admin',
  shift_breakdown: [
    {
      shift: 'day',
      shift_name: 'Day Shift',
      eligible_count: 4,
      policy_quota: 100,
      proposed_allocation: 400,
      actual_allocated: 400,
      tokens_spent: 100,
      unused_tokens: 300,
    },
    {
      shift: 'mid',
      shift_name: 'Mid Shift',
      eligible_count: 2,
      policy_quota: 100,
      proposed_allocation: 200,
      actual_allocated: 200,
      tokens_spent: 20,
      unused_tokens: 180,
    },
  ],
  user_records: [
    {
      id: 1,
      user_id: 'EMP001',
      username: 'emp001',
      name: 'Employee One',
      shift: 'Day',
      tokens_allocated: 100,
      tokens_spent: 20,
      current_wallet: 80,
    },
    {
      id: 2,
      user_id: 'EMP002',
      username: 'emp002',
      name: 'Employee Two',
      shift: 'Mid',
      tokens_allocated: 100,
      tokens_spent: 100,
      current_wallet: 0,
    },
  ],
};

describe('normalizeHistoryCycle', () => {
  it('maps backend history fields to the Tokens view model', () => {
    const cycle = normalizeHistoryCycle(backendCycle);

    expect(cycle.cycle_label).toBe('20 Oct 2026 – 19 Nov 2026');
    expect(cycle.status).toBe('Allocated');
    expect(cycle.allocation_mode_raw).toBe('automatic');
    expect(cycle.total_eligible_users).toBe(6);
    expect(cycle.total_proposed_tokens).toBe(600);
    expect(cycle.total_allocated_tokens).toBe(600);
    expect(cycle.total_spent_tokens).toBe(120);
    expect(cycle.total_unused_tokens).toBe(480);

    expect(cycle.shift_breakdown.day_shift).toMatchObject({
      name: 'Day Shift',
      eligible_count: 4,
      policy_quota: 100,
      proposed_tokens: 400,
      actual_allocated_tokens: 400,
      tokens_spent: 100,
      tokens_unused: 300,
    });
    expect(cycle.shift_breakdown.mid_shift).toMatchObject({
      name: 'Mid Shift',
      proposed_tokens: 200,
      actual_allocated_tokens: 200,
      tokens_unused: 180,
    });

    expect(cycle.users).toHaveLength(2);
    expect(cycle.users[0]).toMatchObject({
      tokens_credited: 100,
      tokens_unused: 80,
      status: 'Active',
    });
    expect(cycle.users[1]).toMatchObject({
      tokens_credited: 100,
      tokens_unused: 0,
      status: 'Depleted',
    });
  });

  it('preserves an already-normalized history cycle', () => {
    const normalized = {
      cycle_label: '20 Oct 2026 – 19 Nov 2026',
      status: 'Allocated',
      allocation_mode_raw: 'manual',
      total_eligible_users: 2,
      total_proposed_tokens: 200,
      total_allocated_tokens: 200,
      total_spent_tokens: 20,
      total_unused_tokens: 180,
      shift_breakdown: {
        day_shift: {
          name: 'Day Shift',
          eligible_count: 2,
          policy_quota: 100,
          proposed_tokens: 200,
          actual_allocated_tokens: 200,
          tokens_spent: 20,
          tokens_unused: 180,
        },
      },
      users: [
        {
          id: 1,
          tokens_credited: 200,
          tokens_unused: 180,
          status: 'Active',
        },
      ],
    };

    expect(normalizeHistoryCycle(normalized)).toEqual(normalized);
  });

  it('returns null for a missing cycle', () => {
    expect(normalizeHistoryCycle(null)).toBeNull();
  });
});
