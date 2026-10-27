import { useState, useEffect, useCallback } from 'react';
import { Package, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import OrderCard from './OrderCard';
import EmptyState from './EmptyState';
import { useAuth } from '../../context/AuthContext';
import { subscribeToOrderUpdates } from '../../utils/orderSync';

export default function MyOrdersExperience({ api }) {
  const [orders, setOrders] = useState({ today_orders: [], past_orders: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'past'
  const { user, updateUser } = useAuth();

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setSyncing(true);
    try {
      const res = await api.getOrders();
      setOrders(res.data);
      if (res.data?.tokens_balance !== undefined && updateUser) {
        updateUser((prev) => ({ ...prev, tokens: res.data.tokens_balance }));
      }
    } catch (err) {
      if (!isSilent) {
        toast.error('Could not load orders');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [api, updateUser]);

  // Initial load
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Real-time synchronization via WebSocket / BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToOrderUpdates((event) => {
      if (event?.action === 'order_accepted') {
        toast.success(`🎉 Order #${event.data?.orderId || ''} accepted!`, { icon: '🍽️' });
        fetchOrders(true);
      } else if (event?.action === 'order_created' || event?.action === 'order_declined' || event?.action === 'status_changed') {
        fetchOrders(true);
      }
    });

    return unsubscribe;
  }, [fetchOrders]);

  // Periodic polling fallback: every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchOrders]);

  const today = orders?.today_orders || [];
  const past = orders?.past_orders || [];
  const activeOrdersCount = today.filter((o) => o.status === 'pending' || o.status === 'approved').length;

  if (loading) {
    return (
      <div className="space-y-3 pb-16">
        <div className="skeleton-shimmer h-6 w-32 rounded-xl" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <div className="skeleton-shimmer h-3.5 w-1/3 rounded-full" />
              <div className="skeleton-shimmer mt-2 h-3 w-3/4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-16">
      {/* Compact Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight flex items-center gap-2">
            <span>My Orders</span>
            {activeOrdersCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300">
                {activeOrdersCount} active
              </span>
            )}
          </h1>
          <p className="text-[11px] text-ink-mute">
            Track your meal passes in real time
          </p>
        </div>

        <button
          onClick={() => fetchOrders(false)}
          disabled={syncing}
          aria-label="Refresh orders"
          title="Refresh orders"
          className="btn-tactile flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink-mute hover:text-ink transition-colors shadow-2xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-cobalt-600' : ''}`} />
        </button>
      </div>

      {/* Tabs: Today vs History */}
      <div className="flex gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs w-fit">
        <button
          onClick={() => setActiveTab('today')}
          className={`btn-tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeTab === 'today' ? 'bg-cobalt-600 text-white' : 'text-ink-mute hover:text-ink'
          }`}
        >
          <span>Today</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono-tokens ${
            activeTab === 'today' ? 'bg-cobalt-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {today.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`btn-tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            activeTab === 'past' ? 'bg-cobalt-600 text-white' : 'text-ink-mute hover:text-ink'
          }`}
        >
          <span>Past History</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono-tokens ${
            activeTab === 'past' ? 'bg-cobalt-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {past.length}
          </span>
        </button>
      </div>

      {/* Orders List */}
      {activeTab === 'today' ? (
        today.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {today.map((o, i) => (
              <OrderCard
                key={o.id}
                order={o}
                index={i}
                api={api}
                onOrderCancelled={() => fetchOrders(false)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No orders placed today"
            hint="Order from today's menu to enjoy freshly cooked meals."
          />
        )
      ) : (
        past.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {past.map((o, i) => (
              <OrderCard
                key={o.id}
                order={o}
                index={i}
                api={api}
                onOrderCancelled={() => fetchOrders(false)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No past orders"
            hint="Your completed orders will appear here."
          />
        )
      )}
    </div>
  );
}
