import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import FoodLineIcon, { getFoodLineArt } from './FoodLineIcon';
import VegBadge from './VegBadge';

export const getItemCategory = (item) => {
  const lineArt = getFoodLineArt(item);
  return lineArt.category;
};

const cardTransition = {
  layout: { type: 'spring', stiffness: 380, damping: 30 },
  opacity: { duration: 0.2, ease: 'easeOut' },
  scale: { duration: 0.2, ease: 'easeOut' },
};

const MenuCard = memo(function MenuCard({ item, qty, onAdd, onRemove, variant = 'grid' }) {
  const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');
  const lineArt = getFoodLineArt(item);
  const CategoryIcon = lineArt.Icon;

  // GRID VARIANT: Sleek card with vector line-art food icon
  if (variant === 'grid') {
    return (
      <motion.article
        layout="position"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={cardTransition}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs transition-all hover:border-cobalt-300 hover:shadow-card"
      >
        <div>
          {/* Header: Line Art Icon + Name & Category Pill */}
          <div className="flex items-start gap-2.5">
            <FoodLineIcon item={item} size="md" />

            {/* Title & Badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <VegBadge isVeg={isVeg} size="xs" showLabel={false} />
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${lineArt.boxStyle}`}>
                  <CategoryIcon className={`h-2.5 w-2.5 ${lineArt.strokeColor}`} strokeWidth={2} />
                  <span className={lineArt.strokeColor}>{lineArt.label}</span>
                </span>
              </div>
              <h3 className="truncate text-xs sm:text-sm font-bold text-ink leading-tight" title={item.name}>
                {item.name}
              </h3>
            </div>
          </div>

          {/* Details */}
          <div className="mt-2 px-0.5">
            {item.description ? (
              <p className="line-clamp-2 text-[10px] sm:text-[11px] text-ink-mute leading-snug">
                {item.description}
              </p>
            ) : (
              <p className="text-[10px] text-ink-mute italic">
                {isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Bar: Price & Stepper Button */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
          <span className="font-mono-tokens text-xs sm:text-sm font-black text-cobalt-700">
            {item.price} tk
          </span>

          {qty === 0 ? (
            <button
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="btn-tactile inline-flex h-7 px-2.5 sm:h-8 sm:px-3 items-center justify-center gap-1 rounded-xl bg-cobalt-600 text-white text-xs font-bold shadow-2xs hover:bg-cobalt-700 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              <span className="text-[11px]">Add</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-paper/80 p-0.5">
              <button
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-white text-ink shadow-2xs hover:bg-red-50 hover:text-red-700 active:scale-90 cursor-pointer"
              >
                <Minus className="h-3 w-3" strokeWidth={2.5} />
              </button>
              <span className="min-w-[1.1rem] text-center font-mono-tokens text-xs font-bold text-ink">
                {qty}
              </span>
              <button
                onClick={() => onAdd(item)}
                aria-label={`Add ${item.name}`}
                className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-cobalt-600 text-white shadow-2xs hover:bg-cobalt-700 active:scale-90 cursor-pointer"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </motion.article>
    );
  }

  // LIST VARIANT: Compact Horizontal Card with line-art food icon
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={cardTransition}
      className="group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs transition-colors hover:border-cobalt-300"
    >
      {/* Line Art Icon Box */}
      <FoodLineIcon item={item} size="md" />

      {/* Item Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <VegBadge isVeg={isVeg} size="xs" />
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${lineArt.boxStyle}`}>
            <CategoryIcon className={`h-2.5 w-2.5 ${lineArt.strokeColor}`} strokeWidth={2} />
            <span className={lineArt.strokeColor}>{lineArt.label}</span>
          </span>
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
            className="btn-tactile flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-cobalt-600 text-white shadow-2xs hover:bg-cobalt-700 active:scale-95 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        ) : (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-paper/70 p-0.5">
            <button
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
              className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-white text-ink shadow-2xs hover:bg-red-50 hover:text-red-700 active:scale-90 cursor-pointer"
            >
              <Minus className="h-3 w-3" strokeWidth={2.5} />
            </button>
            <span className="min-w-[1rem] text-center font-mono-tokens text-xs font-bold text-ink">
              {qty}
            </span>
            <button
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="btn-tactile flex h-6 w-6 items-center justify-center rounded-lg bg-cobalt-600 text-white shadow-2xs hover:bg-cobalt-700 active:scale-90 cursor-pointer"
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
