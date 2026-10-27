import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UtensilsCrossed, 
  UserCheck, 
  User, 
  Loader2, 
  Sunrise, 
  Sunset, 
  MoonStar, 
  RotateCcw, 
  Flame,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  PieChart,
  BarChart3,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  X,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  History,
  ShieldCheck,
  Check,
  Building2,
  Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, reportsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SectionHeading from '../../components/canteen/SectionHeading';
import VegBadge from '../../components/canteen/VegBadge';

const spring = { type: 'spring', stiffness: 120, damping: 20 };

// Timezone-safe date formatter that never shifts dates due to browser UTC offsets
export const formatDateStr = (iso, options = {}) => {
  if (!iso) return '—';
  const str = String(iso).split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (options.fullMonth) {
      const fullMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${fullMonths[m - 1]} ${d}, ${y}`;
    }
    return `${months[m - 1]} ${d}, ${y}`;
  }
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(iso);
  }
};

const formatDateTimeStr = (iso) => {
  if (!iso) return '—';
  try {
    return String(iso).replace('T', ' ').slice(0, 19);
  } catch {
    return String(iso);
  }
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  
  // Dashboard Core Stats
  const [stats, setStats] = useState({ 
    staff: 0, 
    menu: 0, 
    employees: 0, 
    guests: 0, 
    newItems: 0, 
    todaysRevenue: 0, 
    cycleData: null
  });
  
  const [shiftData, setShiftData] = useState({
    employees: { day: 0, mid: 0, night: 0, total: 0 },
    guests: { day: 0, mid: 0, night: 0, total: 0 }
  });
  
  // Cycle-based revenue & analytics
  const [cycleAnalytics, setCycleAnalytics] = useState(null);
  
  // Allocation History Records (for Tab 3)
  const [allocationHistory, setAllocationHistory] = useState([]);
  
  // Pre-allocation monthly report state
  const [activeReportTab, setActiveReportTab] = useState('transactions'); // 'transactions' | 'allocations' | 'history'
  const [reportData, setReportData] = useState(null);
  
  // Filter Toolbar State
  const [selectedCycle, setSelectedCycle] = useState('current');
  const [reportSearch, setReportSearch] = useState('');
  const [reportShiftFilter, setReportShiftFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportModeFilter, setReportModeFilter] = useState('all');
  
  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportReportType, setExportReportType] = useState('all');

  // Fetch Core Dashboard Data, Cycle Revenue Analytics & Allocation History
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, cycleRes, reportRes, historyRes] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getCycleRevenueData(),
        reportsAPI.getMonthlyReportData({ cycle: selectedCycle }),
        adminAPI.getAllocationHistory()
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        const d = statsRes.value.data;
        const proc = (s) => {
          if (!s) return { day: 0, mid: 0, night: 0, total: 0 };
          const total = Object.values(s).reduce((sum, c) => sum + (parseInt(c) || 0), 0);
          return { day: s.day || 0, mid: s.mid || 0, night: s.night || 0, total };
        };
        const sd = d.shiftData || {};
        setShiftData({ employees: proc(sd.employees), guests: proc(sd.guests) });
        setStats({
          staff: d.totalStaff ?? 0,
          menu: d.availableMenuItems ?? d.totalMenuItems ?? 0,
          employees: d.totalEmployees ?? ((d.totalUsers ?? 0) - (d.totalStaff || 0)),
          guests: d.totalGuests ?? 0,
          newItems: d.newItemsThisWeek ?? 0,
          todaysRevenue: d.todaysRevenue ?? 0,
          cycleData: d.cycleData || null,
        });
      }

      if (cycleRes.status === 'fulfilled' && cycleRes.value?.data) {
        setCycleAnalytics(cycleRes.value.data);
      }

      if (reportRes.status === 'fulfilled' && reportRes.value?.data) {
        setReportData(reportRes.value.data);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value?.data?.cycles) {
        setAllocationHistory(historyRes.value.data.cycles);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedCycle]);

  // Refetch when cycle filter changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Reset page when switching tabs or changing search/filter
  useEffect(() => {
    setCurrentPage(1);
  }, [activeReportTab, reportSearch, reportShiftFilter, reportStatusFilter, reportModeFilter, selectedCycle]);

  // Export handler with selected filters
  const handleDownloadReport = async (fmt = exportFormat, repType = exportReportType) => {
    try {
      setExporting(true);
      await reportsAPI.downloadReportFile({
        cycle: selectedCycle,
        shift: reportShiftFilter !== 'all' ? reportShiftFilter : undefined,
        status: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
        format: fmt,
        report_type: repType,
      });
      toast.success(`Report (${fmt.toUpperCase()}) downloaded successfully!`);
      setShowExportModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Canonical Cycle Metadata derived from shared service
  const todayIso = new Date().toISOString().split('T')[0];
  const cycle = cycleAnalytics?.cycle_info || stats.cycleData || {
    cycle_start: '2026-10-20',
    cycle_end: '2026-11-19',
    cycle_label: '20 Oct 2026 – 19 Nov 2026',
    next_allocation_date: '2026-11-20',
    last_token_allocated_date: '2026-10-20',
    has_past_reset: true,
    current_date: todayIso,
    days_elapsed: 3,
    total_days: 31,
    days_remaining: 29,
    allocation_day: 20,
    total_revenue_tokens: 0,
    total_orders_count: 0,
    tokens_allocated: 0,
    proposed_tokens_allocated: 0,
    tokens_remaining: 0,
    past_cycle_spent: 0,
    past_cycle_allocated: 0,
    past_cycle_unused: 0,
    burn_rate: 0,
    projected_revenue: 0,
    utilization_pct: 0,
    revenue_growth: 0
  };

  // Safe Cycle Dates for clean display
  const cycleStartFormatted = formatDateStr(cycle.cycle_start, { fullMonth: true });
  const cycleEndFormatted = formatDateStr(cycle.cycle_end, { fullMonth: true });
  const nextAllocationFormatted = formatDateStr(cycle.next_allocation_date, { fullMonth: true });
  const lastAllocatedFormatted = formatDateStr(cycle.last_token_allocated_date, { fullMonth: true });

  const dailySeries = cycleAnalytics?.daily_series || [];
  const maxDailyRevenue = Math.max(1, ...dailySeries.map((d) => d.tokens || 0));
  const shiftAnalytics = cycleAnalytics?.shift_analytics || {};
  const tiers = cycleAnalytics?.utilization_tiers || { low_0_25: 0, mid_26_50: 0, high_51_75: 0, max_76_100: 0 };

  // Available billing cycles for dropdown
  const availableCycles = reportData?.available_cycles || [
    { cycle_start: '2026-10-20', cycle_end: '2026-11-19', cycle_label: '20 Oct 2026 – 19 Nov 2026', is_current: true },
    { cycle_start: '2026-09-20', cycle_end: '2026-10-19', cycle_label: '20 Sep 2026 – 19 Oct 2026', is_current: false },
    { cycle_start: '2026-08-20', cycle_end: '2026-09-19', cycle_label: '20 Aug 2026 – 19 Sep 2026', is_current: false },
  ];

  // Cycle Status & Approval
  const isApproved = (cycle.tokens_allocated > 0);
  const resetDayNumber = cycle.allocation_day || 20;

  // Previous cycle metrics
  const pastSpent = cycle.past_cycle_spent ?? stats.cycleData?.pastCycleSpentTokens ?? 0;
  const pastAllocated = cycle.past_cycle_allocated ?? stats.cycleData?.pastCycleAllocatedTokens ?? 0;
  const pastUnused = cycle.past_cycle_unused ?? stats.cycleData?.pastCycleUnusedTokens ?? 0;
  const hasPreviousCycleData = pastSpent > 0 || pastAllocated > 0 || pastUnused > 0;

  // Sorting helper
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 1. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    if (!reportData?.transactions) return [];
    let list = reportData.transactions.filter((tx) => {
      const q = reportSearch.toLowerCase().trim();
      const matchSearch = !q ||
        String(tx.order_id).includes(q) ||
        (tx.username && tx.username.toLowerCase().includes(q)) ||
        (tx.name && tx.name.toLowerCase().includes(q)) ||
        (tx.user_id && tx.user_id.toLowerCase().includes(q)) ||
        (tx.items && tx.items.some((it) => it.item.toLowerCase().includes(q)));

      const matchShift = reportShiftFilter === 'all' || (tx.shift || 'day') === reportShiftFilter;
      const matchStatus = reportStatusFilter === 'all' || (tx.status || '').toLowerCase() === reportStatusFilter;
      return matchSearch && matchShift && matchStatus;
    });

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'order_id' || sortField === 'total_tokens') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [reportData, reportSearch, reportShiftFilter, reportStatusFilter, sortField, sortOrder]);

  // 2. Filtered Allocations
  const filteredAllocations = useMemo(() => {
    if (!reportData?.token_allocations) return [];
    let list = reportData.token_allocations.filter((alc) => {
      const q = reportSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (alc.username && alc.username.toLowerCase().includes(q)) ||
        (alc.name && alc.name.toLowerCase().includes(q)) ||
        (alc.user_id && alc.user_id.toLowerCase().includes(q));

      const matchShift = reportShiftFilter === 'all' || (alc.shift || 'day') === reportShiftFilter;
      return matchSearch && matchShift;
    });

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'number') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [reportData, reportSearch, reportShiftFilter, sortField, sortOrder]);

  // 3. Filtered History
  const filteredHistory = useMemo(() => {
    if (!allocationHistory) return [];
    return allocationHistory.filter((hist) => {
      const q = reportSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (hist.billing_cycle && hist.billing_cycle.toLowerCase().includes(q)) ||
        (hist.approved_by && hist.approved_by.toLowerCase().includes(q)) ||
        (hist.notes && hist.notes.toLowerCase().includes(q));

      const matchMode = reportModeFilter === 'all' || (hist.allocation_mode_raw || hist.allocation_mode || '').toLowerCase() === reportModeFilter;
      const matchStatus = reportStatusFilter === 'all' || (hist.allocation_status || '').toLowerCase().includes(reportStatusFilter);
      return matchSearch && matchMode && matchStatus;
    });
  }, [allocationHistory, reportSearch, reportModeFilter, reportStatusFilter]);

  // Paginated Slices
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const paginatedAllocations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAllocations.slice(start, start + pageSize);
  }, [filteredAllocations, currentPage, pageSize]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  const totalCount = activeReportTab === 'transactions' 
    ? filteredTransactions.length 
    : (activeReportTab === 'allocations' ? filteredAllocations.length : filteredHistory.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (loading && !cycleAnalytics) {
    return (
      <div className="space-y-6 pb-16">
        <SectionHeading 
          kicker="VDart Cafe Administration" 
          title="Loading Executive Dashboard…" 
          hint="Calculating billing cycle boundaries and reconciling live ledger records…" 
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card animate-pulse">
              <div className="h-10 w-10 rounded-2xl bg-slate-200" />
              <div className="mt-5 h-8 w-28 rounded-full bg-slate-200" />
              <div className="mt-2 h-3 w-40 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Page Title & Header Actions */}
      <SectionHeading
        kicker="VDart Cafe Corporate Administration"
        title={`Welcome, ${(user?.name || 'Administrator').split(' ')[0]}`}
        hint={`Billing Cycle: ${cycleStartFormatted} through ${cycleEndFormatted} (Asia/Kolkata timezone)`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setShowExportModal(true)} 
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-cobalt-200 bg-cobalt-50 px-3.5 py-2 text-xs font-bold text-cobalt-900 shadow-2xs hover:bg-cobalt-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-cobalt-700" strokeWidth={2} />
              Export Monthly Report (Excel / CSV)
            </button>
            <button 
              onClick={fetchDashboardData} 
              className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-ink shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} /> Refresh
            </button>
          </div>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* ACTIVE MONTHLY TOKEN CYCLE OVERVIEW                           */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-card transition-all relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${
                cycle.tokens_allocated > 0 || isApproved
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-cobalt-50 text-cobalt-900 border-cobalt-200'
              }`}>
                {cycle.tokens_allocated > 0 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Allocated & Active
                  </>
                ) : (
                  <>
                    <Coins className="h-3.5 w-3.5 text-cobalt-600" />
                    Quotas Scheduled
                  </>
                )}
              </span>

              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                Cycle: <strong className="text-ink font-semibold">{cycleStartFormatted} – {cycleEndFormatted}</strong>
              </span>

              <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                Day {cycle.days_elapsed || 1} of {cycle.total_days || 31} · Next Reset: <strong className="text-cobalt-800">{nextAllocationFormatted}</strong>
              </span>
            </div>

            <h2 className="text-base font-extrabold text-ink tracking-tight">
              Monthly Cafeteria Token Cycle
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/tokens')}
              className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-cobalt-800 text-white px-4 py-2 text-xs font-bold shadow-sm hover:bg-cobalt-900 transition-colors"
            >
              <Coins className="h-4 w-4" />
              Manage Token Quotas
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setActiveReportTab('history')}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              Cycle History
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="rounded-2xl bg-paper border border-slate-200/80 p-3.5 text-center">
            <span className="text-[11px] font-mono text-ink-mute uppercase tracking-wider block">Allocated Quota</span>
            <span className="font-mono text-xl font-black text-ink mt-0.5 block">
              {cycle.tokens_allocated > 0 ? cycle.tokens_allocated.toLocaleString() : (cycle.proposed_tokens_allocated?.toLocaleString() || '0')}
            </span>
            <span className="text-[10px] text-ink-mute block">tokens for current cycle</span>
          </div>

          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/80 p-3.5 text-center">
            <span className="text-[11px] font-mono text-emerald-800 uppercase tracking-wider block">Total Spent</span>
            <span className="font-mono text-xl font-black text-emerald-950 mt-0.5 block">
              {cycle.total_revenue_tokens?.toLocaleString() ?? 0}
            </span>
            <span className="text-[10px] text-emerald-800 block">{cycle.total_orders_count ?? 0} counter orders</span>
          </div>

          <div className="rounded-2xl bg-paper border border-slate-200/80 p-3.5 text-center">
            <span className="text-[11px] font-mono text-ink-mute uppercase tracking-wider block">Remaining Balance</span>
            <span className="font-mono text-xl font-black text-ink mt-0.5 block">
              {cycle.tokens_remaining?.toLocaleString() ?? 0}
            </span>
            <span className="text-[10px] text-ink-mute block">spendable balance</span>
          </div>

          <div className="rounded-2xl bg-cobalt-50/50 border border-cobalt-200/80 p-3.5 text-center">
            <span className="text-[11px] font-mono text-cobalt-800 uppercase tracking-wider block">Cycle Utilization</span>
            <span className="font-mono text-xl font-black text-cobalt-950 mt-0.5 block">
              {cycle.utilization_pct}%
            </span>
            <span className="text-[10px] text-cobalt-700 block">Avg: {cycle.burn_rate} tk/day</span>
          </div>
        </div>

        {/* Sleek Cycle Timeline Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-mono text-ink-mute mb-1.5">
            <span>Started: {cycleStartFormatted}</span>
            <span className="font-semibold text-ink">Cycle Progress: Day {cycle.days_elapsed} of {cycle.total_days} ({Math.round(((cycle.days_elapsed || 1) / (cycle.total_days || 31)) * 100)}%)</span>
            <span>Next Renewal: {nextAllocationFormatted}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round(((cycle.days_elapsed || 1) / (cycle.total_days || 31)) * 100))}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-cobalt-600 to-emerald-500 rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: CORRECT KPI CARDS                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Cycle Revenue (Completed Orders Only) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0 }}
          className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-emerald-100/30 to-white p-5 shadow-2xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-mono font-bold border ${
              (cycle.revenue_growth ?? 0) >= 0 
                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300' 
                : 'bg-rose-100 text-rose-900 border-rose-300'
            }`}>
              {(cycle.revenue_growth ?? 0) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(cycle.revenue_growth ?? 0)}% vs last cycle
            </span>
          </div>

          <p className="mt-3 font-mono text-3xl sm:text-4xl font-black tracking-tight text-emerald-950">
            {cycle.total_revenue_tokens?.toLocaleString() ?? 0} <span className="text-base font-medium font-sans text-emerald-800">tk</span>
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-900">
            <span className="font-semibold">Cycle Consumed Revenue</span>
            <span className="font-mono">{cycle.total_orders_count ?? 0} orders</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-800 font-mono">
            Burn rate: <strong>{cycle.burn_rate ?? 0} tk/day</strong> · Projected: {cycle.projected_revenue ?? 0} tk
          </p>
        </motion.div>

        {/* KPI 2: Tokens Allocated (Credited to Diners) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="rounded-3xl border border-cobalt-200 bg-gradient-to-br from-cobalt-50/90 via-cobalt-100/30 to-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cobalt-600 text-white shadow-2xs">
              <Coins className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-cobalt-100 px-2 py-0.5 text-[11px] font-mono font-bold text-cobalt-900 border border-cobalt-300">
              {cycle.utilization_pct ?? 0}% Utilized
            </span>
          </div>

          <p className="mt-3 font-mono text-3xl sm:text-4xl font-black tracking-tight text-cobalt-950">
            {cycle.tokens_allocated > 0 ? cycle.tokens_allocated.toLocaleString() : '0'} <span className="text-base font-medium font-sans text-cobalt-800">credited</span>
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-cobalt-900">
            <span className="font-semibold">Credited Token Allocations</span>
            <span className="font-mono text-slate-600">
              {cycle.tokens_allocated > 0 ? 'Active Quotas' : `Quota: ${cycle.proposed_tokens_allocated?.toLocaleString() ?? 0} tk`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, cycle.utilization_pct ?? 0)}%` }}
              transition={{ duration: 0.7 }}
              className="h-full bg-cobalt-600 rounded-full"
            />
          </div>
        </motion.div>

        {/* KPI 3: Today's Consumption (IST Boundaries) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-paper-dark text-cobalt-700">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-800">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-600" /> Live IST
            </span>
          </div>

          <p className="mt-3 font-mono text-3xl sm:text-4xl font-black tracking-tight text-ink">
            {stats.todaysRevenue?.toLocaleString() ?? 0} <span className="text-base font-medium font-sans text-ink-mute">tk today</span>
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-ink-mute">
            <span>Today's Counter Consumption</span>
            <span className="font-mono text-ink font-semibold">{stats.menu} live dishes</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-mute">
            {stats.newItems > 0 ? `+${stats.newItems} added this week` : 'Standard cafeteria operations'}
          </p>
        </motion.div>

        {/* KPI 4: Registered Diners & Shift Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-paper-dark text-slate-800">
              <Users className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-ink-mute">
              {stats.staff} staff crew
            </span>
          </div>

          <p className="mt-3 font-mono text-3xl sm:text-4xl font-black tracking-tight text-ink">
            {stats.employees + stats.guests} <span className="text-base font-medium font-sans text-ink-mute">diners</span>
          </p>
          <div className="mt-1 flex items-center justify-between text-xs text-ink-mute">
            <span>Eligible Diner Personnel</span>
            <span className="font-mono font-bold text-ink">{stats.guests} guests</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-mute font-mono">
            Day: {shiftData.employees.day || 0} · Mid: {shiftData.employees.mid || 0} · Night: {shiftData.employees.night || 0}
          </p>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: ADVANCED CHARTS                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Daily Spending Velocity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <BarChart3 className="h-4.5 w-4.5 text-cobalt-600" />
                  Daily Token Consumption Velocity ({cycleStartFormatted} – {cycleEndFormatted})
                </h3>
                <p className="text-xs text-ink-mute">
                  Day-by-day token burn across all cafeteria order registers in the active billing cycle
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-800 self-start sm:self-auto">
                Total: {cycle.total_revenue_tokens?.toLocaleString() ?? 0} tokens ({dailySeries.length} cycle days)
              </span>
            </div>

            {/* Velocity Bars */}
            <div className="pt-4 pb-2">
              {dailySeries.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-mute italic">
                  No orders recorded yet in this monthly allocation cycle.
                </div>
              ) : (
                <div className="grid grid-flow-col auto-cols-fr gap-1 items-end h-44 border-b border-slate-200">
                  {dailySeries.map((d, idx) => {
                    const heightPct = d.tokens > 0 
                      ? Math.max(8, Math.round((d.tokens / maxDailyRevenue) * 100)) 
                      : 4;
                    return (
                      <div key={d.date} className="flex flex-col items-center justify-end h-full group relative">
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute -top-9 z-20 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-white shadow-md group-hover:block">
                          {d.label}: {d.tokens} tk ({d.orders} orders)
                        </div>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ duration: 0.3, delay: Math.min(0.3, idx * 0.01) }}
                          className={`w-full rounded-t-sm transition-colors ${
                            d.tokens > 0 
                              ? 'bg-cobalt-600 hover:bg-cobalt-700' 
                              : 'bg-slate-100 hover:bg-slate-200'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Labels */}
              <div className="flex justify-between items-center text-[10px] font-mono text-ink-mute pt-2">
                <span>Cycle Start: {cycleStartFormatted}</span>
                <span>Today: {formatDateStr(cycle.current_date)}</span>
                <span>Cycle End: {cycleEndFormatted}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-ink-mute gap-2">
            <span>Average Burn: <strong className="font-mono text-ink">{cycle.burn_rate} tokens/day</strong></span>
            <span>Cumulative to Date: <strong className="font-mono text-emerald-800">{cycle.total_revenue_tokens?.toLocaleString() ?? 0} tokens</strong></span>
            <span>Projected Cycle Total: <strong className="font-mono text-cobalt-800">{cycle.projected_revenue?.toLocaleString() ?? 0} tokens</strong></span>
          </div>
        </motion.div>

        {/* Shift Economics & Wallet Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-4 space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Flame className="h-4.5 w-4.5 text-cobalt-600" />
              Shift-wise Consumption Breakdown
            </h3>
            <p className="text-xs text-ink-mute">Cycle token utilization by work shift</p>
          </div>

          <div className="space-y-3">
            {[
              { key: 'day', label: 'Day Shift', Icon: Sunrise, color: 'bg-cobalt-500' },
              { key: 'mid', label: 'Mid Shift', Icon: Sunset, color: 'bg-indigo-500' },
              { key: 'night', label: 'Night Shift', Icon: MoonStar, color: 'bg-slate-800' },
            ].map((s) => {
              const data = shiftAnalytics[s.key] || { allocated: 0, spent: 0, balance: 0, users: 0, utilization: 0 };
              return (
                <div key={s.key} className="rounded-2xl bg-paper p-3 space-y-1.5 border border-slate-200/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink flex items-center gap-1.5">
                      <s.Icon className="h-3.5 w-3.5 text-ink-mute" />
                      {s.label} ({data.users} diners)
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {data.spent} / {data.allocated} tk ({data.utilization}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, data.utilization)}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full rounded-full ${s.color}`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-0.5">
                    <span>Balance Remaining: <strong>{data.balance} tk</strong></span>
                    <span>{data.orders || 0} orders</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Non-overlapping Wallet Burn Tiers */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-ink mb-1.5">Employee Wallet Burn Distribution</p>
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="rounded-xl border border-slate-200/80 p-2">
                <span className="text-[10px] font-mono text-ink-mute block">0–25%</span>
                <span className="font-mono font-bold text-ink text-sm">{tiers.low_0_25 || 0}</span>
                <span className="text-[9px] text-slate-400 block">diners</span>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-2">
                <span className="text-[10px] font-mono text-ink-mute block">26–50%</span>
                <span className="font-mono font-bold text-ink text-sm">{tiers.mid_26_50 || tiers.mid_25_50 || 0}</span>
                <span className="text-[9px] text-slate-400 block">diners</span>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-2">
                <span className="text-[10px] font-mono text-ink-mute block">51–75%</span>
                <span className="font-mono font-bold text-ink text-sm">{tiers.high_51_75 || tiers.high_50_75 || 0}</span>
                <span className="text-[9px] text-slate-400 block">diners</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                <span className="text-[10px] font-mono text-emerald-800 font-bold block">76–100%</span>
                <span className="font-mono font-bold text-emerald-950 text-sm">{tiers.max_76_100 || tiers.max_75_100 || 0}</span>
                <span className="text-[9px] text-emerald-700 block">diners</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 6: MONTHLY PRE-ALLOCATION AUDIT & REPORTING HUB        */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-cobalt-600" />
              Monthly Audit & Transaction Records
            </h3>
            <p className="text-xs text-ink-mute">
              Real-time order transaction logs, token allocations, and billing cycle history
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownloadReport('xlsx', activeReportTab)}
              disabled={exporting}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Excel Workbook (.xlsx)
            </button>
            <button
              onClick={() => handleDownloadReport('csv', activeReportTab)}
              disabled={exporting}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              Export Active Tab (.csv)
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100"
            >
              More Options…
            </button>
          </div>
        </div>

        {/* Tab Switcher & Full Filter Toolbar */}
        <div className="flex flex-col space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-2xl bg-paper p-1 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveReportTab('transactions')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                  activeReportTab === 'transactions'
                    ? 'bg-white text-ink shadow-2xs'
                    : 'text-ink-mute hover:text-ink'
                }`}
              >
                Order Transaction Details ({filteredTransactions.length})
              </button>
              <button
                onClick={() => setActiveReportTab('allocations')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                  activeReportTab === 'allocations'
                    ? 'bg-white text-ink shadow-2xs'
                    : 'text-ink-mute hover:text-ink'
                }`}
              >
                Token Allocation Details ({filteredAllocations.length})
              </button>
              <button
                onClick={() => setActiveReportTab('history')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                  activeReportTab === 'history'
                    ? 'bg-white text-ink shadow-2xs'
                    : 'text-ink-mute hover:text-ink'
                }`}
              >
                Monthly Allocation History ({filteredHistory.length})
              </button>
            </div>

            {/* Cycle Selector Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-mute whitespace-nowrap">Billing Cycle:</span>
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500 shadow-2xs"
              >
                <option value="current">Current Cycle ({cycle.cycle_label})</option>
                {availableCycles.filter(c => !c.is_current).map((c) => (
                  <option key={c.cycle_start} value={c.cycle_start}>
                    {c.cycle_label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeReportTab === 'transactions' 
                    ? "Search order #, employee ID, name, items…"
                    : (activeReportTab === 'allocations' ? "Search employee ID, name…" : "Search cycle, approver, notes…")
                }
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 outline-none focus:border-cobalt-500 shadow-2xs"
              />
            </div>

            {/* Shift Filter (for transactions & allocations) */}
            {activeReportTab !== 'history' && (
              <select
                value={reportShiftFilter}
                onChange={(e) => setReportShiftFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500 shadow-2xs"
              >
                <option value="all">All Shifts</option>
                <option value="day">Day Shift</option>
                <option value="mid">Mid Shift</option>
                <option value="night">Night Shift</option>
              </select>
            )}

            {/* Status Filter (for transactions) */}
            {activeReportTab === 'transactions' && (
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500 shadow-2xs"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            {/* Mode Filter (for history) */}
            {activeReportTab === 'history' && (
              <>
                <select
                  value={reportModeFilter}
                  onChange={(e) => setReportModeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500 shadow-2xs"
                >
                  <option value="all">All Allocation Modes</option>
                  <option value="automatic">Automatic Mode</option>
                  <option value="manual">Manual Mode</option>
                </select>

                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500 shadow-2xs"
                >
                  <option value="all">All Approval Statuses</option>
                  <option value="approved">Approved & Distributed</option>
                  <option value="pending">Pending Review</option>
                  <option value="proposal">Upcoming Proposal</option>
                </select>
              </>
            )}

            {/* Reset Filters CTA */}
            {(reportSearch || reportShiftFilter !== 'all' || reportStatusFilter !== 'all' || reportModeFilter !== 'all') && (
              <button
                onClick={() => {
                  setReportSearch('');
                  setReportShiftFilter('all');
                  setReportStatusFilter('all');
                  setReportModeFilter('all');
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: Total Transactions Details Table                        */}
        {/* ------------------------------------------------------------- */}
        {activeReportTab === 'transactions' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-paper text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                    <th className="py-2.5 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('order_id')}>
                      <div className="flex items-center gap-1">Order # <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('date')}>
                      <div className="flex items-center gap-1">Date & Time (IST) <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3">Employee ID</th>
                    <th className="py-2.5 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Diner Name <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Dishes Itemized</th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:text-ink" onClick={() => handleSort('total_tokens')}>
                      <div className="flex items-center justify-end gap-1">Tokens <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-ink-mute italic">
                        No transactions recorded for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => (
                      <tr key={tx.order_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ink">#{tx.order_id}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-ink-mute whitespace-nowrap">{formatDateTimeStr(tx.date)}</td>
                        <td className="py-2.5 px-3 font-mono text-ink font-semibold">{tx.user_id || '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-ink">{tx.name || tx.username}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-ink-mute">
                            {tx.shift || 'day'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-[11px] text-slate-700">
                          {tx.items ? tx.items.map((it) => `${it.qty}x ${it.item}`).join(', ') : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-ink">
                          {tx.total_tokens} tk
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                            tx.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: Token Allocated Details Table                           */}
        {/* ------------------------------------------------------------- */}
        {activeReportTab === 'allocations' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-paper text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                    <th className="py-2.5 px-3">Employee ID</th>
                    <th className="py-2.5 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Employee Name <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Work Shift</th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:text-ink" onClick={() => handleSort('tokens_allocated')}>
                      <div className="flex items-center justify-end gap-1">Allocated <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:text-ink" onClick={() => handleSort('tokens_spent')}>
                      <div className="flex items-center justify-end gap-1">Spent <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:text-ink" onClick={() => handleSort('tokens_remaining')}>
                      <div className="flex items-center justify-end gap-1">Balance <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-right cursor-pointer hover:text-ink" onClick={() => handleSort('utilization_pct')}>
                      <div className="flex items-center justify-end gap-1">Utilization <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-ink-mute italic">
                        No token allocations match the criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedAllocations.map((alc) => (
                      <tr key={alc.user_id || alc.username} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ink">{alc.user_id || '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-ink">{alc.name || alc.username}</td>
                        <td className="py-2.5 px-3 capitalize text-ink-mute">{alc.role}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-ink-mute">
                            {alc.shift || 'day'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-cobalt-900">
                          {alc.tokens_allocated} tk
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-900">
                          {alc.tokens_spent} tk
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                          {alc.tokens_remaining} tk
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {alc.orders_count}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-mono font-bold ${
                            alc.utilization_pct >= 75
                              ? 'bg-emerald-50 text-emerald-800'
                              : (alc.utilization_pct >= 40 ? 'bg-cobalt-50 text-cobalt-800' : 'bg-slate-100 text-slate-700')
                          }`}>
                            {alc.utilization_pct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: Monthly Allocation History Table                        */}
        {/* ------------------------------------------------------------- */}
        {activeReportTab === 'history' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-paper text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                    <th className="py-2.5 px-3">Billing Cycle</th>
                    <th className="py-2.5 px-3">Reset Day / Scheduled</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Eligible Diners</th>
                    <th className="py-2.5 px-3 text-right">Allocated Tokens</th>
                    <th className="py-2.5 px-3 text-right">Consumed</th>
                    <th className="py-2.5 px-3 text-right">Unused / Expired</th>
                    <th className="py-2.5 px-3 text-center">Approval Status</th>
                    <th className="py-2.5 px-3">Approved By / At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-ink-mute italic">
                        No historical allocation records match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((hist) => (
                      <tr key={hist.id || hist.cycle_start} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ink">
                          {hist.billing_cycle || `${formatDateStr(hist.cycle_start)} – ${formatDateStr(hist.cycle_end)}`}
                          {hist.is_current && (
                            <span className="ml-1.5 rounded-full bg-cobalt-100 text-cobalt-800 px-1.5 py-0.5 text-[9px] uppercase font-bold">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {formatDateStr(hist.reset_date || hist.cycle_start)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-ink-mute">
                            {hist.allocation_mode_raw || hist.allocation_mode || 'automatic'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-ink">
                          {hist.eligible_personnel_count ?? hist.diner_count ?? '—'} diners
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-cobalt-900">
                          {(hist.actual_allocated_tokens || hist.distributed_tokens || hist.proposed_allocation)?.toLocaleString() ?? 0} tk
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-800">
                          {(hist.tokens_spent || hist.spent_tokens)?.toLocaleString() ?? 0} tk
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {(hist.unused_or_expired_tokens || hist.unused_tokens)?.toLocaleString() ?? 0} tk
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                            (hist.allocation_status || '').toLowerCase().includes('approved') || (hist.allocation_status || '').toLowerCase().includes('distributed')
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : (hist.allocation_status || '').toLowerCase().includes('due') || (hist.allocation_status || '').toLowerCase().includes('awaiting')
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {hist.allocation_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {hist.approved_by ? (
                            <span>{hist.approved_by} ({formatDateStr(hist.approved_at)})</span>
                          ) : (
                            <span className="text-slate-400 italic">Pending authorization</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-ink-mute">
          <div className="flex items-center gap-2">
            <span>Showing {Math.min(totalCount, (currentPage - 1) * pageSize + 1)} to {Math.min(totalCount, currentPage * pageSize)} of {totalCount} records</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-ink outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="btn-tactile rounded-lg border border-slate-200 bg-white p-1.5 text-ink hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-mono font-bold text-ink">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn-tactile rounded-lg border border-slate-200 bg-white p-1.5 text-ink hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* EXPORT MODAL                                                  */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cobalt-100 text-cobalt-700">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">Export Monthly Report</h3>
                    <p className="text-xs text-ink-mute">Cycle transactions and token allocations</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Format selection */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-2">Export File Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'xlsx', label: 'Excel Sheet', ext: '.xlsx', Icon: FileSpreadsheet },
                      { id: 'csv', label: 'CSV File', ext: '.csv', Icon: FileSpreadsheet },
                      { id: 'pdf', label: 'PDF Report', ext: '.pdf', Icon: FileText },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setExportFormat(fmt.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                          exportFormat === fmt.id
                            ? 'border-cobalt-600 bg-cobalt-50/70 text-cobalt-900 ring-2 ring-cobalt-500/20'
                            : 'border-slate-200 bg-white text-ink hover:border-slate-300'
                        }`}
                      >
                        <fmt.Icon className={`h-5 w-5 mb-1 ${exportFormat === fmt.id ? 'text-cobalt-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold">{fmt.label}</span>
                        <span className="text-[10px] text-ink-mute font-mono">{fmt.ext}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Report Type */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">Report Contents</label>
                  <select
                    value={exportReportType}
                    onChange={(e) => setExportReportType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-cobalt-500"
                  >
                    <option value="all">Full Comprehensive Audit (Summary + Token Allocations + Transactions + Menu)</option>
                    <option value="transactions">All Transactions & Orders Log</option>
                    <option value="allocations">User Token Allocations & Diners Quotas</option>
                    <option value="menu">Kitchen Food Menu Catalogs & Pricing</option>
                    <option value="system_audit">System Token Reset & Policy Audit Logs</option>
                  </select>
                </div>

                {/* Cycle Target */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">Target Billing Cycle</label>
                  <select
                    value={selectedCycle}
                    onChange={(e) => setSelectedCycle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-cobalt-500"
                  >
                    <option value="current">Current Cycle ({cycle.cycle_label})</option>
                    {availableCycles.filter(c => !c.is_current).map((c) => (
                      <option key={c.cycle_start} value={c.cycle_start}>
                        {c.cycle_label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-ink-mute space-y-1">
                  <p className="font-semibold text-ink">Cycle Details:</p>
                  <p>• Billing Cycle: 20th of previous month through 19th of current month (Asia/Kolkata)</p>
                  <p>• Excel workbook contains formatted sheets: Executive Analytics, Token Allocated Details, and Total Transactions Details</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  disabled={exporting}
                  className="btn-tactile rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReport(exportFormat, exportReportType)}
                  disabled={exporting}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-cobalt-600 px-5 py-2 text-xs font-bold text-white hover:bg-cobalt-700 disabled:opacity-50 transition-colors shadow-2xs"
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download {exportFormat.toUpperCase()} Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
