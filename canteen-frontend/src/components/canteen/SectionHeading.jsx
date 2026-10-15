import { memo } from 'react';

const SectionHeading = memo(function SectionHeading({ kicker, title, hint, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        {kicker && (
          <p className="mb-1.5 font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.18em] text-ember-600">
            {kicker}
          </p>
        )}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-none text-balance text-ink">
          {title}
        </h1>
        {hint && <p className="mt-2 text-base leading-relaxed text-ink-mute max-w-[65ch]">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
});

export default SectionHeading;
