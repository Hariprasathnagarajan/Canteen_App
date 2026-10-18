import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Radio,
  Flame,
  Hourglass,
  Receipt,
  Play,
  Pause,
  Coffee,
  Utensils,
  Cookie,
  Layers,
  BellRing
} from 'lucide-react';
import { staffAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import SectionHeading from '../../components/canteen/SectionHeading';
import EmptyState from '../../components/canteen/EmptyState';
import ReceiptModal from '../../components/canteen/ReceiptModal';
import { statusMeta } from '../../components/canteen/OrderCard';
import { 
  playOrderChime, 
  testOrderChime, 
  unlockAudio, 
  isAudioUnlocked, 
  subscribeAudioStatus, 
  isSoundEnabled, 
  setSoundEnabled 
} from '../../utils/audioAlerts';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Tickets' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Firing / Prep' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
];

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Stations', icon: Layers },
  { id: 'beverage', label: 'Beverages', icon: Coffee },
  { id: 'snack', label: 'Snacks', icon: Cookie },
  { id: 'meal', label: 'Meals / Food', icon: Utensils },
];

// Helper to deduce item category if not explicitly populated
export const resolveItemCategory = (item) => {
  const explicit = item?.category;
  if (explicit && ['beverage', 'snack', 'meal'].includes(explicit)) return explicit;
  const name = (item?.name || '').toLowerCase();
  const desc = (item?.description || '').toLowerCase();
  const text = `${name} ${desc}`;
  if (/coffee|tea|lassi|buttermilk|juice|shake|beverage|water|soda|chai/.test(text)) {
    return 'beverage';
  }
  if (/samosa|vada|snack|bajji|pakoda|puff|bonda|biscuit|cookie|chaat|fries/.test(text)) {
    return 'snack';
  }
  return 'meal';
};

const StaffOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [updating, setUpdating] = useState({});
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);

  // Live polling state
  const [autoSync, setAutoSync] = useState(true);
  const [soundActive, setSoundActive] = useState(isSoundEnabled());
  const [audioUnlocked, setAudioUnlocked] = useState(isAudioUnlocked());
  const [lastSyncedTime, setLastSyncedTime] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [syncStatus, setSyncStatus] = useState('healthy'); // 'healthy' | 'syncing' | 'error'

  const highestOrderIdRef = useRef(0);
  const isFirstFetchRef = useRef(true);
  const prevPendingCountRef = useRef(0);
  const pollTimerRef = useRef(null);

  // Subscribe to audio engine unlock transitions
  useEffect(() => {
    const unsub = subscribeAudioStatus((unlocked) => {
      setAudioUnlocked(unlocked);
    });
    return unsub;
  }, []);

  // Fetch orders from backend
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setSyncStatus('syncing');

    try {
      // Fetch full order dataset for search so live pass counters and incoming pending chimes remain active regardless of active tab filter
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
            `🔔 ${newPending.length} new incoming ticket${newPending.length === 1 ? '' : 's'} on the pass!`,
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
      prevPendingCountRef.current = orderList.filter((o) => o.status === 'pending').length;

      setOrders(orderList);
      setLastSyncedTime(Date.now());
      setSecondsAgo(0);
      setSyncStatus('healthy');
    } catch (error) {
      setSyncStatus('error');
      if (!isSilent) {
        toast.error('Failed to load kitchen orders');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [searchTerm]);

  // Initial and param change trigger
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Polling interval: every 5 seconds when autoSync is ON
  useEffect(() => {
    if (!autoSync) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(() => {
      fetchOrders(true);
    }, 5000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [autoSync, fetchOrders]);

  // Elapsed seconds timer since last sync
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSyncedTime) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastSyncedTime]);

  // Sound toggle & audio activation
  const toggleSound = async () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) {
      await unlockAudio();
      playOrderChime({ force: true });
      toast.success('Kitchen chime sound alerts enabled');
    } else {
      toast.info('Kitchen sound chime muted');
    }
  };

  const handleTestChime = async () => {
    try {
      const ok = await testOrderChime();
      if (ok) {
        toast.success('🔔 Chime test played successfully!', { icon: '🔔' });
      } else {
        toast.warn('Audio requires a user click. Tap anywhere on the page to activate.');
      }
    } catch (err) {
      toast.error('Could not play audio chime.');
    }
  };

  const handleActivateAudio = async () => {
    await unlockAudio();
    playOrderChime({ force: true });
    toast.success('Kitchen audio alerts activated! 🔔');
  };

  const updateOrderStatus = async (orderId, status) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await staffAPI.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast.success(
        status === 'approved' 
          ? 'Order approved — ticket fired to chefs.' 
          : status === 'declined' 
          ? 'Order declined and tokens refunded.' 
          : `Order marked ${status}.`
      );
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Status and Category counts
  const counts = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const totalActive = pending + approved;

    const catCounts = {
      all: orders.length,
      beverage: orders.filter((o) => (o.order_items || []).some((li) => resolveItemCategory(li.menu_item) === 'beverage')).length,
      snack: orders.filter((o) => (o.order_items || []).some((li) => resolveItemCategory(li.menu_item) === 'snack')).length,
      meal: orders.filter((o) => (o.order_items || []).some((li) => resolveItemCategory(li.menu_item) === 'meal')).length,
    };

    return { pending, approved, completed, totalActive, catCounts };
  }, [orders]);

  // Filter orders by status and category client-side
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (categoryFilter !== 'all') {
        const hasMatchingItem = (order.order_items || []).some(
          (li) => resolveItemCategory(li.menu_item) === categoryFilter
        );
        if (!hasMatchingItem) return false;
      }
      return true;
    });
  }, [orders, statusFilter, categoryFilter]);

  // Calculate ticket wait time
  const getTicketWaitText = (createdAt) => {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    const elapsedSeconds = Math.max(0, Math.floor(((Date.now() - new Date(createdAt).getTime()) % 60000) / 1000));
    return {
      minutes: elapsedMinutes,
      display: `${elapsedMinutes}m ${elapsedSeconds}s`,
      isUrgent: elapsedMinutes >= 10,
      isWarning: elapsedMinutes >= 5 && elapsedMinutes < 10,
    };
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header and Live Sync Controls */}
      <SectionHeading
        kicker="The pass · live kitchen display system"
        title="Kitchen Orders"
        hint="Approve incoming tickets, fire them, and track preparation queues in real time."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Polling Health Pulse Badge */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 shadow-2xs">
              <span className="relative flex h-2.5 w-2.5">
                {autoSync && (
                  <span className={`absolute inline-flex h-full w-full rounded-full ${
                    syncStatus === 'healthy' 
                      ? 'animate-ping bg-emerald-400 opacity-75' 
                      : syncStatus === 'syncing' 
                      ? 'animate-pulse bg-blue-400' 
                      : 'bg-amber-400'
                  }`} />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  !autoSync 
                    ? 'bg-slate-400' 
                    : syncStatus === 'healthy' 
                    ? 'bg-emerald-600' 
                    : syncStatus === 'syncing' 
                    ? 'bg-blue-600' 
                    : 'bg-amber-500'
                }`} />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-ink">
                  {autoSync ? 'Live Kitchen Sync' : 'Live Sync Paused'}
                </p>
                <p className="text-[10px] text-ink-mute">
                  {autoSync ? (secondsAgo === 0 ? 'Synced just now' : `Synced ${secondsAgo}s ago`) : 'Manual mode'}
                </p>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                title={autoSync ? 'Pause live auto-sync' : 'Resume live auto-sync'}
                className="ml-1 rounded-xl border border-slate-200 p-1.5 text-ink-mute hover:bg-slate-100 hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500"
              >
                {autoSync ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 text-emerald-600" />}
              </button>
            </div>

            {/* Audio Chime Notification Toggle & Test */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleSound}
                title={soundActive ? 'Sound alerts active (Click to mute)' : 'Sound alerts muted (Click to activate)'}
                aria-label="Toggle kitchen audio chime"
                className={`btn-tactile inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition-colors ${
                  soundActive 
                    ? 'border-cobalt-300 bg-cobalt-50 text-cobalt-950 shadow-2xs' 
                    : 'border-slate-200 bg-white text-ink-mute hover:text-ink'
                }`}
              >
                {soundActive ? <Volume2 className="h-4 w-4 text-cobalt-700" /> : <VolumeX className="h-4 w-4" />}
                <span className="hidden sm:inline">{soundActive ? 'Chime ON' : 'Muted'}</span>
              </button>

              {soundActive && (
                <button
                  onClick={handleTestChime}
                  title="Test kitchen chime audio"
                  aria-label="Test kitchen audio alert"
                  className="btn-tactile inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-ink shadow-2xs hover:bg-slate-50 transition-colors"
                >
                  <BellRing className="h-3.5 w-3.5 text-cobalt-600" />
                  <span className="hidden sm:inline">Test</span>
                </button>
              )}
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchOrders(false)}
              aria-label="Refresh tickets immediately"
              className="btn-tactile rounded-2xl border border-slate-200 bg-white p-2.5 text-ink shadow-2xs hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500"
            >
              <RotateCcw className="h-4 w-4 text-ink-mute" />
            </button>
          </div>
        }
      />

      {/* Audio Activation Banner if browser autoplay requires user interaction */}
      {soundActive && !audioUnlocked && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleActivateAudio}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleActivateAudio()}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/70 px-4 py-2.5 text-xs font-semibold text-amber-950 shadow-2xs hover:from-amber-100 hover:to-amber-200/70 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4 w-4 text-amber-700 animate-bounce shrink-0" />
            <span>
              <strong>Audio alerts need activation:</strong> Browser autoplay policy requires a user gesture on localhost. Tap here or click anywhere to enable live kitchen chimes.
            </span>
          </div>
          <span className="shrink-0 rounded-xl bg-amber-200/90 px-3 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-300 transition-colors">
            Enable Audio 🔊
          </span>
        </div>
      )}

      {/* Kitchen Queue Depth Metric Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Pending Tickets */}
        <div className={`rounded-3xl border p-4 shadow-2xs transition-all ${
          counts.pending > 0 
            ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-950' 
            : 'border-slate-200/80 bg-white text-ink'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">Pending Approval</span>
            <span className={`h-2.5 w-2.5 rounded-full ${counts.pending > 0 ? 'bg-amber-600 animate-breathe' : 'bg-slate-300'}`} />
          </div>
          <p className="mt-2 font-mono-tokens text-3xl font-extrabold">{counts.pending}</p>
          <span className="mt-1 text-xs text-ink-mute block">
            {counts.pending > 0 ? 'Requires immediate action' : 'Pass is clear'}
          </span>
        </div>

        {/* Firing Tickets */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">Firing on Pass</span>
            <Flame className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono-tokens text-3xl font-extrabold text-blue-950">{counts.approved}</p>
          <span className="mt-1 text-xs text-ink-mute block">Chefs cooking</span>
        </div>

        {/* Queue Delay Estimate */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">Queue Delay</span>
            <Hourglass className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-2 font-mono-tokens text-2xl font-black text-ink">
            ~{counts.totalActive * 3} - {Math.max(4, counts.totalActive * 5)}m
          </p>
          <span className="mt-1 text-xs text-ink-mute block">
            {counts.totalActive} active ticket{counts.totalActive === 1 ? '' : 's'}
          </span>
        </div>

        {/* Completed Today */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">Served Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono-tokens text-3xl font-extrabold text-emerald-950">{counts.completed}</p>
          <span className="mt-1 text-xs text-ink-mute block">Orders dispatched</span>
        </div>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(false); }}
            placeholder="Search ticket #, employee name, or User ID…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm shadow-2xs outline-none transition-all placeholder:text-slate-400 focus:border-cobalt-500 focus:ring-4 focus:ring-cobalt-500/10"
          />
        </label>

        {/* Category Station Filters (Beverages, Snacks, Meals) */}
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs">
          {CATEGORY_FILTERS.map((cat) => {
            const Icon = cat.icon;
            const active = categoryFilter === cat.id;
            const count = counts.catCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`btn-tactile relative shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  active 
                    ? 'bg-cobalt-600 text-white shadow-sm' 
                    : 'text-ink-mute hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
                <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono-tokens ${
                  active ? 'bg-cobalt-700 text-cobalt-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-2xs w-full sm:w-fit">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`btn-tactile relative shrink-0 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors ${
                active ? 'text-white' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {active && (
                <motion.span 
                  layoutId="staff-filter" 
                  className="absolute inset-0 rounded-xl bg-cobalt-600" 
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }} 
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Ticket Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-4xl border border-slate-200/70 bg-white p-5 shadow-card">
              <div className="skeleton-shimmer h-4 w-1/2 rounded-full" />
              <div className="mt-3 space-y-2">
                <div className="skeleton-shimmer h-3 w-full rounded-full" />
                <div className="skeleton-shimmer h-3 w-3/4 rounded-full" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="skeleton-shimmer h-10 flex-1 rounded-xl" />
                <div className="skeleton-shimmer h-10 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredOrders.map((order, idx) => {
            const meta = statusMeta[order.status] || statusMeta.pending;
            const Icon = meta.Icon;
            const busy = updating[order.id];
            const waitInfo = getTicketWaitText(order.created_at);

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className={`overflow-hidden rounded-4xl border bg-white shadow-card flex flex-col justify-between transition-all ${
                  order.status === 'pending' 
                    ? 'border-amber-300 ring-2 ring-amber-400/20' 
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`absolute h-full w-full rounded-full ${meta.dot} ${order.status === 'pending' ? 'animate-breathe' : ''}`} />
                      </span>
                      <span className="font-mono-tokens text-sm font-extrabold text-ink">#{order.id}</span>
                      <span className="max-w-[170px] truncate text-xs text-ink-mute">
                        {order.user_details?.first_name 
                          ? `${order.user_details.first_name} ${order.user_details.last_name || ''}`.trim() 
                          : (order.user_details?.username || 'Guest')}
                        {order.user_details?.user_id ? ` · ${order.user_details.user_id}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.cls}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />{meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Queue Wait Time Banner */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-2 text-xs">
                    <span className="text-ink-mute flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`inline-flex items-center gap-1 font-mono-tokens font-bold px-2 py-0.5 rounded-lg text-[11px] ${
                      waitInfo.isUrgent 
                        ? 'bg-red-100 text-red-950 border border-red-300 animate-pulse' 
                        : waitInfo.isWarning 
                        ? 'bg-amber-100 text-amber-950 border border-amber-300' 
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Hourglass className="h-3 w-3" />
                      Wait: {waitInfo.display}
                      {waitInfo.isUrgent && ' · Urgent'}
                    </span>
                  </div>

                  {/* Itemized Breakdown with Category Tags */}
                  <div className="divide-y divide-slate-100 px-5">
                    {(order.order_items || []).map((li, i) => {
                      const itemCat = resolveItemCategory(li.menu_item);
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              itemCat === 'beverage' 
                                ? 'bg-cobalt-100 text-cobalt-900 border border-cobalt-200' 
                                : itemCat === 'snack' 
                                ? 'bg-slate-100 text-slate-900 border border-slate-200' 
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              {itemCat}
                            </span>
                            <span className="min-w-0 truncate font-semibold text-ink">
                              {li.menu_item?.name}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono-tokens text-xs font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-md">
                            Qty {li.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer and Action Controls */}
                <div>
                  <div className="flex items-center justify-between border-t border-slate-100 bg-paper/70 px-5 py-3 text-sm">
                    <span className="text-xs text-ink-mute font-medium">Total Tokens Deducted:</span>
                    <span className="font-mono-tokens font-extrabold text-cobalt-700">{order.total_tokens} tk</span>
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    {/* Action Buttons */}
                    {order.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'approved')} 
                          disabled={busy} 
                          className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={2} />}
                          Approve & Fire
                        </button>
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'declined')} 
                          disabled={busy} 
                          className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-red-900 hover:bg-red-100 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <XCircle className="h-4 w-4" strokeWidth={2} /> Decline & Refund
                        </button>
                      </div>
                    )}

                    {order.status === 'approved' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'completed')} 
                          disabled={busy} 
                          className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-cobalt-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-cobalt-700 disabled:opacity-50 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-cobalt-500"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Package className="h-4 w-4" strokeWidth={2} />}
                          Mark Ready / Completed
                        </button>
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'declined')} 
                          disabled={busy} 
                          className="btn-tactile rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink-mute hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          Cancel & Refund
                        </button>
                      </div>
                    )}

                    {/* Receipt Voucher Trigger Button */}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="btn-tactile inline-flex items-center gap-1 text-[11px] font-bold text-ink-mute hover:text-cobalt-700 hover:underline"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Print / View Digital Voucher
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState 
          icon={Package} 
          art="tray"
          title="Pass is clear" 
          hint="No tickets match this filter. New incoming orders will appear live with instant audio chimes." 
        />
      )}

      {/* Persistent Receipt Modal for Kitchen Staff */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          isOpen={Boolean(selectedReceiptOrder)}
          onClose={() => setSelectedReceiptOrder(null)}
          api={staffAPI}
        />
      )}
    </div>
  );
};

export default StaffOrders;
