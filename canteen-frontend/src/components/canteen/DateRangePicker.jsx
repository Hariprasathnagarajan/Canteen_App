import { useMemo } from 'react';
import { Calendar, X } from 'lucide-react';

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

const resolvePresetRange = (id) => {
  const now = new Date();
  const end = toISODate(now);
  if (id === 'today') return { start: end, end };
  if (id === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: toISODate(start), end };
  }
  if (id === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toISODate(start), end };
  }
  return { start: '', end: '' };
};

const DateRangePicker = ({ startDate, endDate, onChange, className = '' }) => {
  const activePreset = useMemo(() => {
    if (!startDate && !endDate) return null;
    return PRESETS.find((p) => {
      if (p.id === 'custom') return false;
      const range = resolvePresetRange(p.id);
      return range.start === startDate && range.end === endDate;
    })?.id || 'custom';
  }, [startDate, endDate]);

  const invalid = Boolean(startDate && endDate && startDate > endDate);

  const applyPreset = (id) => {
    if (id === 'custom') {
      onChange({ startDate, endDate });
      return;
    }
    const { start, end } = resolvePresetRange(id);
    onChange({ startDate: start, endDate: end });
  };

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 pr-1 font-mono-tokens text-[10px] font-bold uppercase tracking-wider text-ink-mute">
          <Calendar className="h-3 w-3 text-cobalt-600" />
          Range
        </span>
        {PRESETS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              aria-pressed={active}
              className={`btn-tactile rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                active ? 'bg-cobalt-600 text-white' : 'bg-slate-100 text-ink-mute hover:bg-slate-200 hover:text-ink'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => onChange({ startDate: '', endDate: '' })}
            title="Clear range (exports current billing cycle)"
            aria-label="Clear date range"
            className="btn-tactile inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-ink-mute hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-mute">From</span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => onChange({ startDate: e.target.value, endDate })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink outline-none focus:border-cobalt-500"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-mute">To</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onChange({ startDate, endDate: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink outline-none focus:border-cobalt-500"
          />
        </label>
      </div>

      <p className={`text-[10px] font-medium ${invalid ? 'text-rose-600' : 'text-ink-mute'}`}>
        {invalid
          ? 'The "From" date must be on or before the "To" date.'
          : startDate || endDate
            ? 'Export will include orders within the selected range.'
            : 'No range selected — export will use the current billing cycle.'}
      </p>
    </div>
  );
};

export default DateRangePicker;
