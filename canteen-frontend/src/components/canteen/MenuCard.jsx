import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import FoodImage from './FoodImage';

const spring = { type: 'spring', stiffness: 350, damping: 28 };

const MenuCard = memo(function MenuCard({ item, qty, onAdd, onRemove, index }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ ...spring, delay: Math.min((index || 0) * 0.03, 0.3) }}
      className="spotlight-card group relative flex items-center gap-3 sm:gap-3.5 overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/80 bg-white p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:border-ember-300/80 hover:shadow-card"
    >
      {/* Compact Food Thumbnail */}
      <FoodImage
        seed={`canteen-${item.id}-${item.name}`}
        alt={item.name}
        className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl sm:rounded-2xl"
        imgClassName="group-hover:scale-[1.06]"
      />

      {/* Middle Item Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm sm:text-base font-bold text-ink leading-tight transition-colors group-hover:text-ember-900">
            {item.name}
          </h3>
        </div>

        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px] sm:text-xs text-ink-mute leading-snug">
            {item.description}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-ember-200/80 bg-ember-50/90 px-2 py-0.5 font-mono-tokens text-[11px] sm:text-xs font-bold text-ember-800">
            {item.price} tk
          </span>

          {qty === 0 && (
            <span className="hidden xs:inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-leaf-700">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-600" />
              Available
            </span>
          )}
        </div>
      </div>

      {/* Right Stepper / Add Action */}
      <div className="shrink-0 flex flex-col items-end justify-center gap-1 pl-1">
        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            aria-label={`Add ${item.name}`}
            className="btn-tactile flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-stone-900 text-cream shadow-2xs transition-all hover:bg-ember-600 active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-cream/70 p-0.5">
              <button
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="btn-tactile flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-white text-ink shadow-2xs hover:bg-red-50 hover:text-red-700 active:scale-90"
              >
                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
              </button>
              <span className="min-w-[1.25rem] text-center font-mono-tokens text-xs sm:text-sm font-bold text-ink">
                {qty}
              </span>
              <button
                onClick={() => onAdd(item)}
                aria-label={`Add ${item.name}`}
                className="btn-tactile flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-stone-900 text-cream shadow-2xs hover:bg-ember-600 active:scale-90"
              >
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <span className="font-mono-tokens text-[10px] sm:text-[11px] font-bold text-ink-mute pr-1">
              = {item.price * qty} tk
            </span>
          </div>
        )}
      </div>
    </motion.article>
  );
});

export default MenuCard;
