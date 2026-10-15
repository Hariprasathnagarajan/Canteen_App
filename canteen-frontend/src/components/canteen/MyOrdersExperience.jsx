import { useState, useEffect, useCallback } from 'react';
import { Package, Clock, Flame } from 'lucide-react';
import { toast } from 'react-toastify';
import SectionHeading from './SectionHeading';
import OrderCard from './OrderCard';
import EmptyState from './EmptyState';
import TokenPill from './TokenPill';
import { useAuth } from '../../context/AuthContext';

export default function MyOrdersExperience({ api }) {
  const [orders, setOrders] = useState({ today_orders: [], past_orders: [] });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOrders();
      setOrders(res.data);
    } catch (err) {
      toast.error('Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const today = orders?.today_orders || [];
  const past = orders?.past_orders || [];
  const spentToday = today.reduce((s, o) => s + (o.total_tokens || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeading kicker="Your thali log" title="My orders" hint="Fetching today's pass…" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-4xl border border-stone-200/70 bg-white p-5 shadow-card">
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
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SectionHeading
          kicker="Your thali log"
          title="My orders"
          hint="Everything you fired today, plus your recent history."
        />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-3xl bg-stone-900 p-5 text-cream shadow-diffusion">
            <p className="flex items-center gap-1.5 font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-stone-400">
              <Flame className="h-3.5 w-3.5 text-ember-500" strokeWidth={2} /> Spent today
            </p>
            <p className="mt-1 font-mono-tokens text-3xl font-bold">{spentToday}<span className="text-sm font-medium text-stone-400"> tk</span></p>
            <p className="mt-1 text-xs text-stone-400">{today.length} order{today.length === 1 ? '' : 's'} on the pass</p>
          </div>
          <div className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card">
            <p className="font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-ink-mute">Wallet</p>
            <div className="mt-2"><TokenPill value={user?.tokens ?? 0} /></div>
            <button onClick={fetchOrders} className="btn-tactile mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-ember-700 hover:underline">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} /> Refresh status
            </button>
          </div>
        </div>
      </aside>

      <div className="space-y-8 pb-10">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight text-ink">Firing today</h2>
            <span className="font-mono-tokens text-xs text-ink-mute">{today.length} live</span>
          </div>
          {today.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {today.map((o, i) => <OrderCard key={o.id} order={o} index={i} />)}
            </div>
          ) : (
            <EmptyState icon={Package} title="No orders on the pass yet" hint="Head to today's menu, build your thali and fire your first order." />
          )}
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between border-t border-stone-200 pt-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Earlier plates</h2>
            <span className="font-mono-tokens text-xs text-ink-mute">{past.length} total</span>
          </div>
          {past.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {past.map((o, i) => <OrderCard key={o.id} order={o} index={i} />)}
            </div>
          ) : (
            <EmptyState icon={Clock} title="No history yet" hint="Your past orders will stack up here once the kitchen starts serving you." />
          )}
        </section>
      </div>
    </div>
  );
}
