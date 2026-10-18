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
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Printer,
  Building2
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
    breakdown: '2 Beverages + 2 Snacks',
    icon: Sun,
    badgeColor: 'bg-cobalt-50 text-cobalt-800 border-cobalt-200/80',
    iconBg: 'bg-cobalt-100 text-cobalt-700',
    accentBorder: 'border-cobalt-200/70',
    headerGradient: 'from-cobalt-500/10 via-cobalt-50/20 to-transparent'
  },
  mid_shift: {
    id: 'mid',
    key: 'mid_shift',
    name: 'Mid Shift',
    breakdown: '1 Food + 1 Beverage + 1 Snack',
    icon: Sunset,
    badgeColor: 'bg-slate-50 text-slate-800 border-slate-200/80',
    iconBg: 'bg-slate-100 text-slate-700',
    accentBorder: 'border-slate-200/70',
    headerGradient: 'from-slate-500/10 via-slate-50/20 to-transparent'
  },
  night_shift: {
    id: 'night',
    key: 'night_shift',
    name: 'Night Shift',
    breakdown: '1 Food + 2 Beverages + 2 Snacks',
    icon: Moon,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300/80',
    iconBg: 'bg-slate-200 text-slate-800',
    accentBorder: 'border-slate-300/70',
    headerGradient: 'from-slate-600/10 via-slate-50/20 to-transparent'
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
  
  // Custom tokens per shift — admin always enters the amount explicitly
  const [customTokens, setCustomTokens] = useState({
    day: '',
    mid: '',
    night: ''
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
    data: apiData
  } = useApi({
    initialData: defaultTokenData,
    defaultErrorMessage: 'Failed to load token summary',
    logRequests: false,
    skipIfLoading: false
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
    const result = await fetchTokenSummary(adminAPI.getTokenSummary);
    if (result?.error) {
      toast.error(result.error || 'Failed to load token summary.');
    }
  }, [fetchTokenSummary]);

  // Load summary on mount and whenever the fetch callback identity changes
  // (callApi is now stable, so this effectively runs once on mount).
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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

  // Parse a shift's token input — allocation requires an explicit amount
  const parseTokenInput = (shiftId) => {
    const raw = customTokens[shiftId];
    if (raw === '' || raw === null || raw === undefined) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.floor(amount);
  };

  // Handle open confirmation modal
  const openConfirmModal = (shiftKey) => {
    if (shiftKey === 'all') {
      const amounts = {
        day: parseTokenInput('day'),
        mid: parseTokenInput('mid'),
        night: parseTokenInput('night')
      };
      const missing = Object.entries(amounts)
        .filter(([, amount]) => amount === null)
        .map(([id]) => SHIFT_CONFIGS[`${id}_shift`].name);
      if (missing.length) {
        toast.error(`Enter a token amount for: ${missing.join(', ')}.`);
        return;
      }
      setConfirmModal({
        isOpen: true,
        shift: 'all',
        tokens: amounts,
        userCount: totalEmployees,
        title: 'Allocate Tokens to All Shifts',
        description: `This will allocate monthly tokens for ${totalEmployees} total personnel — Day (${amounts.day} tk), Mid (${amounts.mid} tk), and Night (${amounts.night} tk) — for ${currentMonthName}.`
      });
      return;
    }

    const cfg = SHIFT_CONFIGS[shiftKey];
    const count = tokenData[shiftKey]?.users?.length || 0;
    const tokensToAssign = parseTokenInput(cfg.id);
    if (tokensToAssign === null) {
      toast.error(`Enter the token amount for ${cfg.name} first.`);
      return;
    }
    setConfirmModal({
      isOpen: true,
      shift: cfg.id,
      tokens: tokensToAssign,
      userCount: count,
      title: `Allocate Tokens for ${cfg.name}`,
      description: `This will assign ${tokensToAssign} tokens each to ${count} active users in ${cfg.name} for ${currentMonthName}.`
    });
  };

  // Perform actual assignment
  const handleExecuteAssignment = async () => {
    const { shift, tokens } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setAssigningShift(shift);

    try {
      let result;
      if (shift === 'all') {
        result = await fetchAssignTokens(() => adminAPI.assignAllTokens(tokens));
      } else {
        result = await fetchAssignTokens(() => adminAPI.assignTokens(shift, tokens));
      }

      if (result?.error) {
        throw new Error(result.error);
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

  const [showAuditModal, setShowAuditModal] = useState(false);

  // Export full token roster to CSV
  const handleExportCSV = () => {
    try {
      const rows = [];
      rows.push(['VDART CAFE - CORPORATE TOKEN ALLOCATION AUDIT REPORT']);
      rows.push([`Generated On: ${new Date().toLocaleString()}`, `Period: ${currentMonthName} ${today.getFullYear()}`]);
      rows.push([`Total Active Personnel: ${totalEmployees}`, `Total Active Tokens: ${totalTokensAllocated} tk`]);
      rows.push([]);
      rows.push(['User ID', 'Full Name', 'Username', 'Email', 'Role', 'Work Shift', 'Active Balance (tk)', 'Status']);

      const shifts = [
        { key: 'day_shift', name: 'Day Shift' },
        { key: 'mid_shift', name: 'Mid Shift' },
        { key: 'night_shift', name: 'Night Shift' },
      ];

      shifts.forEach(({ key, name }) => {
        const users = tokenData[key]?.users || [];
        users.forEach((u) => {
          rows.push([
            `"${u.user_id || 'N/A'}"`,
            `"${(u.name || u.username || '').replace(/"/g, '""')}"`,
            `"${(u.username || '').replace(/"/g, '""')}"`,
            `"${(u.email || '').replace(/"/g, '""')}"`,
            `"${(u.role || 'employee').toUpperCase()}"`,
            `"${name}"`,
            u.tokens ?? 0,
            (u.tokens ?? 0) > 0 ? 'Active' : 'Depleted'
          ]);
        });
      });

      const csvContent = rows.map((r) => r.join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VDart_Cafe_Token_Audit_${currentMonthName}_${today.getFullYear()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Token roster exported to CSV successfully!');
    } catch (err) {
      toast.error('Failed to export CSV report');
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'staff':
        return 'bg-cobalt-100 text-cobalt-800 border-cobalt-200';
      case 'employee':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'guest':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50"
              title="Download CSV spreadsheet of all token allocations"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setShowAuditModal(true)}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50"
              title="Print official corporate token audit report"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span className="hidden sm:inline">Audit Report</span>
            </button>
            <button
              onClick={loadSummary}
              disabled={loading}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              title="Refresh token balances"
            >
              <RefreshCw className={`h-4 w-4 text-ink-mute ${loading ? 'animate-spin text-cobalt-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => openConfirmModal('all')}
              disabled={assigningShift !== null || totalEmployees === 0}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-cobalt-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-cobalt-700 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-white" />
              <span>{assigningShift === 'all' ? 'Allocating All...' : 'Allocate All Shifts'}</span>
            </button>
          </div>
        }
      />

      {/* Allocation Window Status Notification Banner */}
      <div className={`overflow-hidden rounded-3xl border p-4 sm:p-5 shadow-sm transition-all ${
        isWithinWindow
          ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-green-50/60 to-white text-emerald-950'
          : 'border-cobalt-200/80 bg-gradient-to-r from-cobalt-50 via-slate-50/50 to-white text-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              isWithinWindow ? 'bg-emerald-100 text-emerald-700' : 'bg-cobalt-100 text-cobalt-800'
            }`}>
              {isWithinWindow ? <ShieldCheck className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base">
                  {isWithinWindow ? 'Scheduled Window Active' : 'Manual Allocation Mode'}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isWithinWindow ? 'bg-emerald-200/60 text-emerald-900' : 'bg-cobalt-200/60 text-cobalt-900'
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
        <div className="spotlight-card rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-mute">Total Users</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-ink">{totalEmployees}</p>
          <span className="mt-0.5 inline-block text-[11px] text-ink-mute">Across all 3 shifts</span>
        </div>

        {/* Day Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-cobalt-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cobalt-900">Day Shift</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cobalt-100 text-cobalt-700">
              <Sun className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-cobalt-900">
            {tokenData.day_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-cobalt-700">
            {tokenData.day_shift?.total_tokens || 0} tk active
          </span>
        </div>

        {/* Mid Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-900">Mid Shift</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Sunset className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-slate-900">
            {tokenData.mid_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-slate-700">
            {tokenData.mid_shift?.total_tokens || 0} tk active
          </span>
        </div>

        {/* Night Shift Stats */}
        <div className="spotlight-card rounded-3xl border border-slate-300/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-900">Night Shift</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-200 text-slate-800">
              <Moon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-slate-900">
            {tokenData.night_shift?.users?.length || 0}
            <span className="text-xs font-normal text-ink-mute ml-1">users</span>
          </p>
          <span className="mt-0.5 inline-block font-mono-tokens text-[11px] font-semibold text-slate-700">
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
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-ink shadow-sm placeholder:text-slate-400 focus:border-cobalt-500 focus:outline-none focus:ring-4 focus:ring-cobalt-500/10"
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
            { id: 'all', label: 'All Shifts', count: totalEmployees },
            { id: 'day_shift', label: 'Day', count: tokenData.day_shift?.users?.length || 0 },
            { id: 'mid_shift', label: 'Mid', count: tokenData.mid_shift?.users?.length || 0 },
            { id: 'night_shift', label: 'Night', count: tokenData.night_shift?.users?.length || 0 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedShiftFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition shrink-0 ${
                selectedShiftFilter === tab.id
                  ? 'bg-cobalt-600 text-white shadow-sm'
                  : 'bg-white text-ink-mute border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 font-mono-tokens text-[10px] font-black ${
                selectedShiftFilter === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {tab.count}
              </span>
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
              <div className={`border-b border-slate-200/70 bg-gradient-to-r ${config.headerGradient} p-4 sm:p-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${config.iconBg}`}>
                      <IconComponent className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-ink">{config.name}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.badgeColor}`}>
                          {tokenData[shiftKey]?.total_tokens || 0} tk allocated
                        </span>
                        <span className="font-mono-tokens text-xs font-semibold text-ink-mute">
                          ({shiftUsers.length} personnel)
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Suggested breakdown: <span className="font-semibold text-slate-700">{config.breakdown}</span>
                      </p>
                    </div>
                  </div>

                  {/* Shift Action Controls */}
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    {/* Amount Input */}
                    <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
                      <span className="text-[11px] font-semibold text-ink-mute">Tokens:</span>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={customTokens[config.id]}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setCustomTokens((prev) => ({
                            ...prev,
                            [config.id]: raw === '' ? '' : Math.max(0, parseInt(raw) || 0)
                          }));
                        }}
                        placeholder="—"
                        className="w-14 font-mono-tokens text-xs font-bold text-ink text-center outline-none placeholder:text-slate-300 focus:text-cobalt-700"
                        aria-label={`Token amount for ${config.name}`}
                      />
                    </div>

                    <button
                      onClick={() => openConfirmModal(shiftKey)}
                      disabled={assigningShift !== null || shiftUsers.length === 0}
                      className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-cobalt-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-cobalt-700 disabled:opacity-50"
                    >
                      <Coins className="h-3.5 w-3.5 text-white" />
                      <span>{isAssigningThis ? 'Allocating…' : 'Allocate Shift'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Users List for Shift */}
              <div className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors"
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
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono-tokens text-xs font-bold text-ink">
                            <Coins className="h-3 w-3 text-cobalt-600" />
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
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cobalt-100 text-cobalt-800">
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

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Affected Personnel:</span>
                  <span className="font-mono-tokens font-bold text-ink">{confirmModal.userCount} users</span>
                </div>
                {confirmModal.tokens !== null && (
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Allocation Amount:</span>
                    <span className="font-mono-tokens font-bold text-cobalt-700">
                      {typeof confirmModal.tokens === 'object'
                        ? `Day ${confirmModal.tokens.day} · Mid ${confirmModal.tokens.mid} · Night ${confirmModal.tokens.night}`
                        : `${confirmModal.tokens} tokens / user`}
                    </span>
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
                  className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAssignment}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirm & Allocate</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Corporate Token Audit Report & PDF Modal */}
      <AnimatePresence>
        {showAuditModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-report-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
            >
              {/* Modal Top Control Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-cobalt-600 px-6 py-4 text-white print:hidden">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 id="audit-report-title" className="text-sm font-bold text-white">
                      Official Corporate Token Audit Report
                    </h3>
                    <p className="text-[11px] text-cobalt-100">
                      VDart Cafe Token Governance · {currentMonthName} {today.getFullYear()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-slate-50 transition"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    onClick={() => setShowAuditModal(false)}
                    aria-label="Close audit report"
                    className="rounded-full p-1.5 text-white hover:bg-white/10 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Document Body */}
              <div className="overflow-y-auto p-8 space-y-6 text-ink bg-white font-sans text-xs sm:text-sm print:p-0">
                {/* Official Letterhead */}
                <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-black text-lg sm:text-xl tracking-tight">
                      <Building2 className="h-6 w-6 text-cobalt-700" />
                      <span>VDART TECHNOLOGIES</span>
                    </div>
                    <p className="text-xs text-ink-mute mt-0.5">Corporate Canteen & Employee Welfare Division</p>
                    <p className="text-[11px] text-ink-mute">Global Technology Park, Campus 2 · Facility ID: VDC-FAC-01</p>
                  </div>
                  <div className="sm:text-right">
                    <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono-tokens font-bold text-slate-800 border border-slate-200">
                      AUDIT REF: VDC-AUD-{today.getFullYear()}-{String(today.getMonth() + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[11px] text-ink-mute mt-1">Generated: {today.toLocaleString()}</p>
                  </div>
                </div>

                {/* Audit Title Banner */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="text-base font-extrabold text-ink uppercase tracking-wide">
                    Monthly Token Allocation & Distribution Ledger
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Formal accounting of digital canteen allowances assigned to active corporate personnel for the month of <strong>{currentMonthName} {today.getFullYear()}</strong>.
                  </p>
                </div>

                {/* Summary Metrics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-ink-mute uppercase">Total Personnel</span>
                    <p className="font-mono-tokens text-xl font-black text-ink mt-1">{totalEmployees}</p>
                    <span className="text-[10px] text-slate-500">Active roster</span>
                  </div>
                  <div className="rounded-2xl border border-cobalt-200 bg-cobalt-50/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-cobalt-900 uppercase">Day Shift</span>
                    <p className="font-mono-tokens text-xl font-black text-cobalt-950 mt-1">
                      {tokenData.day_shift?.users?.length || 0} users
                    </p>
                    <span className="text-[10px] text-cobalt-800 font-mono-tokens">
                      {tokenData.day_shift?.total_tokens || 0} tk assigned
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-900 uppercase">Mid Shift</span>
                    <p className="font-mono-tokens text-xl font-black text-slate-950 mt-1">
                      {tokenData.mid_shift?.users?.length || 0} users
                    </p>
                    <span className="text-[10px] text-slate-800 font-mono-tokens">
                      {tokenData.mid_shift?.total_tokens || 0} tk assigned
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-300 bg-slate-100/40 p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-900 uppercase">Night Shift</span>
                    <p className="font-mono-tokens text-xl font-black text-slate-950 mt-1">
                      {tokenData.night_shift?.users?.length || 0} users
                    </p>
                    <span className="text-[10px] text-slate-800 font-mono-tokens">
                      {tokenData.night_shift?.total_tokens || 0} tk assigned
                    </span>
                  </div>
                </div>

                {/* Detailed Personnel Ledger Table */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                        <th className="py-2.5 px-3">User ID</th>
                        <th className="py-2.5 px-3">Employee Name</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {['day_shift', 'mid_shift', 'night_shift'].flatMap((key) => {
                        const shiftCfg = SHIFT_CONFIGS[key];
                        return (tokenData[key]?.users || []).map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono-tokens font-semibold text-slate-900">{u.user_id || 'N/A'}</td>
                            <td className="py-2 px-3 font-medium text-ink">{u.name || u.username}</td>
                            <td className="py-2 px-3 capitalize text-slate-600">{u.role || 'employee'}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{shiftCfg.name}</td>
                            <td className="py-2 px-3 text-right font-mono-tokens font-bold text-cobalt-700">{u.tokens ?? 0} tk</td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-block rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold">
                                Active
                              </span>
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Compliance & Authorization Sign-off Block */}
                <div className="pt-6 border-t-2 border-dashed border-slate-200 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Audited & Certified by:</p>
                    <p className="text-ink-mute mt-0.5">VDart Corporate Operations & Canteen Administration</p>
                    <div className="mt-8 border-b border-slate-400 w-48" />
                    <p className="text-[10px] text-ink-mute mt-1">Authorized Administrator Signature</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">Corporate Finance & HR Governance:</p>
                    <p className="text-ink-mute mt-0.5">Subsidy Verification & Payroll Reconciliation</p>
                    <div className="mt-8 border-b border-slate-400 w-48 ml-auto" />
                    <p className="text-[10px] text-ink-mute mt-1">Compliance Officer Signature</p>
                  </div>
                </div>

                {/* Audit Disclaimer */}
                <p className="text-[10px] text-slate-400 text-center pt-2">
                  Confidential Internal Document. This ledger reflects official token disbursal records for VDart Cafe. Unauthorized duplication prohibited.
                </p>
              </div>

              {/* Modal Bottom Action Bar */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
                <button
                  onClick={handleExportCSV}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-ink hover:bg-slate-100 transition shadow-2xs"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Download CSV Ledger</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="btn-tactile rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-ink-mute hover:text-ink transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 transition shadow-sm"
                  >
                    <Printer className="h-4 w-4 text-white" />
                    <span>Print Audit Report (PDF)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTokens;