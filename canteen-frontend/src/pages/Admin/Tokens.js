import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  Users, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Sun, 
  Sunset, 
  Moon, 
  SlidersHorizontal,
  Info,
  Check,
  AlertTriangle,
  X,
  ShieldCheck
} from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import { useApi } from '../../hooks/useApi';
import SectionHeading from '../../components/canteen/SectionHeading';
import TokenPill from '../../components/canteen/TokenPill';
import EmptyState from '../../components/canteen/EmptyState';

const SHIFT_CONFIGS = {
  day_shift: {
    id: 'day',
    key: 'day_shift',
    name: 'Day Shift',
    defaultTokens: 50,
    breakdown: '2 Beverages (30 tk) + 2 Snacks (20 tk)',
    icon: Sun,
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
    iconBg: 'bg-amber-100 text-amber-700',
    accentBorder: 'border-amber-200/70',
    headerGradient: 'from-amber-500/10 via-amber-50/20 to-transparent'
  },
  mid_shift: {
    id: 'mid',
    key: 'mid_shift',
    name: 'Mid Shift',
    defaultTokens: 75,
    breakdown: '1 Food (50 tk) + 1 Beverage (15 tk) + 1 Snack (10 tk)',
    icon: Sunset,
    badgeColor: 'bg-orange-50 text-orange-800 border-orange-200/80',
    iconBg: 'bg-orange-100 text-orange-700',
    accentBorder: 'border-orange-200/70',
    headerGradient: 'from-orange-500/10 via-orange-50/20 to-transparent'
  },
  night_shift: {
    id: 'night',
    key: 'night_shift',
    name: 'Night Shift',
    defaultTokens: 100,
    breakdown: '1 Food (50 tk) + 2 Beverages (30 tk) + 2 Snacks (20 tk)',
    icon: Moon,
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
    iconBg: 'bg-indigo-100 text-indigo-700',
    accentBorder: 'border-indigo-200/70',
    headerGradient: 'from-indigo-500/10 via-indigo-50/20 to-transparent'
  }
};

const defaultTokenData = {
  day_shift: { users: [], total_tokens: 0 },
  mid_shift: { users: [], total_tokens: 0 },
  night_shift: { users: [], total_tokens: 0 }
};

const AdminTokens = () => {
  const [tokenData, setTokenData] = useState(defaultTokenData);
  const [assigningShift, setAssigningShift] = useState(null); // 'day' | 'mid' | 'night' | 'all' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('all'); // 'all' | 'day_shift' | 'mid_shift' | 'night_shift'
  
  // Custom tokens per shift overrides
  const [customTokens, setCustomTokens] = useState({
    day: 50,
    mid: 75,
    night: 100
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    shift: null, // 'day' | 'mid' | 'night' | 'all'
    tokens: null,
    userCount: 0,
    title: '',
    description: ''
  });

  // Calculate day of the month for window awareness
  const today = new Date();
  const dayOfMonth = today.getDate();
  const currentMonthName = today.toLocaleString('default', { month: 'long' });
  const isWithinWindow = dayOfMonth <= 3;

  // API hooks
  const { 
    loading, 
    callApi: fetchTokenSummary,
    data: apiData,
    cancel: cancelTokenFetch
  } = useApi({
    initialData: defaultTokenData,
    defaultErrorMessage: 'Failed to load token summary',
    logRequests: false,
    skipIfLoading: true
  });

  const { callApi: fetchAssignTokens } = useApi({
    defaultErrorMessage: 'Failed to assign tokens',
    logRequests: false,
    skipIfLoading: true
  });

  // Sync tokenData from apiData
  useEffect(() => {
    if (!apiData) return;
    setTokenData({
      day_shift: {
        users: Array.isArray(apiData.day_shift?.users) ? apiData.day_shift.users : [],
        total_tokens: apiData.day_shift?.total_tokens || 0
      },
      mid_shift: {
        users: Array.isArray(apiData.mid_shift?.users) ? apiData.mid_shift.users : [],
        total_tokens: apiData.mid_shift?.total_tokens || 0
      },
      night_shift: {
        users: Array.isArray(apiData.night_shift?.users) ? apiData.night_shift.users : [],
        total_tokens: apiData.night_shift?.total_tokens || 0
      }
    });
  }, [apiData]);

  // Load summary on mount
  const loadSummary = useCallback(async () => {
    try {
      await fetchTokenSummary(adminAPI.getTokenSummary);
    } catch (err) {
      toast.error('Failed to load token summary.');
    }
  }, [fetchTokenSummary]);

  useEffect(() => {
    loadSummary();
    return () => cancelTokenFetch();
  }, [loadSummary, cancelTokenFetch]);

  // Summary counts
  const totalEmployees = useMemo(() => {
    return (
      (tokenData.day_shift?.users?.length || 0) +
      (tokenData.mid_shift?.users?.length || 0) +
      (tokenData.night_shift?.users?.length || 0)
    );
  }, [tokenData]);

  const totalTokensAllocated = useMemo(() => {
    return (
      (tokenData.day_shift?.total_tokens || 0) +
      (tokenData.mid_shift?.total_tokens || 0) +
      (tokenData.night_shift?.total_tokens || 0)
    );
  }, [tokenData]);

  // Handle open confirmation modal
  const openConfirmModal = (shiftKey) => {
    if (shiftKey === 'all') {
      setConfirmModal({
        isOpen: true,
        shift: 'all',
        tokens: null,
        userCount: totalEmployees,
        title: 'Allocate Tokens to All Shifts',
        description: `This will reset and allocate monthly tokens for ${totalEmployees} total personnel across Day (${customTokens.day} tk), Mid (${customTokens.mid} tk), and Night (${customTokens.night} tk) shifts for ${currentMonthName}.`
      });
    } else {
      const cfg = SHIFT_CONFIGS[shiftKey];
      const count = tokenData[shiftKey]?.users?.length || 0;
      const tokensToAssign = customTokens[cfg.id] || cfg.defaultTokens;
      setConfirmModal({
        isOpen: true,
        shift: cfg.id,
        tokens: tokensToAssign,
        userCount: count,
        title: `Allocate Tokens for ${cfg.name}`,
        description: `This will assign ${tokensToAssign} tokens each to ${count} active users in ${cfg.name} for ${currentMonthName}.`
      });
    }
  };

  // Perform actual assignment
  const handleExecuteAssignment = async () => {
    const { shift, tokens } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setAssigningShift(shift);

    try {
      let result;
      if (shift === 'all') {
        result = await fetchAssignTokens(() => adminAPI.assignAllTokens());
      } else {
        result = await fetchAssignTokens(() => adminAPI.assignTokens(shift, tokens));
      }

      if (result?.error) {
        throw result.error;
      }

      toast.success(
        result?.data?.message || 
        (shift === 'all' 
          ? `All shift tokens assigned successfully!` 
          : `Tokens allocated successfully for ${shift} shift!`)
      );

      // Refresh data
      await loadSummary();
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to assign tokens';
      toast.error(errorMessage);
    } finally {
      setAssigningShift(null);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'staff':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'employee':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'guest':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header with Title and Global Actions */}
      <SectionHeading
        kicker="VDart Cafe Administration"
        title="Token Allocation"
        hint="Manage monthly canteen token allowances for Day, Mid, and Night shift personnel."
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadSummary}
              disabled={loading}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
              title="Refresh token balances"
            >
              <RefreshCw className={`h-4 w-4 text-ink-mute ${loading ? 'animate-spin text-ember-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => openConfirmModal('all')}
              disabled={assigningShift !== null || totalEmployees === 0}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-cream shadow-sm transition hover:bg-ember-600 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>{assigningShift === 'all' ? 'Allocating All...' : 'Allocate All Shifts'}</span>
            </button>
          </div>
        }
      />

      {/* Allocation Window Status Notification Banner */}
      <div className={`overflow-hidden rounded-3xl border p-4 sm:p-5 shadow-sm transition-all ${
        isWithinWindow
          ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-green-50/60 to-white text-emerald-950'
          : 'border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/50 to-white text-stone-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              isWithinWindow ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {isWithinWindow ? <ShieldCheck className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base">
                  {isWithinWindow ? 'Scheduled Window Active' : 'Manual Allocation Mode'}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isWithinWindow ? 'bg-emerald-200/60 text-emerald-900' : 'bg-amber-200/60 text-amber-900'
                }`}>
                  Day {dayOfMonth} of {currentMonthName}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-mute leading-relaxed max-w-2xl">
                {isWithinWindow
                  ? `Standard monthly allocation window (Days 1–3). Shifts receive their standard baseline tokens.`
                  : `Currently outside the 1st–3rd day window. As an administrator, you have full manual override permissions to distribute or adjust tokens anytime.`}
              </p>
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <span className="font-mono-tokens text-xs font-semibold text-ink-mute block">Total Active Personnel</span>
            <span className="font-mono-tokens text-xl font-extrabold text-ink">{totalEmployees}</span>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Users */}
        <div className="spotlight-card rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-mute">Total Users</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-ink">{totalEmployees}</p>
          <span className="mt-0.5 inline-block text-[11px] text-ink-mute">Across all 3 shifts</span>
        </div>

        {/* Day Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-amber-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">Day (50 tk)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Sun className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-amber-900">
            {tokenData.day_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-amber-700">
            {tokenData.day_shift?.total_tokens || 0} tk active
          </span>
        </div>

        {/* Mid Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-orange-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orange-900">Mid (75 tk)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <Sunset className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-orange-900">
            {tokenData.mid_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-orange-700">
            {tokenData.mid_shift?.total_tokens || 0} tk active
          </span>
        </div>

        {/* Night Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-indigo-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-900">Night (100 tk)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Moon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-indigo-900">
            {tokenData.night_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-indigo-700">
            {tokenData.night_shift?.total_tokens || 0} tk active
          </span>
        </div>
      </div>

      {/* Search and Shift Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personnel by name or email…"
            className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-ink shadow-sm placeholder:text-stone-400 focus:border-ember-500 focus:outline-none focus:ring-4 focus:ring-ember-500/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Shift Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Shifts' },
            { id: 'day_shift', label: 'Day (50)' },
            { id: 'mid_shift', label: 'Mid (75)' },
            { id: 'night_shift', label: 'Night (100)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedShiftFilter(tab.id)}
              className={`rounded-2xl px-3 py-2 text-xs font-bold transition shrink-0 ${
                selectedShiftFilter === tab.id
                  ? 'bg-stone-900 text-cream shadow-sm'
                  : 'bg-white text-ink-mute border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shifts Breakdown & Personnel Lists */}
      <div className="space-y-6">
        {Object.entries(SHIFT_CONFIGS).map(([shiftKey, config]) => {
          if (selectedShiftFilter !== 'all' && selectedShiftFilter !== shiftKey) {
            return null;
          }

          const shiftUsers = tokenData[shiftKey]?.users || [];
          const filteredUsers = shiftUsers.filter((u) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
              (u.name || '').toLowerCase().includes(q) ||
              (u.username || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q) ||
              (u.role || '').toLowerCase().includes(q)
            );
          });

          const IconComponent = config.icon;
          const isAssigningThis = assigningShift === config.id;

          return (
            <div
              key={shiftKey}
              className={`spotlight-card overflow-hidden rounded-3xl border bg-white shadow-card transition-all ${config.accentBorder}`}
            >
              {/* Shift Card Header */}
              <div className={`border-b border-stone-200/70 bg-gradient-to-r ${config.headerGradient} p-4 sm:p-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${config.iconBg}`}>
                      <IconComponent className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-ink">{config.name}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.badgeColor}`}>
                          {config.defaultTokens} tk baseline
                        </span>
                        <span className="font-mono-tokens text-xs font-semibold text-ink-mute">
                          ({shiftUsers.length} active)
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Standard quota: <span className="font-semibold text-stone-700">{config.breakdown}</span>
                      </p>
                    </div>
                  </div>

                  {/* Shift Action Controls */}
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    {/* Amount Input */}
                    <div className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-2.5 py-1.5 shadow-2xs">
                      <span className="text-[11px] font-semibold text-ink-mute">Tokens:</span>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={customTokens[config.id]}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setCustomTokens((prev) => ({ ...prev, [config.id]: val }));
                        }}
                        className="w-14 font-mono-tokens text-xs font-bold text-ink text-center outline-none focus:text-ember-700"
                        aria-label={`Custom tokens for ${config.name}`}
                      />
                    </div>

                    <button
                      onClick={() => openConfirmModal(shiftKey)}
                      disabled={assigningShift !== null || shiftUsers.length === 0}
                      className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-cream shadow-sm transition hover:bg-ember-600 disabled:opacity-50"
                    >
                      <Coins className="h-3.5 w-3.5 text-amber-300" />
                      <span>{isAssigningThis ? 'Allocating…' : 'Allocate Shift'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Users List for Shift */}
              <div className="divide-y divide-stone-100">
                {filteredUsers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-cream/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar Circle */}
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl font-bold text-xs uppercase ${config.iconBg}`}>
                            {(user.name || user.username || 'U')[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs sm:text-sm font-bold text-ink">
                                {user.name || user.username}
                              </span>
                              <span className={`rounded-full border px-2 py-0.2 text-[10px] font-bold ${getRoleBadgeStyle(user.role)}`}>
                                {user.role}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-ink-mute">
                              {user.email || `@${user.username}`}
                            </p>
                          </div>
                        </div>

                        {/* User Tokens Pill */}
                        <div className="shrink-0 ml-3">
                          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-cream/70 px-2.5 py-1 font-mono-tokens text-xs font-bold text-ink">
                            <Coins className="h-3 w-3 text-ember-600" />
                            {user.tokens ?? 0} tk
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-xs text-ink-mute">
                      {searchQuery
                        ? `No users matched "${searchQuery}" in ${config.name}.`
                        : `No active personnel currently assigned to ${config.name}.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink">{confirmModal.title}</h4>
                  <p className="text-xs text-ink-mute">VDart Cafe Token Distribution</p>
                </div>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-ink-mute leading-relaxed">
                {confirmModal.description}
              </p>

              <div className="mt-4 rounded-2xl border border-stone-200/80 bg-cream/40 p-3 text-xs text-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Affected Personnel:</span>
                  <span className="font-mono-tokens font-bold text-ink">{confirmModal.userCount} users</span>
                </div>
                {confirmModal.tokens !== null && (
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Allocation Amount:</span>
                    <span className="font-mono-tokens font-bold text-ember-700">{confirmModal.tokens} tokens / user</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-mute">Effective Period:</span>
                  <span className="font-semibold text-ink">{currentMonthName} {today.getFullYear()}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="btn-tactile rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAssignment}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-cream hover:bg-ember-600 shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirm & Allocate</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTokens;