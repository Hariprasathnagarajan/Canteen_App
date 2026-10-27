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

  const baseStyles = 'btn-tactile inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-paper';

  const variantStyles = variant === 'ghost'
    ? 'text-rose-600 bg-rose-50/90 border border-rose-200/90 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 shadow-2xs focus:ring-rose-400'
    : (variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-card focus:ring-rose-500'
      : 'bg-cobalt-600 text-white hover:bg-cobalt-700 shadow-card focus:ring-cobalt-500');

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
