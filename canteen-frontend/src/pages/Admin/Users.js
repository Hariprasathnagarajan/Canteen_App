import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, UserCheck, Search, CreditCard, KeyRound, Loader2, Lock, Check, Clock, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const UserForm = ({ formData, setFormData, handleSubmit, resetForm, editingUser }) => (
  <div className="p-4 mb-4 bg-white shadow-sm rounded-xl">
    <h3 className="mb-4 text-lg font-semibold">
      {editingUser ? 'Edit User' : 'Add New User'}
    </h3>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            User ID
          </label>
          <input
            type="text"
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            required
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Last Name</label>
          <input
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">Work Shift</label>
        <select
          value={formData.work_shift}
          onChange={(e) => setFormData({ ...formData, work_shift: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="day">Day</option>
          <option value="mid">Mid</option>
          <option value="night">Night</option>
        </select>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-700">Role</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="employee">Employee</option>
          <option value="staff">Staff</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <div className="flex space-x-2">
        <button
          type="submit"
          className="flex items-center px-4 py-2 space-x-2 text-white transition-colors rounded-lg bg-primary hover:bg-ember-600"
        >
          <Save size={16} />
          <span>{editingUser ? 'Update' : 'Add'} User</span>
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="btn-tactile flex items-center px-4 py-2 space-x-2 text-white transition-colors bg-stone-500 rounded-xl hover:bg-stone-600"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
      </div>
    </form>
  </div>
);

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    username: '',
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'employee',
    work_shift: 'day'
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

const formatApiError = (error) => {
  if (!error?.response?.data) return error.message || 'Error saving user';
  const data = error.response.data;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (typeof data === 'object') {
    const msgs = Object.entries(data).map(([field, err]) => {
      const errStr = Array.isArray(err) ? err.join(' ') : String(err);
      const fieldName = field.replace('_', ' ');
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}: ${errStr}`;
    });
    if (msgs.length) return msgs.join(' • ');
  }
  return 'Error saving user. Please check form fields.';
};

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = {
      username: formData.username?.trim(),
      user_id: formData.user_id?.trim() || null,
      first_name: formData.first_name?.trim() || '',
      last_name: formData.last_name?.trim() || '',
      email: formData.email?.trim() || '',
      role: formData.role || 'employee',
      work_shift: formData.work_shift || 'day',
    };

    if (editingUser) {
      await adminAPI.updateUser(editingUser.id, payload);
      setUsers(users.map(user =>
        user.id === editingUser.id ? { ...user, ...payload } : user
      ));
      setEditingUser(null);
      toast.success('User updated successfully');
    } else {
      const response = await adminAPI.createUser(payload);
      setUsers([response.data, ...users]);
      setShowAddForm(false);
      toast.success('User created successfully');
    }

    resetForm();

  } catch (error) {
    console.error('Error in handleSubmit:', error);
    const errMsg = formatApiError(error);
    toast.error(errMsg);
  }
};

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      work_shift: user.work_shift,
    });
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await adminAPI.deleteUser(id);
        setUsers(users.filter(user => user.id !== id));
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      user_id: '',
      first_name: '',
      last_name: '',
      email: '',
      role: 'employee',
      work_shift: 'day'
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResettingPassword(true);
    try {
      const response = await adminAPI.resetUserPassword(resetModalUser.id, {
        new_password: newPasswordValue.trim()
      });
      toast.success(response.data?.message || `Password reset for ${resetModalUser.username}`);
      setResetModalUser(null);
      setNewPasswordValue('');
    } catch (err) {
      console.error('Password reset error:', err);
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  // Password Reset Requests State
  const [resetRequests, setResetRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const fetchResetRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const res = await adminAPI.getPasswordResetRequests();
      setResetRequests(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching reset requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchResetRequests();
  }, [fetchResetRequests]);

  const handleApproveRequest = async (requestId) => {
    setProcessingRequestId(requestId);
    try {
      const res = await adminAPI.approvePasswordReset(requestId);
      toast.success(res.data?.message || 'Password reset request approved!');
      await fetchResetRequests();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    const notes = window.prompt('Enter rejection note / reason (optional):') || '';
    setProcessingRequestId(requestId);
    try {
      const res = await adminAPI.rejectPasswordReset(requestId, { notes });
      toast.info(res.data?.message || 'Request rejected');
      await fetchResetRequests();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const pendingRequestsCount = resetRequests.filter(r => r.status === 'pending').length;

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'staff': return 'bg-ember-100 text-ember-800';
      case 'employee': return 'bg-green-100 text-green-800';
      case 'guest': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filtered list based on search term
  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(term) ||
      (user.first_name && user.first_name.toLowerCase().includes(term)) ||
      (user.last_name && user.last_name.toLowerCase().includes(term)) ||
      (user.email && user.email.toLowerCase().includes(term))
    );
  });
  const [activeTab, setActiveTab] = useState('all');

  const getFilteredByRole = (users, role) => {
    if (role === 'all') return users;
    return users.filter((user) => user.role === role);
  };

  const displayedUsers = getFilteredByRole(filteredUsers, activeTab);



  return (
    <div className="flex flex-col h-full">
   <div className="p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex flex-1 gap-2 md:flex-none">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Search className="absolute w-5 h-5 text-gray-400 left-3 top-2.5" />
          </div>
          {!showAddForm && !editingUser && (
            <button
              onClick={() => setShowAddForm(true)}
          className="btn-tactile flex items-center px-4 py-2 space-x-2 text-white transition-colors rounded-xl bg-primary hover:bg-ember-600 shadow-ember"
            >
              <Plus size={16} />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {(showAddForm || editingUser) && (
        <UserForm
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
          editingUser={editingUser}
        />
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-200">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto">
          {['all', 'staff', 'employee', 'guest'].map((role) => (
            <button
              key={role}
              onClick={() => setActiveTab(role)}
              className={`relative px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                activeTab === role ? 'text-primary' : 'text-gray-600'
              }`}
            >
              {role}
              {activeTab === role && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-all duration-300"></span>
              )}
            </button>
          ))}

          <button
            onClick={() => setActiveTab('requests')}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'requests' ? 'text-primary font-bold' : 'text-gray-600'
            }`}
          >
            <span>Password Reset Requests</span>
            {pendingRequestsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {pendingRequestsCount} pending
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {resetRequests.length}
              </span>
            )}
            {activeTab === 'requests' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-all duration-300"></span>
            )}
          </button>
        </div>

        {activeTab === 'requests' && (
          <button
            onClick={fetchResetRequests}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* RENDER TAB: PASSWORD RESET REQUESTS */}
      {activeTab === 'requests' ? (
        <div className="space-y-4">
          <div className="p-4 bg-ember-50/70 border border-ember-200/80 rounded-2xl flex items-start space-x-3 text-xs text-ember-900">
            <ShieldCheck className="w-5 h-5 text-ember-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-ember-950 mb-0.5">Password Reset Policy</p>
              <p className="text-ember-800">
                When an employee or staff member forgets their password, they submit a request here. When you click <strong>"Approve & Reset"</strong>, the system resets their password directly to their default <strong>Employee ID</strong>.
              </p>
            </div>
          </div>

          {loadingRequests ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-b-2 rounded-full animate-spin border-primary"></div>
            </div>
          ) : resetRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/70 p-8">
              <KeyRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-slate-700 font-semibold mb-1">No Password Reset Requests</h4>
              <p className="text-xs text-slate-400">When employees or staff request a password reset, it will appear here for your approval.</p>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {resetRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="font-bold text-slate-900 text-sm">
                        {req.user_details?.name || req.user_details?.username}
                      </span>
                      <span className="text-xs text-slate-500">(@{req.user_details?.username})</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getRoleBadgeColor(req.user_details?.role)}`}>
                        {req.user_details?.role}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Employee ID: {req.user_details?.user_id || 'N/A'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                      <span>Email: <strong className="text-slate-800">{req.user_details?.email || 'N/A'}</strong></span>
                      <span>Requested: {new Date(req.created_at).toLocaleString()}</span>
                      {req.reason && <span className="italic text-slate-500">Reason: "{req.reason}"</span>}
                    </div>

                    {req.admin_notes && (
                      <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
                        {req.admin_notes}
                      </p>
                    )}
                  </div>

                  {/* Actions / Status */}
                  <div className="flex items-center space-x-2">
                    {req.status === 'pending' ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          disabled={processingRequestId === req.id}
                          className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                        >
                          {processingRequestId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          <span>Approve (Reset to {req.user_details?.user_id || 'ID'})</span>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          disabled={processingRequestId === req.id}
                          className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 active:scale-95 transition-all border border-red-200 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : req.status === 'approved' ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approved (Reset to {req.user_details?.user_id})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* User List */
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-b-2 rounded-full animate-spin border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4">
          {displayedUsers.length > 0 ? (
            displayedUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col p-3 space-y-3 transition-shadow bg-white border rounded-lg hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:space-y-0"
              >
                {/* Left: Avatar + Name + Username */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-stone-100 rounded-full shrink-0">
                    <UserCheck className="w-4 h-4 text-stone-600" />
                  </div>
                  <div className="group">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 group-hover:underline" title={`@${user.username}`}>
                      @{user.username}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                    title={`Role: ${user.role}`}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>

                  {user.role !== 'staff' && (
                    <span
                      className="inline-flex items-center px-3 py-1 space-x-1 font-medium text-green-700 bg-green-100 rounded-full"
                      title={`Tokens: ${user.tokens || 0}`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{user.tokens || 0}</span>
                    </span>
                  )}
                  </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">

                  <span
                    className="text-gray-500 truncate max-w-[150px]"
                    title={user.email || 'Email not provided'}
                  >
                    {user.email || 'No email'}
                  </span>
                </div>

                {/* Right: Actions */}
                <div className="flex justify-between items-center space-x-2">
                  <button
                    onClick={() => {
                      setResetModalUser(user);
                      setNewPasswordValue(user.user_id || 'Password123!');
                    }}
                    className="p-1 text-amber-500 transition-colors hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                    title="Reset user password"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(user)}
                    className="btn-tactile p-1 text-ember-600 transition-colors hover:text-ember-800 hover:bg-ember-50 rounded-lg"
                    title="Edit user"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-1 text-red-500 transition-colors hover:text-red-700 hover:bg-red-50 rounded-lg"
                    title="Delete user"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500">No users found.</div>
          )}
        </div>
        )
      )}

      {/* Admin Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 bg-white border border-slate-100 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 text-amber-600 bg-amber-50 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Reset User Password</h3>
                  <p className="text-xs text-slate-500">Admin Password Management</p>
                </div>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 mb-4 text-xs rounded-xl bg-slate-50 border border-slate-200/60 space-y-1 text-slate-600">
              <div><span className="font-semibold text-slate-700">User:</span> {resetModalUser.first_name} {resetModalUser.last_name} (@{resetModalUser.username})</div>
              <div><span className="font-semibold text-slate-700">Role:</span> <span className="capitalize">{resetModalUser.role}</span> • User ID: {resetModalUser.user_id || 'N/A'}</div>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Default suggestion is their User ID. You can type any custom password.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword || newPasswordValue.length < 6}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm shadow-amber-500/20"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Confirm Reset'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
export default AdminUsers;