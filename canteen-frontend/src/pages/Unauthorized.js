import { ShieldAlert } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { LinkedLineBand } from '../components/lineart';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4">
      <div className="grain-overlay" />
      <div className="w-full max-w-md text-center">
        <div className="rounded-5xl border border-slate-200/70 bg-white p-10 shadow-diffusion">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
            <ShieldAlert className="h-8 w-8" strokeWidth={2} />
          </div>
          <p className="font-mono-tokens text-[11px] uppercase tracking-[0.24em] text-cobalt-600">Wrong counter</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Access denied</h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-relaxed text-ink-mute">
            Your role does not serve this page. Head back to your own counter.
          </p>
          <LinkedLineBand className="mx-auto mt-5 h-8 w-full max-w-[17rem] text-cobalt-500/70" />
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="btn-tactile rounded-2xl bg-cobalt-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cobalt-700"
            >
              Go back
            </button>
            <Link
              to="/"
              className="btn-tactile rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-ink-soft shadow-card hover:text-ink"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
