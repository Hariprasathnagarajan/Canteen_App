import PasswordResetForm from './PasswordResetForm';
import { X, ShieldCheck } from 'lucide-react';

const ResetPasswordModal = ({ isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-modalIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="h-2 bg-cobalt-600" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-cobalt-600 flex items-center justify-center text-white shadow-card">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Forgot Password</h2>
                <div className="inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full text-xs font-semibold bg-cobalt-50 text-cobalt-700 border border-cobalt-200/60">
                  Admin Approval Workflow
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-500 mb-5">
            Submit a request to the Admin. Once approved, you can set your own new password.
          </p>

          <PasswordResetForm
            variant="modal"
            onSuccess={(username) => {
              if (onSuccess) onSuccess(username);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
