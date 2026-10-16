import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, Lock, User, ArrowRight, Soup, Clock, Coins, ClipboardList, TriangleAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/routes';
import ResetPasswordModal from '../components/ResetPasswordModal';

const spring = { type: 'spring', stiffness: 120, damping: 20 };

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

  useEffect(() => {
    if (location.state?.prefilledUsername) {
      setCredentials((prev) => ({ ...prev, username: location.state.prefilledUsername }));
    }
  }, [location.state?.prefilledUsername]);

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
      if (result && result.success) {
        const name = result.user?.name || result.user?.username || 'Welcome';
        toast.success(`Welcome back, ${name} — kitchen is open.`, { autoClose: 1400, pauseOnHover: false, hideProgressBar: true });
      } else {
        const errorMessage = (result && result.error) ? result.error : 'Login failed. Please check your credentials.';
        setFormError(errorMessage);
        toast.error(errorMessage);
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
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-cream px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900">
          <Soup className="h-7 w-7 animate-floaty text-cream" strokeWidth={2} />
        </div>
        <div className="w-full max-w-xs space-y-2.5">
          <div className="skeleton-shimmer h-3.5 w-full rounded-full" />
          <div className="skeleton-shimmer h-3.5 w-3/5 rounded-full" />
        </div>
        <p className="font-mono-tokens text-[11px] uppercase tracking-[0.22em] text-ink-mute">Checking your pass…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="grain-overlay" />
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1400px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-14">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-md">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-cream shadow-card">
                <Soup className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-xl font-extrabold tracking-tight">VDart Cafe</span>
                <span className="font-mono-tokens text-[10px] uppercase tracking-[0.24em] text-ink-mute">Canteen Management System</span>
              </span>
            </Link>

            <p className="mt-8 font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.22em] text-ember-600">
              Today's kitchen · 07:30 – 21:00
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-6xl sm:tracking-tighter text-balance">
              Lunch, sorted before the queue forms.
            </h1>
            <p className="mt-2.5 sm:mt-3 max-w-[52ch] text-sm sm:text-base leading-relaxed text-ink-mute">
              Order from today's menu with tokens, track the pass in real time, and pick up without waiting. Built for employees, guests and the crew behind the counter.
            </p>

            <div className="mt-6 sm:mt-8 rounded-3xl sm:rounded-4xl border border-stone-200/80 bg-white p-5 sm:p-7 shadow-card">
              {(formError || authError) && (
                <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800" role="alert">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <div><span className="font-bold">Sign-in failed. </span>{formError || authError}</div>
                </div>
              )}
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label htmlFor="username" className="field-label">Username</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-mute">
                      <User className="h-5 w-5" strokeWidth={2} />
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
                      placeholder="e.g. hariprasath.e042"
                      className="field-input pl-11"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="password" className="field-label">Password</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-mute">
                      <Lock className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      autoComplete="current-password"
                      value={credentials.password}
                      onChange={handleChange}
                      placeholder="Your secret spice mix"
                      className="field-input pl-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-mute transition-colors hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-mute">Use the password shared by your admin. Guests can ask the front desk.</p>
                </div>
                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <span className="font-mono-tokens uppercase tracking-[0.14em] text-ink-mute">Employees · Staff · Guests</span>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    className="font-bold text-ember-700 underline-offset-4 hover:underline"
                  >
                    Reset password
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3.5 text-sm font-bold text-cream shadow-card transition-colors hover:bg-ember-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (<><Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} /> Signing you in…</>) : (<>Enter VDart Cafe <ArrowRight className="h-4 w-4" strokeWidth={2.2} /></>)}
                </button>
              </form>
            </div>
            <p className="mt-5 font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              VDart Cafe · Token-first ordering · No cash queues
            </p>
          </motion.div>
        </div>

        <div className="relative hidden overflow-hidden lg:block">
          <motion.div
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-6 overflow-hidden rounded-5xl border border-stone-200/70 shadow-diffusion"
          >
            <img
              src="https://picsum.photos/seed/vdart-cafe-thali-2026/1200/1400"
              alt="Overhead thali with curries, rice, bread and salads"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/12 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cream to-transparent opacity-90" />

            <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/20 bg-stone-950/55 px-3.5 py-1.5 text-cream backdrop-blur-md">
              <span className="h-2 w-2 animate-breathe rounded-full bg-green-400" />
              <span className="font-mono-tokens text-[11px] font-semibold uppercase tracking-[0.18em]">Live · 47 thalis served today</span>
            </div>

            <div className="absolute inset-x-6 bottom-6 grid grid-cols-2 gap-3">
              <div className="glass-card stagger-item rounded-3xl p-4" style={{ '--index': 1 }}>
                <div className="flex items-center gap-2 text-ember-700">
                  <Coins className="h-4 w-4" strokeWidth={2} />
                  <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-[0.16em]">Token wallet</span>
                </div>
                <p className="mt-1.5 font-mono-tokens text-2xl font-bold text-ink">312.50 tk</p>
                <p className="text-xs text-ink-mute">Topped up this morning</p>
              </div>
              <div className="glass-card stagger-item rounded-3xl p-4" style={{ '--index': 2 }}>
                <div className="flex items-center gap-2 text-ember-700">
                  <Clock className="h-4 w-4" strokeWidth={2} />
                  <span className="font-mono-tokens text-[11px] font-bold uppercase tracking-[0.16em]">Counter wait</span>
                </div>
                <p className="mt-1.5 font-mono-tokens text-2xl font-bold text-ink">3.4 min</p>
                <p className="text-xs text-ink-mute">Skipped 22 people in queue</p>
              </div>
              <div className="glass-card stagger-item col-span-2 flex items-center gap-3 rounded-3xl p-4" style={{ '--index': 3 }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-cream">
                  <ClipboardList className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">Order #1847 moved to pickup shelf</p>
                  <p className="font-mono-tokens text-[11px] text-ink-mute">2 × sambar sadham · 1 × curd rice · just now</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800">Ready</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(resetUsername, defaultPassword) => {
          setCredentials({ username: resetUsername || '', password: defaultPassword || '' });
          if (defaultPassword) toast.info('Pre-filled with your reset credentials. Hit Enter to continue.', { autoClose: 4000 });
        }}
      />
    </div>
  );
};

export default Login;
