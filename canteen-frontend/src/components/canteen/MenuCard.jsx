import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import FoodImage from './FoodImage';

const spring = { type: 'spring', stiffness: 320, damping: 26 };

const MenuCard = memo(function MenuCard({ item, qty, onAdd, onRemove, featured, index }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ ...spring, delay: Math.min((index || 0) * 0.05, 0.4) }}
      className={`spotlight-card group flex flex-col overflow-hidden rounded-4xl border border-stone-200/70 bg-white shadow-card transition-shadow duration-300 hover:shadow-diffusion ${
        featured ? 'md:col-span-2 xl:col-span-7 md:flex-row' : 'xl:col-span-4'
      }`}
    >
      <FoodImage
        seed={`canteen-${item.id}-${item.name}`}
        alt={item.name}
        className={`${featured ? 'aspect-[16/9] md:aspect-auto md:w-[46%] md:min-h-[240px]' : 'aspect-[16/9]'}`}
        imgClassName="group-hover:scale-[1.04]"
      />
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-tight tracking-tight text-ink">{item.name}</h3>
          <span className="shrink-0 rounded-full border border-ember-200/70 bg-ember-50 px-2.5 py-1 font-mono-tokens text-xs font-semibold text-ember-700">
            {item.price} tk
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-mute">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onRemove(item.id)}
              disabled={qty === 0}
              aria-label={`Remove ${item.name}`}
              className="btn-tactile flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-cream text-ink transition-colors hover:border-ember-300 hover:text-ember-700 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <span className="w-7 text-center font-mono-tokens text-base font-bold text-ink" aria-live="polite">
              {qty}
            </span>
            <button
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-cream shadow-card transition-colors hover:bg-ember-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
          {qty > 0 ? (
            <span className="font-mono-tokens text-xs font-semibold text-ink-mute">
              = {item.price * qty} tk
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-leaf-700">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-600" />
              Available
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
});

export default MenuCard;
