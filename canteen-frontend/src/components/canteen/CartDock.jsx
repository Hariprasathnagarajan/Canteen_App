import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Loader2, ArrowRight, TriangleAlert, Sparkles } from 'lucide-react';

const CartDock = memo(function CartDock({ count, total, balance, placing, insufficient, onOrder }) {
  // Allow keyboard Enter / Space when focused or global shortcut
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="region"
          aria-label="Canteen Order Cart Dock"
          initial={{ opacity: 0, y: 48, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 48, scale: 0.94 }}
          transition={{ 
            type: 'spring', 
            stiffness: 280, 
            damping: 22,
            mass: 0.8
          }}
          className="fixed bottom-[calc(4.85rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 left-1/2 z-50 w-[calc(100%-1.25rem)] sm:w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
        >
          <div className="glass-dock rounded-3xl p-4 pl-5 text-white border border-white/20 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cobalt-600 shadow-cobalt ring-2 ring-white/10"
              >
                {placing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={2} />
                ) : (
                  <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2} />
                )}
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="font-mono-tokens text-[11px] uppercase tracking-[0.16em] text-slate-300 font-semibold">
                  {count} item{count === 1 ? '' : 's'} in thali
                </p>
                <p className="font-mono-tokens text-xl font-extrabold leading-tight text-white">
                  {total} <span className="text-sm font-semibold text-slate-300">tokens</span>
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onOrder}
                disabled={placing || insufficient}
                aria-label={`Place order for ${count} items totaling ${total} tokens`}
                className="btn-tactile inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-cobalt-600 px-5 py-3 text-sm font-extrabold text-white shadow-cobalt transition-colors hover:bg-cobalt-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {placing ? 'Firing Ticket…' : 'Fire Order'}
                {!placing && <ArrowRight className="h-4 w-4" strokeWidth={2.4} />}
              </motion.button>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full transition-all duration-500 ${insufficient ? 'bg-red-400' : 'bg-cobalt-400'}`}
                style={{ width: `${balance > 0 ? Math.min(100, (total / balance) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-mono-tokens font-semibold">Wallet: {balance} tk available</span>
              {insufficient && (
                <span className="inline-flex items-center gap-1 font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded-lg border border-red-500/40">
                  <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} /> Insufficient tokens
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
