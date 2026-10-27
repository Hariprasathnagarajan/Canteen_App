import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CupGlyph, LinkedLineBand } from '../components/lineart';

const spring = { type: 'spring', stiffness: 120, damping: 20 };

const NotFound = () => {
  useEffect(() => {
    document.title = 'Page Not Found | VDart Cafe';
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-16 text-center">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-lg">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt-600 text-white shadow-diffusion">
          <CupGlyph className="h-7 w-7 animate-floaty" />
        </span>
        <p className="mt-6 font-mono-tokens text-xs uppercase tracking-[0.24em] text-cobalt-600">Off the menu</p>
        <h1 className="mt-2 text-6xl font-extrabold tracking-tighter text-ink">404</h1>
        <p className="mt-3 text-ink-mute text-balance">This plate is empty — the page you want is not on today's menu.</p>

        <LinkedLineBand className="mx-auto mt-6 h-10 w-full max-w-md text-cobalt-500/70" />

        <Link
          to="/"
          className="btn-tactile mt-8 inline-flex items-center gap-2 rounded-2xl bg-cobalt-600 px-6 py-3 text-sm font-bold text-white hover:bg-cobalt-700"
        >
          Back to today's menu
        </Link>

        <p className="mt-10 font-mono-tokens text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          © {new Date().getFullYear()} VDart Cafe
        </p>
      </motion.div>
    </div>
  );
};

export default NotFound;
