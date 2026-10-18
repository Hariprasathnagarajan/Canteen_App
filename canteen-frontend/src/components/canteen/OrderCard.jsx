import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Package, Receipt, Sparkles, Flame, Hourglass } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

export const statusMeta = {
  pending: { 
    label: 'Pending', 
    cls: 'bg-amber-50 text-amber-900 border-amber-200/90 font-bold', 
    Icon: Clock, 
    dot: 'bg-amber-500' 
  },
  approved: { 
    label: 'Firing / Prep', 
    cls: 'bg-cobalt-50 text-cobalt-900 border-cobalt-200/90 font-bold', 
    Icon: Flame, 
    dot: 'bg-cobalt-600' 
  },
  declined: { 
    label: 'Declined', 
    cls: 'bg-rose-50 text-rose-900 border-rose-200/90 font-bold', 
    Icon: XCircle, 
    dot: 'bg-rose-600' 
  },
  completed: { 
    label: 'Completed', 
    cls: 'bg-emerald-50 text-emerald-900 border-emerald-200/90 font-bold', 
    Icon: Package, 
    dot: 'bg-emerald-600' 
  },
};

const OrderCard = memo(function OrderCard({ order, index, api }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const meta = statusMeta[order.status] || statusMeta.pending;
  const { Icon } = meta;

  // Calculate estimated pickup time and queue status based on created_at and status
  const getQueueEstimate = () => {
    if (order.status === 'completed') {
      return {
        text: 'Ready for pickup at Counter 1',
        cls: 'text-emerald-900 bg-emerald-50 border-emerald-200',
        Icon: CheckCircle2,
      };
    }
    if (order.status === 'approved') {
      return {
        text: 'Firing on the pass · Ready in ~3-5m',
        cls: 'text-cobalt-900 bg-cobalt-50 border-cobalt-200',
        Icon: Flame,
      };
    }
    if (order.status === 'declined') {
      return {
        text: 'Ticket declined · Tokens refunded to wallet',
        cls: 'text-rose-900 bg-rose-50 border-rose-200',
        Icon: XCircle,
      };
    }
    // Pending
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
    const estimatedWait = Math.max(2, 10 - elapsedMinutes);
    return {
      text: `In Queue · Est. pickup in ~${estimatedWait}-${estimatedWait + 4}m`,
      cls: 'text-amber-900 bg-amber-50 border-amber-200',
      Icon: Hourglass,
    };
  };

  const queueInfo = getQueueEstimate();
  const QueueIcon = queueInfo.Icon;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min((index || 0) * 0.05, 0.35), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-4xl border border-slate-200/80 bg-white shadow-card hover:border-slate-300 transition-all flex flex-col justify-between"
      >
        <div>
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute h-full w-full rounded-full ${meta.dot} ${order.status === 'pending' ? 'animate-breathe' : ''}`} />
              </span>
              <span className="font-mono-tokens text-sm font-bold text-ink">#{order.id}</span>
              <span className="text-xs text-ink-mute">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.cls}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {meta.label}
            </span>
          </div>

          {/* Queue Estimation / Pickup Countdown Pill */}
          <div className="px-4 py-2 border-b border-slate-100 bg-white">
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${queueInfo.cls}`}>
              <QueueIcon className="h-3 w-3 shrink-0" strokeWidth={2} />
              <span>{queueInfo.text}</span>
            </span>
          </div>

          {/* Itemized Lines */}
          <div className="divide-y divide-slate-100 px-5">
            {(order.order_items || []).map((li, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">
                  {li.menu_item?.name} <span className="font-mono-tokens text-ink-mute font-bold">× {li.quantity}</span>
                </span>
                <span className="shrink-0 font-mono-tokens text-xs font-bold text-ink-mute">
                  {(li.tokens_per_item || 0) * (li.quantity || 1)} tk
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with Total and Receipt Action */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-paper/60 px-5 py-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-mute block">Total Charged</span>
            <span className="font-mono-tokens text-base font-extrabold text-cobalt-700">{order.total_tokens} tokens</span>
          </div>
          <button
            onClick={() => setShowReceipt(true)}
            aria-label={`View official digital receipt for order ${order.id}`}
            className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-2xs hover:border-slate-400 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:outline-none"
          >
            <Receipt className="h-3.5 w-3.5 text-cobalt-600" />
            <span>Digital Receipt</span>
          </button>
        </div>
      </motion.div>

      {/* Digital Receipt Modal */}
      <ReceiptModal
        order={order}
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        api={api}
      />
    </>
  );
});

export default OrderCard;
