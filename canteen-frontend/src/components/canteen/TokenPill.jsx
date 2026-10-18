import { memo } from 'react';
import { Coins } from 'lucide-react';

const TokenPill = memo(function TokenPill({ value, tone = 'light', className = '' }) {
  const tones = {
    light: 'bg-cobalt-50 text-cobalt-950 border-cobalt-300 font-bold',
    dark: 'bg-slate-900 text-cobalt-200 border-cobalt-500/40 font-bold shadow-2xs',
    ink: 'bg-slate-950 text-cobalt-200 border-slate-800 font-bold',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono-tokens tracking-tight ${tones[tone]} ${className}`}
      aria-label={`${value} tokens available`}
    >
      <Coins className="h-3.5 w-3.5 text-cobalt-600 dark:text-cobalt-300" strokeWidth={2.2} />
      <span>{value} tokens</span>
    </span>
  );
});

export default TokenPill;
