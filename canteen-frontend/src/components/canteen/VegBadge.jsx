import { memo } from 'react';

/**
 * Standard Indian Cafeteria FSSAI Veg / Non-Veg Indicator
 * Green square with circle = Veg
 * Red/Brown square with circle = Non-Veg
 */
const VegBadge = memo(function VegBadge({ isVeg = true, size = 'sm', showLabel = false, className = '' }) {
  const isVegetarian = Boolean(isVeg);

  const sizeClasses = {
    xs: {
      box: 'h-3.5 w-3.5 p-0.5 rounded-[3px]',
      dot: 'h-1.5 w-1.5',
      text: 'text-[9px]',
    },
    sm: {
      box: 'h-4 w-4 p-0.5 rounded-[4px]',
      dot: 'h-1.5 w-1.5',
      text: 'text-[10px]',
    },
    md: {
      box: 'h-5 w-5 p-0.5 rounded-[5px]',
      dot: 'h-2 w-2',
      text: 'text-xs',
    },
  }[size] || {
    box: 'h-4 w-4 p-0.5 rounded-[4px]',
    dot: 'h-1.5 w-1.5',
    text: 'text-[10px]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
      title={isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
      aria-label={isVegetarian ? 'Vegetarian dish' : 'Non-Vegetarian dish'}
    >
      <span
        className={`flex items-center justify-center border-2 bg-white ${
          isVegetarian
            ? 'border-emerald-600'
            : 'border-rose-600'
        } ${sizeClasses.box}`}
      >
        <span
          className={`rounded-full ${
            isVegetarian ? 'bg-emerald-600' : 'bg-rose-600'
          } ${sizeClasses.dot}`}
        />
      </span>
      {showLabel && (
        <span
          className={`font-bold uppercase tracking-wider ${
            isVegetarian ? 'text-emerald-700' : 'text-rose-700'
          } ${sizeClasses.text}`}
        >
          {isVegetarian ? 'Veg' : 'Non-Veg'}
        </span>
      )}
    </span>
  );
});

export default VegBadge;
