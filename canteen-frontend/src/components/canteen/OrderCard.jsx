import { memo } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Package } from 'lucide-react';

export const statusMeta = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock, dot: 'bg-amber-500' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-green-800 border-green-200', Icon: CheckCircle2, dot: 'bg-green-600' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-red-800 border-red-200', Icon: XCircle, dot: 'bg-red-500' },
  completed: { label: 'Completed', cls: 'bg-stone-100 text-stone-700 border-stone-200', Icon: Package, dot: 'bg-stone-500' },
};

const OrderCard = memo(function OrderCard({ order, index }) {
  const meta = statusMeta[order.status] || statusMeta.pending;
  const { Icon } = meta;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min((index || 0) * 0.06, 0.4), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-4xl border border-stone-200/70 bg-white shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute h-full w-full rounded-full ${meta.dot} ${order.status === 'pending' ? 'animate-breathe' : ''}`} />
          </span>
          <span className="font-mono-tokens text-sm font-bold text-ink">#{order.id}</span>
          <span className="text-xs text-ink-mute">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {meta.label}
        </span>
      </div>
      <div className="divide-y divide-stone-100 px-5">
        {(order.order_items || []).map((li, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 text-sm">
            <span className="font-medium text-ink">
              {li.menu_item?.name} <span className="font-mono-tokens text-ink-mute">× {li.quantity}</span>
            </span>
            <span className="font-mono-tokens text-xs font-semibold text-ink-mute">
              {li.tokens_per_item * li.quantity} tk
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-cream px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-mute">Total</span>
        <span className="font-mono-tokens text-base font-bold text-ember-700">{order.total_tokens} tokens</span>
      </div>
    </motion.div>
  );
});

export default OrderCard;
