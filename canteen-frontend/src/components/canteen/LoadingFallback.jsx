import { memo } from 'react';
import { CupGlyph } from '../lineart';

const LoadingFallback = memo(function LoadingFallback({ message = 'Loading workspace.' }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-paper px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt-600 text-white shadow-card">
        <CupGlyph className="h-8 w-8" steam />
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        <div className="skeleton-shimmer h-3.5 w-full rounded-full" />
        <div className="skeleton-shimmer h-3.5 w-4/5 rounded-full" />
        <div className="skeleton-shimmer h-3.5 w-3/5 rounded-full" />
      </div>
      <p className="font-mono-tokens text-[11px] uppercase tracking-[0.22em] text-ink-mute">
        {message}
      </p>
    </div>
  );
});

export default LoadingFallback;
