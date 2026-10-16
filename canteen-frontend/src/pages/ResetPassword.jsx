import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { Mail, User, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ShieldCheck, Utensils, Send, Search, Clock, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'status'

  // Request State
  const [requestData, setRequestData] = useState({
    identifier: '',
    email: '',
    reason: '',
  });

  // Status Check State
  const [statusIdentifier, setStatusIdentifier] = useState('');
  const [statusResult, setStatusResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestChange = (e) => {
    const { name, value } = e.target;
    setRequestData((prev) => ({ ...prev, [name]: value }));
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

      const data = response.data;
      const successMsg = data.message || 'Password reset request submitted to Admin successfully!';
      setSuccess(successMsg);
      toast.success(successMsg, { autoClose: 4000 });
      setStatusIdentifier(requestData.identifier.trim());

    } catch (err) {
      console.error('Password reset request error:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit reset request. Please verify your credentials.';
      setError(errMsg);
      toast.error(errMsg, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setError('');
    setStatusResult(null);

    const targetId = statusIdentifier.trim();
    if (!targetId) {
      setError('Please enter your Username or Employee/Staff ID to check status');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.checkPasswordResetStatus(targetId);
      setStatusResult(response.data);
    } catch (err) {
      console.error('Check status error:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'No account or request found for this identifier.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovedLogin = (username, defaultPassword) => {
    navigate('/login', {
      state: {
        prefilledUsername: username,
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-cream">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 text-cream shadow-card mb-3">
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
              <div className="w-10 h-10 rounded-xl bg-ember-50 text-ember-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Forgot Password</h2>
              <p className="text-xs text-slate-500">Admin Approval Reset Process</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex p-1 mb-5 bg-slate-100 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('request'); setError(''); }}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'request'
                  ? 'bg-white text-ember-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Reset</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('status'); setError(''); }}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'status'
                  ? 'bg-white text-ember-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Check Status</span>
            </button>
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
              <div>
                <span className="font-semibold block">Request Sent!</span>
                <span className="text-xs">{success}</span>
              </div>
            </div>
          )}

          {/* TAB 1: REQUEST */}
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
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
                  className="w-full px-3.5 py-2 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors resize-none"
                />
              </div>

              {/* Notice Box */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="font-semibold flex items-center space-x-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Default Password Policy:</span>
                </div>
                <p>
                  Once approved by the Administrator, your password will be reset to your default <strong>Employee ID</strong>. You can change it afterwards in your Profile.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !requestData.identifier.trim() || !requestData.email.trim()}
                  className="w-full inline-flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm text-white bg-stone-900 hover:bg-ember-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-card"
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

          {/* TAB 2: CHECK STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <form onSubmit={handleCheckStatus} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Enter Username or Employee ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={statusIdentifier}
                      onChange={(e) => setStatusIdentifier(e.target.value)}
                      placeholder="e.g. employee_day or EMP001"
                      className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ember-500/20 focus:border-ember-500 transition-colors"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading || !statusIdentifier.trim()}
                      className="absolute inset-y-1 right-1 px-3.5 rounded-lg text-xs font-semibold text-white bg-stone-900 hover:bg-ember-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Status Display Card */}
              {statusResult && (
                <div className="p-4 rounded-2xl border transition-all animate-in fade-in duration-200 bg-slate-50 border-slate-200">
                  {!statusResult.has_request ? (
                    <div className="text-center py-2 text-xs text-slate-500">
                      No password reset requests found for this account.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Account: @{statusResult.username}</span>
                        {statusResult.status === 'approved' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                          </span>
                        )}
                        {statusResult.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1" /> Pending Admin Approval
                          </span>
                        )}
                        {statusResult.status === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle className="w-3 h-3 mr-1" /> Rejected
                          </span>
                        )}
                      </div>

                      {statusResult.status === 'approved' && (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 space-y-2">
                          <p className="font-semibold">
                            🎉 Your request has been approved by the Administrator!
                          </p>
                          <p>
                            Your password is now your Employee ID: <strong className="text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono text-sm">{statusResult.user_id}</strong>
                          </p>
                          <button
                            type="button"
                            onClick={() => handleApprovedLogin(statusResult.username, statusResult.user_id)}
                            className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Sign in with Employee ID ({statusResult.user_id})</span>
                          </button>
                        </div>
                      )}

                      {statusResult.status === 'pending' && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                          <p className="font-medium">
                            Your reset request has been received and is waiting for Admin approval.
                          </p>
                          <p className="text-[11px] text-amber-700 mt-1">
                            Once approved, you will be able to log in with your Employee ID: <strong>{statusResult.user_id}</strong>
                          </p>
                        </div>
                      )}

                      {statusResult.status === 'rejected' && (
                        <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
                          <p className="font-medium">Your password reset request was not approved.</p>
                          {statusResult.admin_notes && (
                            <p className="mt-1 text-[11px] italic">Note: {statusResult.admin_notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-xs font-semibold text-ember-700 hover:text-ember-800 transition-colors"
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
