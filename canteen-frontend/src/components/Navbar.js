import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LayoutGrid, Users, Coins, UtensilsCrossed, ClipboardList, Menu as MenuIcon, X, Phone, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CupGlyph } from './lineart';
import LogoutButton from './LogoutButton';
import TokenPill from './canteen/TokenPill';
import { CONTACT } from '../utils/contact';

const Navbar = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

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
    admin: 'bg-ink text-white border-ink',
    staff: 'bg-leaf-50 text-leaf-700 border-leaf-600/30',
    employee: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
    guest: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <nav className="glass-nav mx-auto max-w-[1400px] rounded-2xl shadow-card">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
          {/* Brand Logo & Name */}
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="VDart Cafe home">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-600 text-white shadow-card">
              <CupGlyph className="h-6 w-6" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-leaf-500 ring-2 ring-white" />
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[16px] sm:text-[17px] font-extrabold tracking-tight text-ink">VDart Cafe</span>
              <span className="hidden min-w-0 font-mono-tokens text-[10px] uppercase tracking-[0.22em] text-ink-mute sm:block">Canteen Management System</span>
            </span>
          </Link>

          {/* Desktop/Laptop Navigation Bar (Hidden on Mobile) */}
          <div className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    active ? 'text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-cobalt-600"
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
            <div className="hidden items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/70 py-1 pl-1 pr-3 lg:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cobalt-600 text-xs font-extrabold text-white">
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] flex-col leading-tight xl:flex">
                <span className="truncate text-[13px] font-bold text-ink">{user?.name || user?.username}</span>
                <span className="truncate text-[11px] text-ink-mute">{user?.email || user?.role}</span>
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadge[user?.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {user?.role}
              </span>
            </div>

            {/* Logout button: desktop/laptop */}
            <div className="hidden lg:block">
              <LogoutButton variant="ghost" size="sm" showLabel={false} className="rounded-full border border-slate-200/80 bg-white/70" />
            </div>

            {/* Mobile hamburger menu trigger */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-ink shadow-sm transition-transform active:scale-95 lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X className="h-5 w-5" strokeWidth={2.2} /> : <MenuIcon className="h-5 w-5" strokeWidth={2.2} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="lg:hidden"
            >
              <div className="border-t border-slate-200/80 px-3 py-3">
                {/* Signed-in user */}
                <div className="flex items-center gap-3 rounded-2xl bg-paper/80 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cobalt-600 text-sm font-extrabold text-white">
                    {(user?.name || user?.username || 'U')[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{user?.name || user?.username}</p>
                    <p className="truncate text-xs text-ink-mute">{user?.email || user?.role}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadge[user?.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {user?.role}
                  </span>
                </div>

                {/* Navigation links */}
                <div className="mt-2 space-y-0.5">
                  {navItems.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          active ? 'bg-cobalt-600 text-white' : 'text-ink-soft hover:bg-paper-dark hover:text-ink'
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>

                {/* Contact */}
                <div className="mt-2 border-t border-slate-200/80 pt-2">
                  <a
                    href={CONTACT.phoneHref}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-paper-dark hover:text-ink"
                  >
                    <Phone className="h-4 w-4 text-cobalt-600" strokeWidth={2} />
                    {CONTACT.phoneDisplay}
                  </a>
                  <a
                    href={CONTACT.emailHref}
                    className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-paper-dark hover:text-ink"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-cobalt-600" strokeWidth={2} />
                    <span className="truncate">{CONTACT.email}</span>
                  </a>
                </div>

                {/* Logout */}
                <div className="mt-1 border-t border-slate-200/80 pt-2">
                  <LogoutButton variant="ghost" size="sm" showLabel className="w-full justify-start px-3 py-2.5 text-sm" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Backdrop behind the open mobile menu */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[-1] cursor-default bg-slate-950/25 backdrop-blur-[2px] lg:hidden"
        />
      )}
    </header>
  );
};

export default Navbar;
