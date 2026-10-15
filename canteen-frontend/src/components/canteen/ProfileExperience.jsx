import { memo } from 'react';
import { User, BadgeCheck, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PasswordChangeCard from '../PasswordChangeCard';
import TokenPill from './TokenPill';

const ProfileExperience = memo(function ProfileExperience({ title, kicker }) {
  const { user } = useAuth();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || user?.username || 'Member';

  return (
    <div className="space-y-6 pb-16">
      <div>
        <p className="font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.22em] text-ember-600">{kicker}</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tighter text-ink md:text-5xl">{title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-5xl bg-stone-900 text-cream shadow-diffusion">
          <div className="flex items-center gap-4 p-7">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-ember-600 text-xl font-extrabold text-white shadow-ember">
              {(displayName[0] || 'U').toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{displayName}</h2>
              <p className="truncate font-mono-tokens text-xs text-stone-400">@{user?.username} · {user?.role}</p>
              <div className="mt-2"><TokenPill value={user?.tokens ?? 0} tone="dark" /></div>
            </div>
          </div>
          <div className="border-t border-white/10 px-7 py-5">
            <p className="text-sm leading-relaxed text-stone-300">
              Tokens refresh monthly from your admin. Spend them on today's menu — declines refund instantly.
            </p>
          </div>
        </div>

        <div className="rounded-5xl border border-stone-200/70 bg-white shadow-card">
          <div className="divide-y divide-stone-100">
            {[
              { Icon: BadgeCheck, label: 'User ID', value: user?.user_id || '—', mono: true },
              { Icon: User, label: 'Full name', value: displayName },
              { Icon: Coins, label: 'Available tokens', value: `${user?.tokens ?? 0} tokens`, accent: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3.5 px-6 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-dark text-ember-700">
                  <row.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{row.label}</p>
                  <p className={`truncate font-bold text-ink ${row.mono ? 'font-mono-tokens text-sm' : ''} ${row.accent ? 'font-mono-tokens text-ember-700' : ''}`}>
                    {row.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PasswordChangeCard />
    </div>
  );
});

export default ProfileExperience;
