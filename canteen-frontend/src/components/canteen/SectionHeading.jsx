import { memo } from 'react';

const SectionHeading = memo(function SectionHeading({ kicker, title, hint, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono-tokens text-[10px] font-semibold uppercase tracking-wider text-cobalt-600 mb-0.5">
            {kicker}
          </p>
        )}
        <h1 className="text-lg sm:text-xl font-black tracking-tight text-ink">
          {title}
        </h1>
        {hint && (
          <p className="text-[11px] sm:text-xs text-ink-mute mt-0.5 max-w-[60ch]">
            {hint}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
});

export default SectionHeading;
