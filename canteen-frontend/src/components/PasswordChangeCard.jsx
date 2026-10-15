import { useState } from 'react';
import { authAPI } from '../utils/api';
import { Lock, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

const PasswordChangeCard = () => {
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleShow = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const isLengthValid = formData.new_password.length >= 6;
  const isMatchValid = formData.new_password && formData.new_password === formData.confirm_password;
  const isDifferent = formData.old_password && formData.new_password && formData.old_password !== formData.new_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.old_password) {
      setError('Please enter your current password');
      return;
    }

    if (!formData.new_password) {
      setError('Please enter a new password');
      return;
    }

    if (!isLengthValid) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError('New password and confirmation do not match');
      return;
    }

    if (formData.old_password === formData.new_password) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.updatePassword({
        old_password: formData.old_password,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
      });

      const message = response.data?.message || 'Password updated successfully!';
      setSuccess(message);
      toast.success(message, { autoClose: 3000 });
      setFormData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      console.error('Password change error:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to update password. Please check your current password.';
      setError(errMsg);
      toast.error(errMsg, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mt-6 transition-all duration-200">
      <div className="flex items-center space-x-3 pb-4 mb-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-ember-50 text-ember-700 flex items-center justify-center font-bold">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
          <p className="text-xs text-slate-500">Update your account password to keep your account secure</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-sm flex items-start space-x-2.5">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Current Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPasswords.old ? 'text' : 'password'}
              name="old_password"
              value={formData.old_password}
              onChange={handleChange}
              placeholder="Enter current password"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => toggleShow('old')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              tabIndex="-1"
            >
              {showPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showPasswords.new ? 'text' : 'password'}
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => toggleShow('new')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              tabIndex="-1"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              placeholder="Re-enter new password"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => toggleShow('confirm')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              tabIndex="-1"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Requirements Checklist */}
        <div className="pt-1 text-xs space-y-1.5 text-slate-500">
          <div className="flex items-center space-x-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isLengthValid ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className={isLengthValid ? 'text-emerald-700 font-medium' : ''}>
              At least 6 characters
            </span>
          </div>
          {formData.confirm_password && (
            <div className="flex items-center space-x-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isMatchValid ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className={isMatchValid ? 'text-emerald-700 font-medium' : 'text-red-600'}>
                {isMatchValid ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !formData.old_password || !formData.new_password || !isLengthValid || !isMatchValid}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-stone-900 hover:bg-ember-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-card"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating Password...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordChangeCard;
