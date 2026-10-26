import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UtensilsCrossed, 
  Receipt, 
  RotateCcw, 
  Search, 
  Filter, 
  Clock, 
  TrendingUp, 
  Flame, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChefHat, 
  Coffee, 
  Download,
  Calendar,
  Layers,
  Sparkles,
  Users
} from 'lucide-react';
import { staffAdminAPI, reportsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import SectionHeading from '../../components/canteen/SectionHeading';
import ReceiptModal from '../../components/canteen/ReceiptModal';
import VegBadge from '../../components/canteen/VegBadge';
import DateRangePicker from '../../components/canteen/DateRangePicker';

const spring = { type: 'spring', stiffness: 120, damping: 20 };

const StaffAdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exportRange, setExportRange] = useState({ startDate: '', endDate: '' });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await staffAdminAPI.getDashboard(60);
      setDashboardData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to load cafeteria transactions data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportTransactions = async (format = 'xlsx') => {
    if (exportRange.startDate && exportRange.endDate && exportRange.startDate > exportRange.endDate) {
      toast.error('The "From" date must be on or before the "To" date.');
      return;
    }
    try {
      setExporting(true);
      const hasRange = exportRange.startDate && exportRange.endDate;
      await reportsAPI.downloadReportFile({
        format,
        report_type: 'transactions',
        cycle: hasRange ? undefined : 'current',
        start_date: exportRange.startDate || undefined,
        end_date: exportRange.endDate || undefined,
      });
      toast.success(`Cafeteria transactions exported successfully (${format.toUpperCase()})!`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to export cafeteria transactions');
    } finally {
      setExporting(false);
    }
  };

  // Filtered live cafeteria transactions
  const filteredTransactions = useMemo(() => {
    if (!dashboardData?.live_transactions) return [];
    return dashboardData.live_transactions.filter((tx) => {
      // Search filter
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        String(tx.id).includes(q) ||
        (tx.customer_name && tx.customer_name.toLowerCase().includes(q)) ||
        (tx.user_id && tx.user_id.toLowerCase().includes(q)) ||
        (tx.username && tx.username.toLowerCase().includes(q)) ||
        (tx.items && tx.items.some((it) => it.toLowerCase().includes(q)));

      // Status filter
      let matchStatus = true;
      if (statusFilter === 'in_kitchen') {
        matchStatus = tx.status === 'pending' || tx.status === 'approved';
      } else if (statusFilter !== 'all') {
        matchStatus = tx.status === statusFilter;
      }

      // Shift filter
      const matchShift = shiftFilter === 'all' || (tx.work_shift || 'day') === shiftFilter;

      return matchSearch && matchStatus && matchShift;
    });
  }, [dashboardData, searchTerm, statusFilter, shiftFilter]);

  if (loading && !dashboardData) {
    return (
      <div className="space-y-6 pb-16">
        <SectionHeading kicker="Cafeteria Operations" title="Loading Cafeteria Transactions…" hint="Connecting to kitchen station and live transaction ledger…" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs animate-pulse">
              <div className="h-4 w-20 rounded-md bg-slate-200" />
              <div className="mt-3 h-8 w-28 rounded-md bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const queue = dashboardData?.queue_counts || { pending: 0, approved: 0, completed: 0, declined: 0, cancelled: 0, total: 0 };
  const categories = dashboardData?.category_breakdown || { meal: 0, snack: 0, beverage: 0 };
  const totalCatItems = (categories.meal || 0) + (categories.snack || 0) + (categories.beverage || 0) || 1;
  const shiftBreakdown = dashboardData?.shift_breakdown || { day: 0, mid: 0, night: 0 };
  const topDishes = dashboardData?.top_dishes || [];
  const hourlyRush = dashboardData?.hourly_rush || [];
  const maxHourlyOrders = Math.max(1, ...hourlyRush.map((h) => h.orders || 0));

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <SectionHeading
        kicker="Staff Admin Portal"
        title="Cafeteria Transactions & Analytics"
        hint="Live monitoring of cafeteria orders, kitchen volume, food sales and dish popularity."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDatePicker((v) => !v)}
              aria-expanded={showDatePicker}
              className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-colors ${
                showDatePicker || (exportRange.startDate && exportRange.endDate)
                  ? 'border-cobalt-300 bg-cobalt-50 text-cobalt-800 hover:bg-cobalt-100'
                  : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-cobalt-600" />
              {exportRange.startDate && exportRange.endDate ? 'Date Range Set' : 'Date Range'}
            </button>
            <button
              onClick={() => handleExportTransactions('xlsx')}
              disabled={exporting}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-emerald-700" />
              Export Orders (Excel)
            </button>
            <button
              onClick={fetchDashboardData}
              className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {showDatePicker && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring}
          >
            <DateRangePicker
              startDate={exportRange.startDate}
              endDate={exportRange.endDate}
              onChange={setExportRange}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Token Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0 }}
          className="rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 p-5 text-emerald-950 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Today's Food Revenue
            </span>
          </div>
          <p className="mt-3 font-mono-tokens text-3xl font-black tracking-tight text-emerald-950">
            {dashboardData?.today_tokens_revenue ?? 0} <span className="text-base font-medium font-sans text-emerald-800">tokens</span>
          </p>
          <p className="mt-1 text-xs text-emerald-800 font-medium">
            7-Day volume: <strong className="font-mono-tokens">{dashboardData?.week_tokens_revenue ?? 0} tk</strong>
          </p>
        </motion.div>

        {/* Dishes Served */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="rounded-3xl border border-cobalt-200/90 bg-gradient-to-br from-cobalt-50/90 to-cobalt-100/50 p-5 text-cobalt-950 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cobalt-600 text-white shadow-2xs">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-wider text-cobalt-800">
              Dishes Plated Today
            </span>
          </div>
          <p className="mt-3 font-mono-tokens text-3xl font-black tracking-tight text-cobalt-950">
            {dashboardData?.today_dishes_served ?? 0} <span className="text-base font-medium font-sans text-cobalt-800">items</span>
          </p>
          <p className="mt-1 text-xs text-cobalt-800 font-medium">
            Across meals, snacks & drinks
          </p>
        </motion.div>

        {/* Completed Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700 border border-leaf-200 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-wider text-ink-mute">
              Completed Orders
            </span>
          </div>
          <p className="mt-3 font-mono-tokens text-3xl font-black tracking-tight text-ink">
            {dashboardData?.today_orders_count ?? 0}
          </p>
          <p className="mt-1 text-xs text-ink-mute">
            {queue.declined + queue.cancelled} cancelled / declined today
          </p>
        </motion.div>

        {/* Active Kitchen Queue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
          className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-amber-100/50 p-5 text-amber-950 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-2xs">
              <ChefHat className="h-5 w-5" />
            </span>
            <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Kitchen Queue
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono-tokens text-3xl font-black text-amber-950">
              {queue.pending + queue.approved}
            </span>
            <span className="text-xs font-semibold text-amber-800">
              ({queue.pending} pending · {queue.approved} in pass)
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-900 font-medium">
            Awaiting pickup / counter verification
          </p>
        </motion.div>
      </div>

      {/* Analytics Grid: Hourly Rush + Popular Dishes + Categories */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Hourly Rush Curve */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-7 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
                  <Clock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">Hourly Cafeteria Traffic</h3>
                  <p className="text-xs text-ink-mute">Today's transaction volume across operating hours</p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-mono-tokens font-semibold text-ink-mute">
                8:00 AM – 10:00 PM
              </span>
            </div>

            {/* Bars */}
            <div className="grid grid-cols-8 sm:grid-cols-15 gap-1.5 items-end h-40 pt-6 pb-2">
              {hourlyRush.map((hr) => {
                const heightPct = Math.max(8, Math.round((hr.orders / maxHourlyOrders) * 100));
                const isPeak = hr.orders === maxHourlyOrders && hr.orders > 0;
                return (
                  <div key={hr.hour} className="flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-white shadow-md group-hover:block">
                      {hr.hour}: {hr.orders} orders ({hr.tokens} tk)
                    </div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`w-full rounded-t-md transition-colors ${
                        isPeak 
                          ? 'bg-amber-500 hover:bg-amber-600' 
                          : (hr.orders > 0 ? 'bg-cobalt-500 hover:bg-cobalt-600' : 'bg-slate-100')
                      }`}
                    />
                    <span className="mt-1 text-[9px] font-mono text-ink-mute">
                      {hr.hour.split(':')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-ink-mute">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-cobalt-500" /> Regular rush
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Peak rush hour
            </span>
            <span className="font-mono-tokens font-semibold text-ink">
              Total Today: {queue.total} orders
            </span>
          </div>
        </motion.div>

        {/* Popular Dishes + Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Flame className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Top Cafeteria Dishes Today</h3>
                <p className="text-xs text-ink-mute">Ranked by order quantity</p>
              </div>
            </div>
          </div>

          {/* Dishes List */}
          <div className="space-y-2">
            {topDishes.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-mute italic">No dishes ordered yet today.</p>
            ) : (
              topDishes.map((dish, idx) => (
                <div key={dish.name} className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-ink-mute font-mono">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink flex items-center gap-1">
                        {dish.name}
                        <VegBadge isVeg={dish.is_veg} compact />
                      </p>
                      <span className="text-[10px] text-ink-mute uppercase font-mono">{dish.category}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-ink font-mono-tokens">{dish.quantity} served</p>
                    <p className="text-[10px] text-emerald-700 font-mono-tokens font-semibold">{dish.tokens} tk</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Category Split */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-ink mb-2">Item Categories Breakdown</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200/80 p-2 text-center">
                <p className="text-[10px] font-mono uppercase text-ink-mute font-semibold">Meals</p>
                <p className="font-mono-tokens text-sm font-bold text-ink mt-0.5">{categories.meal || 0}</p>
                <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-cobalt-600 rounded-full" style={{ width: `${Math.round(((categories.meal || 0) / totalCatItems) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-2 text-center">
                <p className="text-[10px] font-mono uppercase text-ink-mute font-semibold">Snacks</p>
                <p className="font-mono-tokens text-sm font-bold text-ink mt-0.5">{categories.snack || 0}</p>
                <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(((categories.snack || 0) / totalCatItems) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 p-2 text-center">
                <p className="text-[10px] font-mono uppercase text-ink-mute font-semibold">Beverages</p>
                <p className="font-mono-tokens text-sm font-bold text-ink mt-0.5">{categories.beverage || 0}</p>
                <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(((categories.beverage || 0) / totalCatItems) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live Cafeteria Transactions Ledger */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
              <Receipt className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">Live Cafeteria Transactions Feed</h3>
              <p className="text-xs text-ink-mute">
                Real-time cafeteria counter orders and pickup status ({filteredTransactions.length} matching)
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders, diners, dishes…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 outline-none focus:border-cobalt-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500"
            >
              <option value="all">All Statuses</option>
              <option value="in_kitchen">In Kitchen / Pass</option>
              <option value="completed">Completed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Shift Filter */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-cobalt-500"
            >
              <option value="all">All Shifts</option>
              <option value="day">Day Shift</option>
              <option value="mid">Mid Shift</option>
              <option value="night">Night Shift</option>
            </select>

            <button
              onClick={() => handleExportTransactions('csv')}
              disabled={exporting}
              className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-paper text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Time (IST)</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Dishes</th>
                <th className="py-2.5 px-3 text-right">Tokens</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-ink-mute italic">
                    No cafeteria transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const statusColors = {
                    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    approved: 'bg-cobalt-50 text-cobalt-800 border-cobalt-200',
                    pending: 'bg-amber-50 text-amber-900 border-amber-200',
                    declined: 'bg-rose-50 text-rose-800 border-rose-200',
                    cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-ink">#{tx.id}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-ink-mute whitespace-nowrap">{tx.created_at}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-ink">{tx.customer_name}</p>
                        <p className="text-[10px] font-mono text-ink-mute">{tx.user_id || tx.username}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-ink-mute">
                          {tx.work_shift || 'day'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="truncate text-slate-700 text-[11px]">
                          {tx.items ? tx.items.join(', ') : '—'}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tokens font-black text-ink">
                        {tx.total_tokens} tk
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${statusColors[tx.status] || 'bg-slate-100'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setSelectedReceiptOrder({ id: tx.id })}
                          className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-ink hover:bg-slate-50"
                        >
                          <Receipt className="h-3 w-3 text-cobalt-600" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Digital Receipt Modal */}
      {selectedReceiptOrder && (
        <ReceiptModal
          orderId={selectedReceiptOrder.id}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}
    </div>
  );
};

export default StaffAdminDashboard;
