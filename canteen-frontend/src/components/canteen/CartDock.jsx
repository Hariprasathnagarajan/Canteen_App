import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Loader2, ArrowRight, TriangleAlert } from 'lucide-react';

const CartDock = memo(function CartDock({ count, total, balance, placing, insufficient, onOrder }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="region"
          aria-label="Canteen Order Cart Dock"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="fixed bottom-[calc(4.2rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 z-50 w-[calc(100%-1rem)] lg:left-1/2 lg:-translate-x-1/2 max-w-md"
        >
          <div className="glass-dock rounded-2xl p-2.5 px-3 text-white border border-white/20 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cobalt-600 shadow-cobalt">
                {placing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
                ) : (
                  <ShoppingBag className="h-4 w-4 text-white" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-mono-tokens text-[10px] uppercase tracking-wider text-slate-300 font-semibold">
                  {count} item{count === 1 ? '' : 's'}
                </p>
                <p className="font-mono-tokens text-sm font-extrabold text-white">
                  {total} <span className="text-[11px] font-semibold text-slate-300">tk</span>
                </p>
              </div>
              <button
                onClick={onOrder}
                disabled={placing || insufficient}
                aria-label={`Place order for ${count} items totaling ${total} tokens`}
                className="btn-tactile inline-flex shrink-0 items-center gap-1 rounded-xl bg-cobalt-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-cobalt hover:bg-cobalt-500 disabled:opacity-50 transition-colors"
              >
                {placing ? 'Firing…' : 'Order Now'}
                {!placing && <ArrowRight className="h-3 w-3" strokeWidth={2.4} />}
              </button>
            </div>

            {insufficient && (
              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded-lg border border-red-500/40">
                <TriangleAlert className="h-3 w-3 shrink-0" strokeWidth={2} /> Insufficient tokens ({balance} tk available)
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CartDock;
