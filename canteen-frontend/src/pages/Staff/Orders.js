import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  RotateCcw,
  Volume2,
  VolumeX,
  Receipt,
  Utensils,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { staffAPI, reportsAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import EmptyState from '../../components/canteen/EmptyState';
import ReceiptModal from '../../components/canteen/ReceiptModal';
import VegBadge from '../../components/canteen/VegBadge';
import DateRangePicker from '../../components/canteen/DateRangePicker';
import Modal from '../../components/Modal';
import { statusMeta } from '../../components/canteen/OrderCard';
import {
  playOrderChime,
  unlockAudio,
  isSoundEnabled,
  setSoundEnabled
} from '../../utils/audioAlerts';
import { broadcastOrderEvent, subscribeToOrderUpdates } from '../../utils/orderSync';

const STATUS_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
  { id: 'all', label: 'All' },
];

const StaffOrders = () => {
  const { user } = useAuth();
  const canExport = Boolean(user && ['admin', 'staff_admin', 'staff'].includes(user.role));
  const isStaff = user?.role === 'staff';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // Initially show pending orders
  const [updating, setUpdating] = useState({});
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [soundActive, setSoundActive] = useState(isSoundEnabled());
  const [exporting, setExporting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportReportType, setExportReportType] = useState(isStaff ? 'staff_accepted' : 'transactions');
  const [exportRange, setExportRange] = useState({ startDate: '', endDate: '' });

  const highestOrderIdRef = useRef(0);
  const isFirstFetchRef = useRef(true);

  const handleExportOrders = async (format = exportFormat, reportType = exportReportType) => {
    if (exportRange.startDate && exportRange.endDate && exportRange.startDate > exportRange.endDate) {
      toast.error('The "From" date must be on or before the "To" date.');
      return;
    }
    try {
      setExporting(true);
      const hasRange = exportRange.startDate && exportRange.endDate;
      await reportsAPI.downloadReportFile({
        format,
        report_type: reportType,
        cycle: hasRange ? undefined : 'current',
        start_date: exportRange.startDate || undefined,
        end_date: exportRange.endDate || undefined,
      });
      toast.success(`Orders report (${format.toUpperCase()}) downloaded successfully!`);
      setShowExportModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  // Fetch orders from backend
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);

    try {
      const response = await staffAPI.getOrders({
        search: searchTerm,
      });

      const orderList = Array.isArray(response.data.results)
        ? response.data.results
        : (Array.isArray(response.data) ? response.data : []);

      // Check for incoming new pending orders to trigger audio chime
      if (!isFirstFetchRef.current) {
        const newPending = orderList.filter(
          (o) => o.status === 'pending' && o.id > highestOrderIdRef.current
        );
        if (newPending.length > 0) {
          playOrderChime();
          toast.info(
            `🔔 ${newPending.length} new incoming order!`,
            { icon: '🔔' }
          );
        }
      } else {
        isFirstFetchRef.current = false;
      }

      // Update tracking refs
      if (orderList.length > 0) {
        const maxId = Math.max(...orderList.map((o) => o.id));
        if (maxId > highestOrderIdRef.current) {
          highestOrderIdRef.current = maxId;
        }
      }

      setOrders(orderList);
    } catch (error) {
      if (!isSilent) {
        toast.error('Failed to load orders');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [searchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Real-time synchronization via WebSocket / BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToOrderUpdates((event) => {
      if (event?.action === 'order_created') {
        playOrderChime();
        toast.info('🔔 New order received!', { icon: '🔔' });
        fetchOrders(true);
      } else if (event?.action === 'status_changed' || event?.action === 'order_accepted') {
        fetchOrders(true);
      }
    });

    return unsubscribe;
  }, [fetchOrders]);

  // Live polling: every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  // Sound toggle
  const toggleSound = async () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) {
      await unlockAudio();
      playOrderChime({ force: true });
      toast.success('Chime enabled');
    } else {
      toast.info('Chime muted');
    }
  };

  // Staff accepts or declines order
  const updateOrderStatus = async (orderId, status) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await staffAPI.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));

      // Broadcast update across WebSockets and tabs so user is informed in real time
      broadcastOrderEvent(status === 'approved' ? 'order_accepted' : 'order_declined', {
        orderId,
        status,
      });

      if (status === 'approved') {
        toast.success(`Order #${orderId} accepted! User informed.`);
      } else if (status === 'declined') {
        toast.info(`Order #${orderId} declined & refunded.`);
      } else {
        toast.success(`Order #${orderId} updated.`);
      }
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Status counts
  const counts = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const declined = orders.filter((o) => o.status === 'declined').length;
    return { pending, approved, declined, all: orders.length };
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      return true;
    });
  }, [orders, statusFilter]);

  return (
    <div className="space-y-3 pb-16">
      {/* Header bar: Compact mobile-scaled view */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight flex items-center gap-2">
            <span>Staff Orders</span>
            {counts.pending > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-300 animate-pulse">
                {counts.pending} new
              </span>
            )}
          </h1>
          <p className="text-[11px] text-ink-mute">
            Live orders · Accept incoming customer tickets
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {canExport && (
            <>
              <button
                onClick={() => setShowDatePicker((v) => !v)}
                aria-expanded={showDatePicker}
                aria-label="Choose export date range"
                title="Choose export date range"
                className={`btn-tactile inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors shadow-2xs ${showDatePicker || (exportRange.startDate && exportRange.endDate)
                    ? 'border-cobalt-300 bg-cobalt-50 text-cobalt-800 hover:bg-cobalt-100'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
              >
                <Calendar className="h-3.5 w-3.5 text-cobalt-600" />
                <span className="hidden sm:inline">
                  {exportRange.startDate && exportRange.endDate ? 'Range Set' : 'Range'}
                </span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                disabled={exporting}
                aria-label="Export orders"
                title="Download orders report"
                className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-50 transition-colors shadow-2xs"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cobalt-600" /> : <Download className="h-3.5 w-3.5 text-cobalt-600" />}
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}

          <button
            onClick={toggleSound}
            aria-label="Toggle chime"
            title={soundActive ? 'Sound ON' : 'Muted'}
            className={`btn-tactile flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${soundActive
                ? 'border-cobalt-300 bg-cobalt-50 text-cobalt-900'
                : 'border-slate-200 bg-white text-ink-mute'
              }`}
          >
            {soundActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={() => fetchOrders(false)}
            aria-label="Refresh orders"
            title="Refresh orders"
            className="btn-tactile flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink-mute hover:text-ink transition-colors shadow-2xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {canExport && showDatePicker && (
        <DateRangePicker
          startDate={exportRange.startDate}
          endDate={exportRange.endDate}
          onChange={setExportRange}
        />
      )}

      {/* Filter and Search Bar: Compact & Mobile-friendly */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs w-full sm:w-auto">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            const count = counts[f.id] || 0;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`btn-tactile relative shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-cobalt-600 text-white' : 'text-ink-mute hover:text-ink'
                  }`}
              >
                <span>{f.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono-tokens ${active ? 'bg-cobalt-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <label className="relative block sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search #ticket or name…"
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition-all placeholder:text-slate-400 focus:border-cobalt-500"
          />
        </label>
      </div>

      {/* Ticket Cards List: Single Column List View for High Usability */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="skeleton-shimmer h-5 w-1/4 rounded-full" />
              <div className="mt-4 space-y-2.5">
                <div className="skeleton-shimmer h-4 w-full rounded-full" />
                <div className="skeleton-shimmer h-4 w-3/4 rounded-full" />
              </div>
              <div className="skeleton-shimmer mt-5 h-12 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const meta = statusMeta[order.status] || statusMeta.pending;
            const Icon = meta.Icon;
            const busy = updating[order.id];

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`overflow-hidden rounded-3xl border bg-white shadow-card flex flex-col justify-between transition-all ${order.status === 'pending'
                    ? 'border-amber-300 ring-4 ring-amber-400/15'
                    : 'border-slate-200/80'
                  }`}
              >
                <div>
                  {/* Card Header: Ticket #, Big Customer Name, Time & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 sm:px-6 py-3.5 bg-slate-50/80">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <span className="font-mono-tokens text-base sm:text-lg font-black text-cobalt-700 bg-cobalt-100/70 border border-cobalt-200 px-3 py-1 rounded-xl">
                        #{order.id}
                      </span>
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-ink tracking-tight">
                          {order.user_details?.first_name
                            ? `${order.user_details.first_name} ${order.user_details.last_name || ''}`.trim()
                            : (order.user_details?.username || 'Guest Diner')}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-ink-mute mt-0.5">
                          {order.user_details?.user_id && (
                            <span className="font-mono-tokens font-semibold text-slate-600">ID: {order.user_details.user_id}</span>
                          )}
                          {order.user_details?.work_shift && (
                            <span className="font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                              {order.user_details.work_shift.replace('_shift', '')} Shift
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs sm:text-sm font-semibold text-ink-mute flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${order.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : meta.cls
                        }`}>
                        <Icon className="h-4 w-4" strokeWidth={2} />
                        {order.status === 'approved' ? 'Accepted' : meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Items list: prominent big rows */}
                  <div className="divide-y divide-slate-100 px-4 sm:px-6 py-2 bg-white">
                    {(order.order_items || []).map((li, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <VegBadge isVeg={li.menu_item?.is_veg ?? (li.menu_item?.food_type !== 'non_veg')} size="md" />
                          <span className="text-base sm:text-lg font-bold text-ink">
                            {li.menu_item?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-tokens text-sm sm:text-base font-black text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl">
                            Qty: {li.quantity}
                          </span>
                          <span className="font-mono-tokens text-sm sm:text-base font-bold text-cobalt-700">
                            {(li.tokens_per_item || li.menu_item?.price || 0) * li.quantity} tk
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer and Big Actions */}
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-ink-mute uppercase tracking-wide">Total Order Cost:</span>
                    <span className="font-mono-tokens text-lg sm:text-xl font-black text-cobalt-700 bg-cobalt-50 border border-cobalt-200 px-3 py-1 rounded-xl">
                      {order.total_tokens} tk
                    </span>
                  </div>

                  {order.status === 'pending' ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <button
                        onClick={() => updateOrderStatus(order.id, 'approved')}
                        disabled={busy}
                        className="btn-tactile flex-1 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-4 text-base sm:text-lg font-black text-white hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-md hover:shadow-lg cursor-pointer"
                      >
                        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />}
                        <span>ACCEPT / APPROVE ORDER</span>
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'declined')}
                        disabled={busy}
                        className="btn-tactile inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-sm sm:text-base font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <XCircle className="h-5 w-5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  ) : order.status === 'approved' ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Order Accepted · Preparing
                      </span>
                      <button
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-ink-mute hover:text-cobalt-700 shadow-2xs"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Voucher
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-ink-mute hover:text-cobalt-700 shadow-2xs"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Voucher
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          art="tray"
          title="No orders"
          hint={statusFilter === 'pending' ? 'No pending orders waiting right now.' : 'No orders in this view.'}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          isOpen={Boolean(selectedReceiptOrder)}
          onClose={() => setSelectedReceiptOrder(null)}
          api={staffAPI}
        />
      )}

      {/* Role-Based Export Audit Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Orders & Audit Logs"
        subtitle="Download role-authorized activity reports and transaction summaries"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-xs font-bold text-ink mb-2">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'xlsx', label: 'Excel Workbook', ext: '.xlsx', Icon: FileSpreadsheet },
                { id: 'csv', label: 'CSV File', ext: '.csv', Icon: FileSpreadsheet },
                { id: 'pdf', label: 'PDF Document', ext: '.pdf', Icon: FileText },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setExportFormat(fmt.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all ${
                    exportFormat === fmt.id
                      ? 'border-cobalt-600 bg-cobalt-50/70 text-cobalt-900 ring-2 ring-cobalt-500/20'
                      : 'border-slate-200 bg-white text-ink hover:border-slate-300'
                  }`}
                >
                  <fmt.Icon className={`h-4 w-4 mb-1 ${exportFormat === fmt.id ? 'text-cobalt-600' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold">{fmt.label}</span>
                  <span className="text-[9px] text-ink-mute font-mono">{fmt.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scope selection */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">Report Scope</label>
            <select
              value={exportReportType}
              onChange={(e) => setExportReportType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-cobalt-500"
            >
              {isStaff ? (
                <>
                  <option value="staff_accepted">My Accepted Transactions (Accepted & fulfilled by you)</option>
                  <option value="transactions">Kitchen Orders (All orders in kitchen)</option>
                  <option value="menu">Kitchen Food Menu & Dish Catalogs</option>
                </>
              ) : (
                <>
                  <option value="transactions">Kitchen Food Transactions & Order Details</option>
                  <option value="menu">Kitchen Food Menu & Dish Catalogs</option>
                </>
              )}
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">Date Range (Optional)</label>
            <DateRangePicker
              startDate={exportRange.startDate}
              endDate={exportRange.endDate}
              onChange={setExportRange}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
              onClick={() => handleExportOrders(exportFormat, exportReportType)}
              disabled={exporting}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-cobalt-600 px-4 py-2 text-xs font-bold text-white hover:bg-cobalt-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StaffOrders;
