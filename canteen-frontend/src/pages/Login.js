import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Eye, EyeOff, Lock, User, LogIn, Utensils } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDefaultRoute } from '../utils/routes';
import ResetPasswordModal from '../components/ResetPasswordModal';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading, error: authError, user } = useAuth();
  
  const [credentials, setCredentials] = useState({
    username: location.state?.prefilledUsername || '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Update credentials if prefilledUsername changes
  useEffect(() => {
    if (location.state?.prefilledUsername) {
      setCredentials(prev => ({
        ...prev,
        username: location.state.prefilledUsername
      }));
    }
  }, [location.state?.prefilledUsername]);
  
  const redirectUser = useCallback((role) => {
    const fromState = location.state?.from;
    const fromPath = typeof fromState === 'string' ? fromState : fromState?.pathname;
    const target = (fromPath && fromPath !== '/login') ? fromPath : getDefaultRoute(role);
    navigate(target, { replace: true });
  }, [location.state, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      redirectUser(user?.role);
    }
  }, [isAuthenticated, user, redirectUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value.trim()
    }));
    // Clear errors when user types
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setFormError('');
    
    try {
      const result = await login(credentials);
      if (result && result.success) {
        const name = result.user?.name || result.user?.username || 'Welcome';
        toast.success(`Welcome, ${name}!`, { autoClose: 1400, pauseOnHover: false, hideProgressBar: true });
        // Redirect happens automatically via the useEffect
      } else {
        console.error('Login failed:', result);
        const errorMessage = result && result.error ? result.error : 'Login failed. Please check your credentials.';
        setFormError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = () => {
    if (!credentials.username.trim()) {
      setFormError('Username is required');
      return false;
    }
    if (!credentials.password) {
      setFormError('Password is required');
      return false;
    }
    return true;
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        <p className="text-slate-600 font-medium">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-4 transform hover:scale-105 transition-transform">
            <Utensils className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Canteen Portal
          </h2>
          <p className="mt-2 text-sm text-slate-500">Sign in with your campus or employee credentials</p>
        </div>

        <div className="glass-card rounded-2xl p-8 sm:p-10">
          {formError && (
            <div className="mb-5 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200/80 flex items-center space-x-2 animate-fadeIn">
              <span className="font-semibold">Error:</span>
              <span>{formError}</span>
            </div>
          )}
          {!formError && authError && (
            <div className="mb-5 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200/80 flex items-center space-x-2 animate-fadeIn">
              <span className="font-semibold">Error:</span>
              <span>{authError}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-5 w-5" />
                </span>
                <input
                  id="username"
                  type="text"
                  name="username"
                  required
                  autoComplete="username"
                  autoFocus
                  value={credentials.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  className="block w-full rounded-xl border border-slate-200 bg-white/70 pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="block w-full rounded-xl border border-slate-200 bg-white/70 pl-11 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-400 font-medium">Employees & Staff</span>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                Forgot password? Reset here
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Canteen App • Smart Food Ordering & Token Management
        </p>

        {/* Password Reset Modal for Employees and Staff */}
        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={(resetUsername, defaultPassword) => {
            setCredentials({
              username: resetUsername || '',
              password: defaultPassword || ''
            });
            if (defaultPassword) {
              toast.info(`Pre-filled with your Employee ID (${defaultPassword}). Click Sign In to continue!`, { autoClose: 4000 });
            }
          }}
        />
      </div>
    </div>
  );
};

export default Login;
