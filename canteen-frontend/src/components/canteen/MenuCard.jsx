import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import FoodImage from './FoodImage';
import VegBadge from './VegBadge';

const cardTransition = {
  layout: { type: 'spring', stiffness: 380, damping: 30 },
  opacity: { duration: 0.2, ease: 'easeOut' },
  scale: { duration: 0.2, ease: 'easeOut' },
};

const MenuCard = memo(function MenuCard({ item, qty, onAdd, onRemove }) {
  const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={cardTransition}
      className="group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs transition-colors hover:border-cobalt-300"
    >
      {/* Compact Food Thumbnail */}
      <FoodImage
        seed={`canteen-${item.id}-${item.name}`}
        alt={item.name}
        className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl"
        imgClassName="group-hover:scale-[1.04]"
      />

      {/* Item Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-1.5 min-w-0">
          <VegBadge isVeg={isVeg} size="xs" />
          <h3 className="truncate text-xs sm:text-sm font-bold text-ink leading-tight">
            {item.name}
          </h3>
        </div>

        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-[10px] sm:text-[11px] text-ink-mute leading-snug">
            {item.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border border-cobalt-200 bg-cobalt-50 px-1.5 py-0.5 font-mono-tokens text-[11px] font-bold text-cobalt-800">
            {item.price} tk
          </span>
          <span className={`text-[10px] font-medium ${isVeg ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isVeg ? 'Veg' : 'Non-Veg'}
          </span>
        </div>
      </div>

      {/* Stepper / Add Action */}
      <div className="shrink-0 flex items-center pr-0.5">
        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            aria-label={`Add ${item.name}`}
            className="btn-tactile flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-cobalt-600 text-white shadow-2xs hover:bg-cobalt-700 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        ) : (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-paper/70 p-0.5">
            <button
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
              className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-white text-ink shadow-2xs hover:bg-red-50 hover:text-red-700 active:scale-90"
            >
              <Minus className="h-3 w-3" strokeWidth={2.5} />
            </button>
            <span className="min-w-[1rem] text-center font-mono-tokens text-xs font-bold text-ink">
              {qty}
            </span>
            <button
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-cobalt-600 text-white shadow-2xs hover:bg-cobalt-700 active:scale-90"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
});

export default MenuCard;
