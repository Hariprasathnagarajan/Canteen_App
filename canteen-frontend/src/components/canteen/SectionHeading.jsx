import { memo } from 'react';
import { LinkedLineBand } from '../lineart';

const SectionHeading = memo(function SectionHeading({ kicker, title, hint, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        <LinkedLineBand className="mb-3 h-8 w-full max-w-[22rem] text-cobalt-500/70" />
        {kicker && (
          <p className="mb-1.5 font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt-600">
            {kicker}
          </p>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight sm:tracking-tighter leading-none text-balance text-ink">
          {title}
        </h1>
        {hint && <p className="mt-2 text-sm sm:text-base leading-relaxed text-ink-mute max-w-[65ch]">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
});

export default SectionHeading;
