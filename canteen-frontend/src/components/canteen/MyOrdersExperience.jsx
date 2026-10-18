import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Clock, Flame, RefreshCw, Radio, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import SectionHeading from './SectionHeading';
import OrderCard from './OrderCard';
import EmptyState from './EmptyState';
import TokenPill from './TokenPill';
import { useAuth } from '../../context/AuthContext';

export default function MyOrdersExperience({ api }) {
  const [orders, setOrders] = useState({ today_orders: [], past_orders: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(Date.now());
  const [syncHealth, setSyncHealth] = useState('healthy'); // 'healthy' | 'syncing' | 'error'
  const { user, updateUser } = useAuth();
  const pollTimerRef = useRef(null);

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setSyncing(true);
    }
    setSyncHealth('syncing');
    try {
      const res = await api.getOrders();
      setOrders(res.data);
      setLastSynced(Date.now());
      setSyncHealth('healthy');
      if (res.data?.tokens_balance !== undefined && updateUser) {
        updateUser((prev) => ({ ...prev, tokens: res.data.tokens_balance }));
      }
    } catch (err) {
      setSyncHealth('error');
      if (!isSilent) {
        toast.error('Could not load your orders');
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

  // Live polling: faster interval (6s) if any ticket is active (pending or approved), else 18s
  useEffect(() => {
    const today = orders?.today_orders || [];
    const hasActiveOrders = today.some((o) => o.status === 'pending' || o.status === 'approved');
    const intervalMs = hasActiveOrders ? 6000 : 18000;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      fetchOrders(true);
    }, intervalMs);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [orders?.today_orders, fetchOrders]);

  const today = orders?.today_orders || [];
  const past = orders?.past_orders || [];
  const spentToday = today.reduce((s, o) => s + (o.total_tokens || 0), 0);
  const activeCount = today.filter((o) => o.status === 'pending' || o.status === 'approved').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeading kicker="Your thali log" title="My orders" hint="Fetching today's pass…" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-4xl border border-slate-200/70 bg-white p-5 shadow-card">
              <div className="skeleton-shimmer h-4 w-1/3 rounded-full" />
              <div className="mt-3 space-y-2">
                <div className="skeleton-shimmer h-3 w-full rounded-full" />
                <div className="skeleton-shimmer h-3 w-4/5 rounded-full" />
              </div>
              <div className="skeleton-shimmer mt-4 h-9 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start space-y-5">
        <SectionHeading
          kicker="Your thali log"
          title="My orders"
          hint="Everything you fired today, plus your recent history."
        />

        {/* Live Status Indicator Badge */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${
                syncHealth === 'healthy' 
                  ? 'animate-ping bg-emerald-400 opacity-75' 
                  : syncHealth === 'syncing' 
                  ? 'animate-pulse bg-blue-400' 
                  : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                syncHealth === 'healthy' ? 'bg-emerald-600' : syncHealth === 'syncing' ? 'bg-blue-600' : 'bg-amber-600'
              }`} />
            </span>
            <div>
              <p className="text-xs font-bold text-ink">
                {activeCount > 0 ? 'Live Kitchen Tracking' : 'Kitchen Synced'}
              </p>
              <p className="text-[10px] text-ink-mute">
                {activeCount > 0 ? `${activeCount} ticket${activeCount === 1 ? '' : 's'} on pass` : 'Auto-updates in real time'}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchOrders(false)}
            disabled={syncing}
            aria-label="Refresh orders status"
            title="Refresh order status"
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-ink-mute hover:bg-slate-100 hover:text-ink transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cobalt-500"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-cobalt-600' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-diffusion">
            <p className="flex items-center gap-1.5 font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <Flame className="h-3.5 w-3.5 text-cobalt-500" strokeWidth={2} /> Spent today
            </p>
            <p className="mt-1 font-mono-tokens text-3xl font-bold">{spentToday}<span className="text-sm font-medium text-slate-400"> tk</span></p>
            <p className="mt-1 text-xs text-slate-400">{today.length} order{today.length === 1 ? '' : 's'} on the pass</p>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card">
            <p className="font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-ink-mute">Wallet Balance</p>
            <div className="mt-2"><TokenPill value={user?.tokens ?? 0} /></div>
            <p className="mt-3 text-[11px] text-ink-mute flex items-center gap-1">
              <Clock className="h-3 w-3" /> Auto-syncs with kitchen counter
            </p>
          </div>
        </div>
      </aside>

      <div className="space-y-8 pb-10">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight text-ink">Firing today</h2>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cobalt-100 px-2 py-0.5 font-mono-tokens text-[11px] font-bold text-cobalt-900 border border-cobalt-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-cobalt-600 animate-breathe" />
                  {activeCount} active
                </span>
              )}
              <span className="font-mono-tokens text-xs text-ink-mute">{today.length} total</span>
            </div>
          </div>
          {today.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {today.map((o, i) => <OrderCard key={o.id} order={o} index={i} api={api} />)}
            </div>
          ) : (
            <EmptyState icon={Package} art="tray" title="No orders on the pass yet" hint="Head to today's menu, build your thali and fire your first order." />
          )}
        </section>

        <section>
            <div className="mb-3 flex items-baseline justify-between border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Earlier plates</h2>
            <span className="font-mono-tokens text-xs text-ink-mute">{past.length} total</span>
          </div>
          {past.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {past.map((o, i) => <OrderCard key={o.id} order={o} index={i} api={api} />)}
            </div>
          ) : (
            <EmptyState icon={Clock} art="receipt" title="No history yet" hint="Your past orders will stack up here once the kitchen starts serving you." />
          )}
        </section>
      </div>
    </div>
  );
}
