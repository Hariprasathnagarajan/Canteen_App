import { useState } from 'react';
import { authAPI } from '../utils/api';
import { Mail, User, CheckCircle2, AlertCircle, Loader2, Send, KeyRound, Lock } from 'lucide-react';
import { toast } from 'react-toastify';

const MIN_PASSWORD_LENGTH = 8;

const PasswordResetForm = ({ variant = 'page', onSuccess, onCancel }) => {
  const isModal = variant === 'modal';

  const [activeTab, setActiveTab] = useState('request');
  const [requestData, setRequestData] = useState({ identifier: '', email: '', reason: '' });
  const [passwordData, setPasswordData] = useState({
    identifier: '',
    email: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
  };

  const handleRequestChange = (e) => {
    const { name, value } = e.target;
    setRequestData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!requestData.identifier.trim()) {
      setError('Please enter your Username or Employee/Staff ID');
      return;
    }

    if (!requestData.email.trim()) {
      setError('Please enter your registered email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.requestPasswordReset({
        identifier: requestData.identifier.trim(),
        email: requestData.email.trim(),
        reason: requestData.reason.trim(),
      });

      const successMsg = response.data?.message || 'Your request has been submitted for review.';
      setSuccess(successMsg);
      toast.success(successMsg, { autoClose: 4000 });
    } catch (err) {
      console.error('Password reset request error:', err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to submit reset request. Please verify your details.';
      setError(errMsg);
      toast.error(errMsg, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!passwordData.identifier.trim()) {
      setError('Please enter your Username or Employee/Staff ID');
      return;
    }

    if (!passwordData.email.trim()) {
      setError('Please enter your registered email address');
      return;
    }

    if (passwordData.new_password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New password and confirm password do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.resetPassword({
        identifier: passwordData.identifier.trim(),
        email: passwordData.email.trim(),
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password,
      });

      const successMsg =
        response.data?.message || 'If this account is eligible, the new password has been applied.';
      setSuccess(successMsg);
      toast.success(successMsg, { autoClose: 4000 });
      setPasswordData((prev) => ({ ...prev, new_password: '', confirm_password: '' }));

      if (onSuccess) onSuccess(passwordData.identifier.trim());
    } catch (err) {
      console.error('Password reset error:', err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to set the new password. Please verify your details.';
      setError(errMsg);
      toast.error(errMsg, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cobalt-500/20 focus:border-cobalt-500 transition-colors';

  const tabButtonClass = (tab) =>
    `flex-1 py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
      activeTab === tab ? 'bg-white text-cobalt-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex p-1 mb-1 bg-slate-100 rounded-2xl text-xs font-semibold">
        <button type="button" onClick={() => switchTab('request')} className={tabButtonClass('request')}>
          <Send className="w-3.5 h-3.5" />
          <span>Request Reset</span>
        </button>
        <button type="button" onClick={() => switchTab('set')} className={tabButtonClass('set')}>
          <KeyRound className="w-3.5 h-3.5" />
          <span>Set New Password</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-sm flex items-start space-x-2.5">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <span className="font-semibold block">
              {activeTab === 'set' ? 'Password Update Sent' : 'Request Sent!'}
            </span>
            <span className="text-xs">{success}</span>
          </div>
        </div>
      )}

      {/* TAB: REQUEST A RESET */}
      {activeTab === 'request' && (
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Username or Employee / Staff ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                name="identifier"
                value={requestData.identifier}
                onChange={handleRequestChange}
                placeholder="e.g. employee_day, faizel, or EMP001"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Registered Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                value={requestData.email}
                onChange={handleRequestChange}
                placeholder="name@company.com"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Reason / Note (Optional)
            </label>
            <textarea
              name="reason"
              rows={2}
              value={requestData.reason}
              onChange={handleRequestChange}
              placeholder="e.g. Forgot password, locked out of account"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cobalt-500/20 focus:border-cobalt-500 transition-colors resize-none"
            />
          </div>

          <div className="p-3 bg-cobalt-50/80 border border-cobalt-200/80 rounded-xl text-xs text-cobalt-800 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <KeyRound className="w-4 h-4 text-cobalt-600" />
              <span>How the reset works:</span>
            </div>
            <p>
              An administrator must approve your request before you can set a new password. Nobody —
              including the administrator — can see or choose your password.
            </p>
          </div>

          <div className={`flex items-center ${isModal ? 'justify-end space-x-3 pt-3 border-t border-slate-100' : 'pt-2'}`}>
            {isModal && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !requestData.identifier.trim() || !requestData.email.trim()}
              className="inline-flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm text-white bg-cobalt-600 hover:bg-cobalt-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-card"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                'Submit Request to Admin'
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB: SET A NEW PASSWORD */}
      {activeTab === 'set' && (
        <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Username or Employee / Staff ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                name="identifier"
                value={passwordData.identifier}
                onChange={handlePasswordChange}
                placeholder="e.g. employee_day, faizel, or EMP001"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Registered Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                value={passwordData.email}
                onChange={handlePasswordChange}
                placeholder="name@company.com"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                placeholder="Repeat the new password"
                autoComplete="new-password"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="p-3 bg-cobalt-50/80 border border-cobalt-200/80 rounded-xl text-xs text-cobalt-800 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <KeyRound className="w-4 h-4 text-cobalt-600" />
              <span>Approval required:</span>
            </div>
            <p>
              The new password is applied only if an administrator has approved a reset request for this
              account. The approval is single-use — once the password is set, it cannot be reused.
            </p>
          </div>

          <div className={`flex items-center ${isModal ? 'justify-end space-x-3 pt-3 border-t border-slate-100' : 'pt-2'}`}>
            {isModal && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                !passwordData.identifier.trim() ||
                !passwordData.email.trim() ||
                passwordData.new_password.length < MIN_PASSWORD_LENGTH ||
                passwordData.new_password !== passwordData.confirm_password
              }
              className="inline-flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm text-white bg-cobalt-600 hover:bg-cobalt-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-card"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Password...
                </>
              ) : (
                'Set New Password'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PasswordResetForm;
