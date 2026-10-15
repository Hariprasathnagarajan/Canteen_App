import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, User, BarChart2, Users, CreditCard, Utensils, ClipboardList, Shield } from 'lucide-react';
import LogoutButton from './LogoutButton';

const Navbar = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Navigation items based on user role
  const getNavItems = () => {
    if (!user) return [];
    
    const commonItems = [
      { name: 'Profile', path: `/${user.role}/profile`, icon: <User className="h-4 w-4" /> }
    ];

    switch (user.role) {
      case 'admin':
        return [
          { name: 'Dashboard', path: '/admin/dashboard', icon: <BarChart2 className="h-4 w-4" /> },
          { name: 'Users', path: '/admin/users', icon: <Users className="h-4 w-4" /> },
          { name: 'Tokens', path: '/admin/tokens', icon: <CreditCard className="h-4 w-4" /> },
          ...commonItems
        ];
      case 'staff':
        return [
          { name: 'Orders', path: '/staff/orders', icon: <ClipboardList className="h-4 w-4" /> },
          { name: 'Menu', path: '/staff/menu', icon: <Utensils className="h-4 w-4" /> },
          ...commonItems
        ];
      case 'employee':
        return [
          { name: 'Menu', path: '/employee/menu', icon: <Utensils className="h-4 w-4" /> },
          { name: 'My Orders', path: '/employee/orders', icon: <ClipboardList className="h-4 w-4" /> },
          ...commonItems
        ];
      case 'guest':
        return [
          { name: 'Menu', path: '/guest/menu', icon: <Utensils className="h-4 w-4" /> },
          { name: 'My Orders', path: '/guest/orders', icon: <ClipboardList className="h-4 w-4" /> },
          ...commonItems
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (loading || !isAuthenticated) {
    return null;
  }

  const roleColors = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    staff: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    employee: 'bg-blue-100 text-blue-800 border-blue-200',
    guest: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  return (
    <nav className="glass-nav sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Utensils className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Canteen App
              </span>
            </Link>

            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-blue-50/80 text-blue-700 shadow-sm border border-blue-100'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    {item.icon && <span className={`mr-2 ${active ? 'text-blue-600' : 'text-slate-400'}`}>{item.icon}</span>}
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-none">
                  {user?.name || user?.username}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {user?.email || (user?.role && user.role.toUpperCase())}
                </span>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase ${roleColors[user?.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {user?.role}
              </span>
            </div>
            <LogoutButton variant="ghost" size="sm" showLabel={false} />
          </div>

          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon && <span className="mr-3 text-slate-400">{item.icon}</span>}
                {item.name}
              </Link>
            );
          })}
          
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{user?.name || user?.username}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <LogoutButton variant="ghost" size="sm" showLabel={true} />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
