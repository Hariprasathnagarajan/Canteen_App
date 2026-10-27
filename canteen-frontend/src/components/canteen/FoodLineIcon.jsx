import { memo } from 'react';
import { 
  CupSoda, 
  Coffee, 
  Cookie, 
  Sandwich, 
  UtensilsCrossed, 
  Soup, 
  Pizza, 
  Croissant 
} from 'lucide-react';

export const getFoodLineArt = (item) => {
  const name = (item?.name || '').toLowerCase();
  const desc = (item?.description || '').toLowerCase();
  const rawCat = (item?.category || '').trim();
  const cat = rawCat.toLowerCase();
  const text = `${name} ${desc} ${cat}`;

  if (['coffee', 'tea', 'chai', 'cappuccino', 'latte', 'espresso', 'mocha'].some(k => text.includes(k))) {
    return {
      Icon: Coffee,
      category: 'beverage',
      label: 'Beverages',
      strokeColor: 'text-cyan-800',
      boxStyle: 'border-cyan-200/90 bg-cyan-50/70'
    };
  }
  if (['juice', 'soda', 'shake', 'smoothie', 'water', 'lassi', 'cola', 'beverage', 'drink', 'cooler'].some(k => text.includes(k)) || cat === 'beverage' || cat === 'drinks' || cat === 'beverages') {
    return {
      Icon: CupSoda,
      category: 'beverage',
      label: 'Beverages',
      strokeColor: 'text-cyan-800',
      boxStyle: 'border-cyan-200/90 bg-cyan-50/70'
    };
  }
  if (['pizza'].some(k => text.includes(k))) {
    return {
      Icon: Pizza,
      category: 'snack',
      label: 'Snacks',
      strokeColor: 'text-amber-800',
      boxStyle: 'border-amber-200/90 bg-amber-50/70'
    };
  }
  if (['sandwich', 'burger', 'wrap', 'roll', 'sub', 'toast', 'puff', 'samosa', 'vada', 'bajji', 'pakoda'].some(k => text.includes(k))) {
    return {
      Icon: Sandwich,
      category: 'snack',
      label: 'Snacks',
      strokeColor: 'text-amber-800',
      boxStyle: 'border-amber-200/90 bg-amber-50/70'
    };
  }
  if (['cookie', 'biscuit', 'cake', 'sweet', 'pastry', 'donut', 'doughnut'].some(k => text.includes(k))) {
    return {
      Icon: Cookie,
      category: 'snack',
      label: 'Snacks',
      strokeColor: 'text-amber-800',
      boxStyle: 'border-amber-200/90 bg-amber-50/70'
    };
  }
  if (['croissant', 'bun', 'bread', 'roti', 'naan', 'parotta'].some(k => text.includes(k))) {
    return {
      Icon: Croissant,
      category: 'snack',
      label: 'Snacks',
      strokeColor: 'text-amber-800',
      boxStyle: 'border-amber-200/90 bg-amber-50/70'
    };
  }
  if (['soup', 'noodle', 'maggi', 'broth'].some(k => text.includes(k))) {
    return {
      Icon: Soup,
      category: 'meal',
      label: 'Meals',
      strokeColor: 'text-emerald-800',
      boxStyle: 'border-emerald-200/90 bg-emerald-50/70'
    };
  }
  if (cat === 'snack' || cat === 'snacks') {
    return {
      Icon: Cookie,
      category: 'snack',
      label: 'Snacks',
      strokeColor: 'text-amber-800',
      boxStyle: 'border-amber-200/90 bg-amber-50/70'
    };
  }
  if (cat === 'meal' || cat === 'meals') {
    return {
      Icon: UtensilsCrossed,
      category: 'meal',
      label: 'Meals',
      strokeColor: 'text-emerald-800',
      boxStyle: 'border-emerald-200/90 bg-emerald-50/70'
    };
  }
  if (cat && cat !== 'other' && cat !== 'others') {
    return {
      Icon: UtensilsCrossed,
      category: cat,
      label: rawCat.charAt(0).toUpperCase() + rawCat.slice(1),
      strokeColor: 'text-emerald-800',
      boxStyle: 'border-emerald-200/90 bg-emerald-50/70'
    };
  }

  // Default: Meal / Food
  return {
    Icon: UtensilsCrossed,
    category: 'meal',
    label: 'Meals',
    strokeColor: 'text-emerald-800',
    boxStyle: 'border-emerald-200/90 bg-emerald-50/70'
  };
};

const FoodLineIcon = memo(function FoodLineIcon({ item, size = 'md', className = '' }) {
  const lineArt = getFoodLineArt(item);
  const IconComponent = lineArt.Icon;

  const sizeClasses = {
    sm: 'h-10 w-10 rounded-xl',
    md: 'h-12 w-12 sm:h-14 sm:w-14 rounded-2xl',
    lg: 'h-16 w-16 rounded-2xl'
  }[size] || 'h-12 w-12 rounded-2xl';

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6 sm:h-7 sm:w-7',
    lg: 'h-8 w-8'
  }[size] || 'h-6 w-6';

  return (
    <div
      className={`shrink-0 flex items-center justify-center border shadow-2xs transition-all duration-200 ${sizeClasses} ${lineArt.boxStyle} ${className}`}
      title={`${item?.name || 'Dish'} (${lineArt.label})`}
    >
      <IconComponent
        className={`${iconSizes} ${lineArt.strokeColor}`}
        strokeWidth={1.8}
      />
    </div>
  );
});

export default FoodLineIcon;
