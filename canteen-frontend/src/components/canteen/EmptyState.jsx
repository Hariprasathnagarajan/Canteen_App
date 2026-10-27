import { memo } from 'react';
import { EMPTY_ART } from '../lineart';
import cafeLineart from '../../assets/cafe-lineart.png';

const EmptyState = memo(function EmptyState({
  icon: Icon,
  art,
  image,
  title,
  hint,
  action,
  imageClassName = 'h-36 sm:h-44',
}) {
  const Art = art && EMPTY_ART[art] ? EMPTY_ART[art] : null;
  const useFallback = !image && !Art && !Icon;

  return (
    <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div
        className={`mb-4 flex items-center justify-center ${
          useFallback || image ? '' : 'h-14 w-14 rounded-2xl border border-dashed border-cobalt-200 bg-cobalt-50/70 shadow-card'
        }`}
      >
        {image ? (
          <img src={image} alt="" className={`object-contain ${imageClassName}`} />
        ) : Art ? (
          <Art className="h-7 w-7 text-cobalt-600" />
        ) : useFallback ? (
          <img src={cafeLineart} alt="" className={`object-contain opacity-90 ${imageClassName}`} />
        ) : Icon ? (
          <Icon className="h-7 w-7 text-ink-mute" strokeWidth={1.8} />
        ) : null}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3>
      {hint && <p className="mt-1 max-w-[38ch] text-sm leading-relaxed text-ink-mute">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
});

export default EmptyState;
