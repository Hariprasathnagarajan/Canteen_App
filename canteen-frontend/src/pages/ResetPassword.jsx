import { useNavigate, Link } from 'react-router-dom';
import PasswordResetForm from '../components/PasswordResetForm';
import { ArrowLeft, ShieldCheck, Utensils } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-paper">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cobalt-600 text-white shadow-card mb-3">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            VDart Cafe
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            VDart Cafe — Password Reset Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/70 p-7 sm:p-8">
          <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-cobalt-50 text-cobalt-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Forgot Password</h2>
              <p className="text-xs text-slate-500">Admin Approval Reset Process</p>
            </div>
          </div>

          <PasswordResetForm
            variant="page"
            onSuccess={() => navigate('/login')}
          />

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-xs font-semibold text-cobalt-700 hover:text-cobalt-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
