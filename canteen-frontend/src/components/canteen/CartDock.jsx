import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Loader2, ArrowRight, TriangleAlert } from 'lucide-react';

const CartDock = memo(function CartDock({ count, total, balance, placing, insufficient, onOrder }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed bottom-[calc(4.85rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 left-1/2 z-50 w-[calc(100%-1.25rem)] sm:w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
        >
          <div className="glass-dock rounded-3xl p-4 pl-5 text-cream">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ember-600 shadow-ember">
                {placing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={2} />
                ) : (
                  <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono-tokens text-[11px] uppercase tracking-[0.16em] text-stone-400">
                  {count} item{count === 1 ? '' : 's'} in thali
                </p>
                <p className="font-mono-tokens text-xl font-bold leading-tight text-cream">
                  {total} <span className="text-sm font-medium text-stone-400">tokens</span>
                </p>
              </div>
              <button
                onClick={onOrder}
                disabled={placing || insufficient}
                className="btn-tactile inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-ember-600 px-5 py-3 text-sm font-bold text-white shadow-ember transition-colors hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placing ? 'Placing…' : 'Place order'}
                {!placing && <ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
              </button>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${insufficient ? 'bg-red-400' : 'bg-ember-500'}`}
                style={{ width: `${balance > 0 ? Math.min(100, (total / balance) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="text-stone-400 font-mono-tokens">balance {balance} tk</span>
              {insufficient && (
                <span className="inline-flex items-center gap-1 font-semibold text-red-300">
                  <TriangleAlert className="h-3 w-3" strokeWidth={2} /> Insufficient tokens
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CartDock;
