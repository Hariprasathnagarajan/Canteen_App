import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, ClipboardList, User, LayoutGrid, Users, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileModal } from '../context/ProfileModalContext';

const MobileBottomNav = memo(function MobileBottomNav() {
  const { user, isAuthenticated, loading } = useAuth();
  const { openProfile } = useProfileModal();
  const location = useLocation();

  if (loading || !isAuthenticated || !user) return null;

  const getTabs = () => {
    switch (user.role) {
      case 'employee':
        return [
          { name: 'Menu', path: '/employee/menu', icon: UtensilsCrossed },
          { name: 'Orders', path: '/employee/orders', icon: ClipboardList },
          { name: 'My Pass', action: 'profile', icon: User },
        ];
      case 'guest':
        return [
          { name: 'Menu', path: '/guest/menu', icon: UtensilsCrossed },
          { name: 'Orders', path: '/guest/orders', icon: ClipboardList },
          { name: 'Pass', action: 'profile', icon: User },
        ];
      case 'staff_admin':
        return [
          { name: 'Analytics', path: '/staff-admin/dashboard', icon: LayoutGrid },
          { name: 'Staff', path: '/admin/users', icon: Users },
          { name: 'Kitchen', path: '/staff/orders', icon: ClipboardList },
          { name: 'Menu', path: '/staff/menu', icon: UtensilsCrossed },
          { name: 'Profile', action: 'profile', icon: User },
        ];
      case 'staff':
        return [
          { name: 'Tickets', path: '/staff/orders', icon: ClipboardList },
          { name: 'Menu', path: '/staff/menu', icon: UtensilsCrossed },
          { name: 'Profile', action: 'profile', icon: User },
        ];
      case 'admin':
        return [
          { name: 'Overview', path: '/admin/dashboard', icon: LayoutGrid },
          { name: 'Users', path: '/admin/users', icon: Users },
          { name: 'Tokens', path: '/admin/tokens', icon: Coins },
          { name: 'Profile', action: 'profile', icon: User },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();
  if (!tabs.length) return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 block lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1 pb-0.5">
        {tabs.map((tab) => {
          const active = tab.path ? isActive(tab.path) : false;
          const Icon = tab.icon;
          const inner = (
            <>
              <div className="relative flex items-center justify-center">
                {active && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute -inset-x-3 -inset-y-0.5 rounded-xl bg-cobalt-50 border border-cobalt-200/70"
                  />
                )}
                <Icon
                  className={`relative z-10 h-4.5 w-4.5 transition-transform duration-200 ${
                    active ? 'scale-105 text-cobalt-700 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span
                className={`relative z-10 mt-0.5 text-[10px] tracking-tight transition-all duration-200 ${
                  active ? 'font-bold text-cobalt-900' : 'font-medium text-slate-500'
                }`}
              >
                {tab.name}
              </span>
              {active && (
                <motion.span
                  layoutId="mobile-tab-pip"
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="mt-0.5 h-1 w-1 rounded-full bg-cobalt-600"
                />
              )}
            </>
          );

          if (tab.action === 'profile') {
            return (
              <button
                key={tab.name}
                type="button"
                onClick={openProfile}
                aria-label="Open profile"
                className="touch-pill relative flex flex-1 flex-col items-center justify-center py-0.5 text-slate-400 transition-colors duration-200 hover:text-slate-700 active:text-slate-900"
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`touch-pill relative flex flex-1 flex-col items-center justify-center py-0.5 transition-colors duration-200 ${
                active ? 'text-cobalt-700' : 'text-slate-400 hover:text-slate-700 active:text-slate-900'
              }`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

export default MobileBottomNav;
