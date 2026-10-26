import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, Lock, User, ArrowRight, TriangleAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/routes';
import vdartLogo from '../assets/vdart.svg';
import loginimage from '../assets/loginimage.png';
import ResetPasswordModal from '../components/ResetPasswordModal';
import LoadingFallback from '../components/canteen/LoadingFallback';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading, error: authError, user } = useAuth();

  const [credentials, setCredentials] = useState({
    username: location.state?.prefilledUsername || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    if (location.state?.prefilledUsername) {
      setCredentials((prev) => ({ ...prev, username: location.state.prefilledUsername }));
    }
  }, [location.state?.prefilledUsername]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reason') === 'expired') {
      setFormError('Your session expired. Please sign in again.');
    }
  }, [location.search]);

  const redirectUser = useCallback((role) => {
    const fromState = location.state?.from;
    const fromPath = typeof fromState === 'string' ? fromState : fromState?.pathname;
    const target = (fromPath && fromPath !== '/login') ? fromPath : getDefaultRoute(role);
    navigate(target, { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    if (isAuthenticated) redirectUser(user?.role);
  }, [isAuthenticated, user, redirectUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value.trimStart() }));
    if (formError) setFormError('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      const result = await login({ username: credentials.username.trim(), password: credentials.password });
      if (!(result && result.success)) {
        const errorMessage = (result && result.error) ? result.error : 'Login failed. Please check your credentials.';
        setFormError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <LoadingFallback message="Loading application…" />;
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-paper text-ink flex flex-col justify-center items-center px-4 py-6">
      <div className="grain-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm flex flex-col my-auto relative"
      >
        {/* Brand Header with Illustration as Background */}
        <div className="relative flex flex-col items-center justify-between text-center min-h-[175px] sm:min-h-[195px] mb-1 pt-2 overflow-visible">
          {/* Background Illustration behind logo and extending down above login box (scaled 4x) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-visible">
            <img
              src={loginimage}
              alt="VDart Cafe Background"
              className="mt-14 h-full w-auto object-contain drop-shadow-md scale-[4] transform origin-center transition-transform duration-300"
            />
          </div>

          {/* Visual space showcasing the coffee illustration directly above the login box */}
          <div className="h-10 sm:h-12" />
        </div>

        {/* Clean Login Box */}
        <div className="relative z-10 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-card">
          {(formError || authError) && (
            <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>{formError || authError}</span>
            </div>
          )}

          <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
            <div>
          {/* Logo & Subtitle in front of illustration */}
          <div className="relative z-10 flex flex-col items-center">
            <img src={vdartLogo} alt="VDart Cafe" className="h-8 sm:h-9 w-auto drop-shadow-sm mb-1" />
          </div>
              <label htmlFor="username" className="field-label text-[11px] mb-1">Username</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-mute">
                  <User className="h-4 w-4" strokeWidth={2} />
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
                  placeholder="Username or ID"
                  className="field-input pl-9 py-2 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label text-[11px] mb-1">Password</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-mute">
                  <Lock className="h-4 w-4" strokeWidth={2} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={handleChange}
                  placeholder="Password"
                  className="field-input pl-9 pr-9 py-2 text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-mute hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-xs">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="text-[11px] font-bold text-cobalt-700 hover:underline"
              >
                Reset password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-tactile inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cobalt-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-cobalt hover:bg-cobalt-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Minimal Footer */}
        <p className="mt-4 text-center font-mono-tokens text-[10px] uppercase tracking-wider text-ink-mute">
          VDart Cafe
        </p>
      </motion.div>

      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(resetUsername) => {
          if (resetUsername) {
            setCredentials({ username: resetUsername, password: '' });
            toast.info('Username pre-filled. Enter the password you just set.', { autoClose: 4000 });
          }
        }}
      />
    </div>
  );
};

export default Login;
