import { useAuth } from '../context/AuthContext';
import { LogOut, Loader2 } from 'lucide-react';

const LogoutButton = ({ className = '', variant = 'ghost', size = 'default', showLabel = true }) => {
  const { logout, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95';
  
  const variantStyles = variant === 'ghost'
    ? 'text-slate-600 hover:text-red-600 hover:bg-red-50/80 border border-transparent hover:border-red-100 focus:ring-red-500'
    : 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/20 focus:ring-red-500';

  const sizeStyles = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label="Log out"
      title="Log out"
    >
      {loading ? (
        <>
          <Loader2 className={`animate-spin ${showLabel ? 'mr-1.5' : ''} h-4 w-4`} />
          {showLabel && <span>Logging out...</span>}
        </>
      ) : (
        <>
          <LogOut className={`${showLabel ? 'mr-1.5' : ''} h-4 w-4`} />
          {showLabel && <span>Log out</span>}
        </>
      )}
    </button>
  );
};

export default LogoutButton;
