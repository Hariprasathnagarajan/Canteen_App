import { memo } from 'react';
import { Coins } from 'lucide-react';

const TokenPill = memo(function TokenPill({ value, tone = 'light', className = '' }) {
  const tones = {
    light: 'bg-ember-50 text-ember-700 border-ember-200/70',
    dark: 'bg-white/10 text-amber-100 border-white/15',
    ink: 'bg-stone-900 text-amber-100 border-stone-800',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold font-mono-tokens ${tones[tone]} ${className}`}
    >
      <Coins className="h-3.5 w-3.5" strokeWidth={2} />
      {value} tokens
    </span>
  );
});

export default TokenPill;
