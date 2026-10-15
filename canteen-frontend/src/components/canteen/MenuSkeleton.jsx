import { memo } from 'react';

const MenuSkeleton = memo(function MenuSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`overflow-hidden rounded-4xl border border-stone-200/70 bg-white ${i === 0 ? 'md:col-span-2 xl:col-span-7' : i === 1 ? 'xl:col-span-5' : 'xl:col-span-4'}`}
        >
          <div className={`skeleton-shimmer w-full ${i < 2 ? 'aspect-[16/8]' : 'aspect-[16/9]'}`} />
          <div className="space-y-3 p-5">
            <div className="skeleton-shimmer h-4 w-2/3 rounded-full" />
            <div className="skeleton-shimmer h-3 w-full rounded-full" />
            <div className="skeleton-shimmer h-3 w-4/5 rounded-full" />
            <div className="flex justify-between pt-1">
              <div className="skeleton-shimmer h-8 w-24 rounded-full" />
              <div className="skeleton-shimmer h-8 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default MenuSkeleton;
