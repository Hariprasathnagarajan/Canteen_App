import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, ClipboardList, User, LayoutGrid, Users, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = memo(function MobileBottomNav() {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading || !isAuthenticated || !user) return null;

  const getTabs = () => {
    switch (user.role) {
      case 'employee':
        return [
          { name: 'Menu', path: '/employee/menu', icon: UtensilsCrossed },
          { name: 'Orders', path: '/employee/orders', icon: ClipboardList },
          { name: 'My Pass', path: '/employee/profile', icon: User },
        ];
      case 'guest':
        return [
          { name: 'Menu', path: '/guest/menu', icon: UtensilsCrossed },
          { name: 'Orders', path: '/guest/orders', icon: ClipboardList },
          { name: 'Pass', path: '/guest/profile', icon: User },
        ];
      case 'staff':
        return [
          { name: 'Tickets', path: '/staff/orders', icon: ClipboardList },
          { name: 'Menu', path: '/staff/menu', icon: UtensilsCrossed },
          { name: 'Profile', path: '/staff/profile', icon: User },
        ];
      case 'admin':
        return [
          { name: 'Overview', path: '/admin/dashboard', icon: LayoutGrid },
          { name: 'Users', path: '/admin/users', icon: Users },
          { name: 'Tokens', path: '/admin/tokens', icon: Coins },
          { name: 'Profile', path: '/admin/profile', icon: User },
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
      className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 block lg:hidden border-t border-stone-200/80 bg-white/94 backdrop-blur-xl shadow-[0_-4px_24px_rgba(28,25,23,0.06)]"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5 pb-1">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`touch-pill relative flex flex-1 flex-col items-center justify-center py-1 transition-colors duration-200 ${
                active ? 'text-ember-700' : 'text-stone-400 hover:text-stone-700 active:text-stone-900'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {active && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute -inset-x-3.5 -inset-y-1 rounded-2xl bg-ember-50 border border-ember-200/70"
                  />
                )}
                <Icon
                  className={`relative z-10 h-5 w-5 transition-transform duration-200 ${
                    active ? 'scale-110 text-ember-700 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span
                className={`relative z-10 mt-1 text-[10.5px] tracking-tight transition-all duration-200 ${
                  active ? 'font-bold text-ember-900' : 'font-medium text-stone-500'
                }`}
              >
                {tab.name}
              </span>
              {active && (
                <motion.span
                  layoutId="mobile-tab-pip"
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="mt-0.5 h-1 w-1 rounded-full bg-ember-600"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

export default MobileBottomNav;
