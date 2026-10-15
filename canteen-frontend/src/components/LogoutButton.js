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

  const baseStyles = 'btn-tactile inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cream';

  const variantStyles = variant === 'ghost'
    ? 'text-ink-mute hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 focus:ring-red-400'
    : 'bg-stone-900 text-cream hover:bg-ember-600 shadow-card focus:ring-ember-500';

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
