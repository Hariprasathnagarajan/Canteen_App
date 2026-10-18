import { memo } from 'react';

const MenuSkeleton = memo(function MenuSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 sm:gap-3.5 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/70 bg-white p-2.5 sm:p-3 shadow-2xs"
        >
          {/* Shimmer Thumbnail */}
          <div className="skeleton-shimmer h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl sm:rounded-2xl" />

          {/* Shimmer Middle Info */}
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="skeleton-shimmer h-4 w-3/4 rounded-full" />
            <div className="skeleton-shimmer h-3 w-1/2 rounded-full" />
            <div className="skeleton-shimmer h-5 w-16 rounded-full mt-1" />
          </div>

          {/* Shimmer Button */}
          <div className="shrink-0 pl-1">
            <div className="skeleton-shimmer h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
});

export default MenuSkeleton;
