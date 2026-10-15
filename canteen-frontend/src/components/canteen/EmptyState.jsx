import { memo } from 'react';

const EmptyState = memo(function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-dark shadow-card">
        {Icon && <Icon className="h-7 w-7 text-ink-mute" strokeWidth={1.8} />}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3>
      {hint && <p className="mt-1 max-w-[38ch] text-sm leading-relaxed text-ink-mute">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
});

export default EmptyState;
