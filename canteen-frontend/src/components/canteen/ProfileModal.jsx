import { useEffect, useState } from 'react';
import { BadgeCheck, Coins, User, KeyRound, ChevronRight, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import PasswordChangeCard from '../PasswordChangeCard';
import TokenPill from './TokenPill';
import LogoutButton from '../LogoutButton';

const ROLE_LABEL = {
  admin: 'Administrator',
  staff_admin: 'Cafeteria Manager',
  staff: 'Cafeteria Crew',
  employee: 'Employee',
  guest: 'Guest',
};

const ProfileModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [view, setView] = useState('summary');

  useEffect(() => {
    if (!isOpen) setView('summary');
  }, [isOpen]);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || user?.username || 'Member';

  const officeName = user?.office_name || user?.active_kitchen?.office_name || (user?.role === 'admin' ? 'All Offices' : '—');

  const rows = [
    { Icon: BadgeCheck, label: 'Employee ID', value: user?.user_id || '—', mono: true },
    ...(['employee', 'guest'].includes(user?.role)
      ? [{ Icon: Coins, label: 'Tokens', value: `${user?.tokens ?? 0} tk`, accent: true }]
      : []),
    { Icon: User, label: 'Role', value: (ROLE_LABEL[user?.role] || user?.role || 'Employee') },
    { Icon: Building2, label: 'Office', value: officeName },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={view === 'summary' ? 'My Profile' : 'Change Password'}
      subtitle={view === 'summary' ? 'Your account at a glance' : 'Keep your account secure'}
      maxWidth="max-w-md"
    >
      {view === 'summary' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-cobalt-600 p-3.5 text-white shadow-2xs">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-extrabold text-cobalt-700 shadow-cobalt">
              {(displayName[0] || 'U').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold tracking-tight">{displayName}</h2>
              <p className="truncate font-mono-tokens text-[11px] text-slate-300">
                @{user?.username} · {user?.role}
              </p>
              {['employee', 'guest'].includes(user?.role) && (
                <div className="mt-1.5">
                  <TokenPill value={user?.tokens ?? 0} tone="dark" />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xs">
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 px-3 py-2.5 text-xs">
                  <row.Icon className="h-4 w-4 shrink-0 text-cobalt-600" strokeWidth={2} />
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-mute">{row.label}:</span>
                    <span
                      className={`ml-2 truncate font-bold text-ink ${row.accent ? 'font-mono-tokens text-cobalt-700' : ''}`}
                    >
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setView('password')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-bold text-ink shadow-2xs transition-colors hover:bg-slate-50 active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
              <KeyRound className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="flex-1">
              <span className="block leading-tight">Change password</span>
              <span className="block text-[11px] font-medium text-ink-mute">Update your account password</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>

          <div className="pt-1">
            <LogoutButton
              variant="ghost"
              size="sm"
              className="w-full justify-center rounded-xl py-2.5 text-xs font-bold"
              showLabel
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setView('summary')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cobalt-700 transition-colors hover:text-cobalt-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to profile
          </button>
          <PasswordChangeCard embedded onCancel={() => setView('summary')} onSuccess={() => setView('summary')} />
        </div>
      )}
    </Modal>
  );
};

export default ProfileModal;
