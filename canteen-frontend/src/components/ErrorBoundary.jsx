import React from 'react';
import { CupGlyph } from './lineart';
import { RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('VDart Cafe caught an unhandled runtime error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-paper px-4 text-center text-ink">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cobalt-600 text-white shadow-card">
            <CupGlyph className="h-9 w-9" />
          </div>

          <div className="max-w-md space-y-2">
            <p className="font-mono-tokens text-[11px] font-bold uppercase tracking-[0.22em] text-cobalt-600">
              Kitchen Hiccup
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Something went off the pass
            </h1>
            <p className="text-sm text-ink-mute leading-relaxed">
              We hit an unexpected snag loading this screen. Don't worry, your orders and token balance remain safe.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-cobalt hover:bg-cobalt-700 transition"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Screen</span>
            </button>
            <button
              onClick={this.handleGoHome}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-ink hover:bg-slate-50 transition shadow-2xs"
            >
              <Home className="h-4 w-4 text-ink-mute" />
              <span>Return Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
