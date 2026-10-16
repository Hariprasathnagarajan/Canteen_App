import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, LayoutGrid, Users, Coins, UtensilsCrossed, ClipboardList, Soup } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from './LogoutButton';
import TokenPill from './canteen/TokenPill';

const Navbar = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    if (!user) return [];
    const profile = { name: 'Profile', path: `/${user.role}/profile`, icon: User };
    switch (user.role) {
      case 'admin':
        return [
          { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutGrid },
          { name: 'Users', path: '/admin/users', icon: Users },
          { name: 'Tokens', path: '/admin/tokens', icon: Coins },
          profile,
        ];
      case 'staff':
        return [
          { name: 'Orders', path: '/staff/orders', icon: ClipboardList },
          { name: 'Menu', path: '/staff/menu', icon: UtensilsCrossed },
          profile,
        ];
      case 'employee':
        return [
          { name: 'Menu', path: '/employee/menu', icon: UtensilsCrossed },
          { name: 'My Orders', path: '/employee/orders', icon: ClipboardList },
          profile,
        ];
      case 'guest':
        return [
          { name: 'Menu', path: '/guest/menu', icon: UtensilsCrossed },
          { name: 'My Orders', path: '/guest/orders', icon: ClipboardList },
          profile,
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (loading || !isAuthenticated) return null;

  const roleBadge = {
    admin: 'bg-stone-900 text-amber-100 border-stone-900',
    staff: 'bg-green-50 text-green-800 border-green-200',
    employee: 'bg-ember-50 text-ember-700 border-ember-200',
    guest: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <nav className="glass-nav mx-auto max-w-[1400px] rounded-2xl shadow-card">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
          {/* Brand Logo & Name */}
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-cream shadow-card">
              <Soup className="h-5 w-5" strokeWidth={2} />
              <span className="absolute ml-6 mt-6 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-cream" />
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[16px] sm:text-[17px] font-extrabold tracking-tight text-ink">VDart Cafe</span>
              <span className="hidden min-w-0 font-mono-tokens text-[10px] uppercase tracking-[0.22em] text-ink-mute sm:block">Canteen Management System</span>
            </span>
          </Link>

          {/* Desktop/Laptop Navigation Bar (Hidden on Mobile) */}
          <div className="hidden items-center gap-1 rounded-full border border-stone-200/70 bg-white/70 p-1 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    active ? 'text-cream' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-stone-900"
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" strokeWidth={2} />
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side items */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live tokens always visible on mobile & desktop for employee/guest */}
            {(user?.role === 'employee' || user?.role === 'guest') && (
              <TokenPill value={user?.tokens ?? 0} tone="light" />
            )}

            {/* Desktop user profile badge (Hidden on mobile) */}
            <div className="hidden items-center gap-2.5 rounded-full border border-stone-200/70 bg-white/70 py-1 pl-1 pr-3 lg:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-600 text-xs font-extrabold text-white">
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] flex-col leading-tight xl:flex">
                <span className="truncate text-[13px] font-bold text-ink">{user?.name || user?.username}</span>
                <span className="truncate text-[11px] text-ink-mute">{user?.email || user?.role}</span>
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadge[user?.role] || 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                {user?.role}
              </span>
            </div>

            {/* Logout button: desktop/laptop */}
            <div className="hidden lg:block">
              <LogoutButton variant="ghost" size="sm" showLabel={false} className="rounded-full border border-stone-200/70 bg-white/70" />
            </div>

            {/* Mobile quick avatar / profile link (Navigates directly to profile, no duplicate dropdown) */}
            <Link
              to={`/${user?.role}/profile`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-600 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 lg:hidden"
              aria-label="My Profile"
              title="My Profile"
            >
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </Link>

            {/* Mobile compact logout button */}
            <div className="lg:hidden">
              <LogoutButton variant="ghost" size="sm" showLabel={false} className="h-9 w-9 rounded-xl border border-stone-200/70 bg-white/70" />
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
