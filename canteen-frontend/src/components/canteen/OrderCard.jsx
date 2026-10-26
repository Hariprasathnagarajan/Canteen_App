import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Package, Receipt, Flame } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import VegBadge from './VegBadge';

export const statusMeta = {
  pending: { 
    label: 'Pending', 
    cls: 'bg-amber-50 text-amber-900 border-amber-200/90 font-bold', 
    Icon: Clock, 
    dot: 'bg-amber-500' 
  },
  approved: { 
    label: 'Accepted', 
    cls: 'bg-emerald-50 text-emerald-900 border-emerald-200/90 font-bold', 
    Icon: CheckCircle2, 
    dot: 'bg-emerald-600' 
  },
  declined: { 
    label: 'Declined', 
    cls: 'bg-rose-50 text-rose-900 border-rose-200/90 font-bold', 
    Icon: XCircle, 
    dot: 'bg-rose-600' 
  },
  completed: { 
    label: 'Completed', 
    cls: 'bg-slate-100 text-slate-800 border-slate-200 font-bold', 
    Icon: Package, 
    dot: 'bg-slate-600' 
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
    Icon: XCircle,
    dot: 'bg-rose-500'
  },
};

const OrderCard = memo(function OrderCard({ order, index, api, onOrderCancelled }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const meta = statusMeta[order.status] || statusMeta.pending;
  const { Icon } = meta;

  const handleCancelOrder = async () => {
    if (!window.confirm(`Are you sure you want to cancel order #${order.id}? Your ${order.total_tokens} tokens will be refunded immediately.`)) {
      return;
    }
    setCancelling(true);
    try {
      if (api?.cancelOrder) {
        await api.cancelOrder(order.id, 'Cancelled by user');
      }
      if (onOrderCancelled) {
        onOrderCancelled();
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusMessage = () => {
    if (order.status === 'approved') {
      return {
        text: 'Order Accepted by Kitchen · Preparing',
        cls: 'text-emerald-900 bg-emerald-50 border-emerald-200',
        Icon: CheckCircle2,
      };
    }
    if (order.status === 'completed') {
      return {
        text: 'Ready for pickup at Canteen Counter',
        cls: 'text-slate-800 bg-slate-50 border-slate-200',
        Icon: Package,
      };
    }
    if (order.status === 'declined') {
      return {
        text: 'Declined · Tokens refunded to wallet',
        cls: 'text-rose-900 bg-rose-50 border-rose-200',
        Icon: XCircle,
      };
    }
    if (order.status === 'cancelled') {
      return {
        text: 'Cancelled · Tokens restored to wallet',
        cls: 'text-rose-800 bg-rose-50 border-rose-200',
        Icon: XCircle,
      };
    }
    return {
      text: 'Order Placed · Awaiting Kitchen acceptance',
      cls: 'text-amber-900 bg-amber-50 border-amber-200',
      Icon: Clock,
    };
  };

  const statusInfo = getStatusMessage();
  const StatusIcon = statusInfo.Icon;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min((index || 0) * 0.03, 0.2), duration: 0.2 }}
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col justify-between"
      >
        <div>
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2 bg-slate-50/60">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tokens text-xs font-black text-ink">#{order.id}</span>
              <span className="text-[11px] text-ink-mute">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${meta.cls}`}>
              <Icon className="h-3 w-3" strokeWidth={2.2} />
              {meta.label}
            </span>
          </div>

          {/* Status Banner */}
          <div className="px-3 py-1.5 border-b border-slate-100 bg-white">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.cls}`}>
              <StatusIcon className="h-3 w-3 shrink-0" strokeWidth={2} />
              <span>{statusInfo.text}</span>
            </span>
          </div>

          {/* Itemized Lines */}
          <div className="divide-y divide-slate-100 px-3.5 py-1">
            {(order.order_items || []).map((li, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="min-w-0 truncate font-semibold text-ink flex items-center gap-1.5">
                  <VegBadge isVeg={li.menu_item?.is_veg ?? (li.menu_item?.food_type !== 'non_veg')} size="xs" />
                  <span className="truncate">{li.menu_item?.name}</span>
                  <span className="font-mono-tokens text-ink-mute font-bold">× {li.quantity}</span>
                </span>
                <span className="shrink-0 font-mono-tokens text-[11px] font-bold text-ink-mute">
                  {(li.tokens_per_item || 0) * (li.quantity || 1)} tk
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with Total and Receipt */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-paper/50 px-3.5 py-2">
          <div>
            <span className="text-[10px] text-ink-mute uppercase font-bold block">Total</span>
            <span className="font-mono-tokens text-xs font-black text-cobalt-700">{order.total_tokens} tk</span>
          </div>
          <div className="flex items-center gap-1.5">
            {order.status === 'pending' && (
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                aria-label={`Cancel order ${order.id}`}
                className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 shadow-2xs hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-3 w-3 text-rose-600" />
                <span>{cancelling ? 'Cancelling...' : 'Cancel'}</span>
              </button>
            )}
            <button
              onClick={() => setShowReceipt(true)}
              aria-label={`View digital receipt for order ${order.id}`}
              className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Receipt className="h-3 w-3 text-cobalt-600" />
              <span>Voucher</span>
            </button>
          </div>
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
