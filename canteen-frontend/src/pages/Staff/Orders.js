import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, CheckCircle2, XCircle, Package, Loader2, RotateCcw } from 'lucide-react';
import { staffAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import SectionHeading from '../../components/canteen/SectionHeading';
import EmptyState from '../../components/canteen/EmptyState';
import { statusMeta } from '../../components/canteen/OrderCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
];

const StaffOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getOrders(searchTerm);
      setOrders(response.data.results || response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrderStatus = async (orderId, status) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }));
    try {
      await staffAPI.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast.success(status === 'approved' ? 'Order approved — fire it.' : status === 'declined' ? 'Order declined and refunded.' : `Order marked ${status}.`);
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const counts = useMemo(() => ({
    pending: orders.filter((o) => o.status === 'pending').length,
    approved: orders.filter((o) => o.status === 'approved').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  }), [orders]);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-6 pb-16">
      <SectionHeading
        kicker="The pass · live tickets"
        title="Kitchen orders"
        hint="Approve incoming tickets, fire them, and mark pickups complete. Declines refund tokens instantly."
        right={
          <div className="flex gap-1.5 sm:gap-2">
            {[
              { label: 'Pending', v: counts.pending, hot: counts.pending > 0 },
              { label: 'Firing', v: counts.approved },
              { label: 'Done', v: counts.completed },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border px-2.5 py-1.5 sm:px-4 sm:py-2 text-center shadow-card ${s.hot ? 'border-ember-300 bg-ember-50' : 'border-stone-200/70 bg-white'}`}>
                <p className="font-mono-tokens text-base sm:text-xl font-bold text-ink">{s.v}</p>
                <p className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold text-ink-mute">
                  {s.hot && <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ember-600" />}{s.label}
                </p>
              </div>
            ))}
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(); }}
            placeholder="Search username, user ID or order #…"
            className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm shadow-card outline-none transition-all placeholder:text-stone-400 focus:border-ember-500 focus:ring-4 focus:ring-ember-500/10"
          />
        </label>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="btn-tactile rounded-2xl bg-stone-900 px-5 py-3 text-sm font-bold text-cream hover:bg-ember-600">
            Search
          </button>
          <button onClick={() => { setSearchTerm(''); }} className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-ink-soft shadow-card hover:text-ink">
            <RotateCcw className="h-4 w-4" strokeWidth={2} /> Reset
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-1.5 rounded-2xl border border-stone-200/70 bg-white/70 p-1.5 shadow-card w-full sm:w-fit">
        {FILTERS.map((f) => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`btn-tactile relative shrink-0 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors ${active ? 'text-cream' : 'text-ink-mute hover:text-ink'}`}
            >
              {active && <motion.span layoutId="staff-filter" className="absolute inset-0 rounded-xl bg-stone-900" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-4xl border border-stone-200/70 bg-white p-5 shadow-card">
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
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.35), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-4xl border border-stone-200/70 bg-white shadow-card"
              >
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`absolute h-full w-full rounded-full ${meta.dot} ${order.status === 'pending' ? 'animate-breathe' : ''}`} />
                    </span>
                    <span className="font-mono-tokens text-sm font-bold text-ink">#{order.id}</span>
                    <span className="max-w-[170px] truncate text-xs text-ink-mute">
                      {order.user_details?.first_name ? `${order.user_details.first_name} ${order.user_details.last_name || ''}`.trim() : (order.user_details?.username || 'Guest')}
                      {order.user_details?.user_id ? ` · ${order.user_details.user_id}` : ''}
                    </span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />{meta.label}
                  </span>
                </div>
                <div className="divide-y divide-stone-100 px-5">
                  {(order.order_items || []).map((li, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-ink">{li.menu_item?.name} <span className="font-mono-tokens text-ink-mute">× {li.quantity}</span></span>
                      <span className="font-mono-tokens text-xs font-semibold text-ink-mute">Qty {li.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-cream px-5 py-3 text-sm">
                  <span className="text-xs text-ink-mute">{new Date(order.created_at).toLocaleString()}</span>
                  <span className="font-mono-tokens font-bold text-ember-700">{order.total_tokens} tk</span>
                </div>
                {order.status === 'pending' && (
                  <div className="flex gap-2 px-5 pb-5">
                    <button onClick={() => updateOrderStatus(order.id, 'approved')} disabled={busy} className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={2} />} Approve
                    </button>
                    <button onClick={() => updateOrderStatus(order.id, 'declined')} disabled={busy} className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                      <XCircle className="h-4 w-4" strokeWidth={2} /> Decline
                    </button>
                  </div>
                )}
                {order.status === 'approved' && (
                  <div className="flex gap-2 px-5 pb-5">
                    <button onClick={() => updateOrderStatus(order.id, 'completed')} disabled={busy} className="btn-tactile flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-cream hover:bg-ember-600 disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Package className="h-4 w-4" strokeWidth={2} />} Mark completed
                    </button>
                    <button onClick={() => updateOrderStatus(order.id, 'declined')} disabled={busy} className="btn-tactile rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-ink-mute hover:text-red-700 disabled:opacity-50">
                      Refund
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Package} title="Pass is clear" hint="No tickets match this filter. New orders will land here the second they are fired." />
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-mute">
        <Clock className="h-3.5 w-3.5" strokeWidth={2} /> Auto-refreshes on search. Pending tickets pulse until actioned.
      </p>
    </div>
  );
};

export default StaffOrders;
