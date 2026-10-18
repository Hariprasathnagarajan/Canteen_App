import { memo } from 'react';
import { User, BadgeCheck, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LinkedLineBand } from '../lineart';
import PasswordChangeCard from '../PasswordChangeCard';
import TokenPill from './TokenPill';
import LogoutButton from '../LogoutButton';

const ProfileExperience = memo(function ProfileExperience({ title, kicker }) {
  const { user } = useAuth();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || user?.username || 'Member';

  return (
    <div className="space-y-6 pb-20">
      <div>
        <LinkedLineBand className="mb-3 h-8 w-full max-w-[22rem] text-cobalt-500/70" />
        <p className="font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.22em] text-cobalt-600">{kicker}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">{title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-3xl bg-cobalt-600 text-white shadow-diffusion sm:rounded-5xl">
          <div className="flex items-center gap-4 p-5 sm:p-7">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-cobalt-700 shadow-cobalt sm:h-16 sm:w-16 sm:rounded-3xl sm:text-xl">
              {(displayName[0] || 'U').toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight sm:text-xl">{displayName}</h2>
              <p className="truncate font-mono-tokens text-xs text-slate-400">@{user?.username} · {user?.role}</p>
              <div className="mt-2"><TokenPill value={user?.tokens ?? 0} tone="dark" /></div>
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-4 sm:px-7 sm:py-5">
            <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
              Tokens refresh monthly from your admin. Spend them on today's menu — declines refund instantly.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white shadow-card sm:rounded-5xl">
          <div className="divide-y divide-slate-100">
            {[
              { Icon: BadgeCheck, label: 'User ID', value: user?.user_id || '—', mono: true },
              { Icon: User, label: 'Full name', value: displayName },
              { Icon: Coins, label: 'Available tokens', value: `${user?.tokens ?? 0} tokens`, accent: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6 sm:py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-dark text-cobalt-700">
                  <row.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{row.label}</p>
                  <p className={`truncate font-bold text-ink ${row.mono ? 'font-mono-tokens text-sm' : ''} ${row.accent ? 'font-mono-tokens text-cobalt-700' : ''}`}>
                    {row.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PasswordChangeCard />

      <div className="pt-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Session</p>
          <LogoutButton
            variant="secondary"
            size="md"
            className="w-full justify-center rounded-2xl border border-slate-200/90 bg-slate-50 py-3 text-sm font-bold text-ink hover:bg-slate-100 active:scale-[0.99]"
            showLabel
          />
        </div>
      </div>
    </div>
  );
});

export default ProfileExperience;
