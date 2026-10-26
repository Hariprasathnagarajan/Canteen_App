import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, UserCheck, Search, CreditCard, KeyRound, Loader2, Check, Clock, ShieldCheck, AlertCircle, RefreshCw, Upload, RotateCcw, History, Building2, UtensilsCrossed, Users } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import BulkUploadPanel from '../../components/BulkUploadPanel';
import EmptyState from '../../components/canteen/EmptyState';
import Modal from '../../components/Modal';

const USERS_TEMPLATE_CSV = [
  'username,user_id,first_name,last_name,email,role,work_shift,monthly_tokens',
  'emp101,EMP101,Arun,Kumar,arun.kumar@vdart.com,employee,day,',
  'emp102,EMP102,Divya,Shree,divya.shree@vdart.com,employee,night,',
  'guest01,GST001,Walk-in,Guest,guest01@vdart.com,guest,day,',
  'staff_chef1,STF001,Ramesh,Cook,ramesh@vdart.com,staff,day,',
].join('\r\n');

const STAFF_TEMPLATE_CSV = [
  'username,user_id,first_name,last_name,email,role,work_shift',
  'staff_chef1,STF001,Ramesh,Cook,ramesh@vdart.com,staff,day',
  'staff_server1,STF002,Priya,Server,priya@vdart.com,staff,mid',
].join('\r\n');

const UserForm = ({ formData, setFormData, handleSubmit, resetForm, editingUser, isStaffAdmin, offices = [], kitchens = [] }) => (
  <Modal
    onClose={resetForm}
    title={editingUser ? 'Edit User' : 'Add New User'}
    subtitle={editingUser ? `Updating ${editingUser.username}` : 'Create an account and assign its role and work shift.'}
    maxWidth="max-w-xl"
  >
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">Username</label>
          <input
            type="text"
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Last Name</label>
          <input
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
          >
            {isStaffAdmin ? (
              <option value="staff">Staff Crew</option>
            ) : (
              <>
                <optgroup label="System & Cafeteria Leadership">
                  <option value="staff_admin">Staff Admin (Cafeteria Manager)</option>
                </optgroup>
                <optgroup label="Kitchen Crew">
                  <option value="staff">Staff Crew (Cook / Server / Prep)</option>
                </optgroup>
                <optgroup label="Consumers">
                  <option value="employee">Employee</option>
                  <option value="guest">Guest</option>
                </optgroup>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Office Location</label>
          <select
            value={formData.office || ''}
            onChange={(e) => {
              const offId = e.target.value ? parseInt(e.target.value) : '';
              const matchedKitchen = kitchens.find(k => k.office === offId);
              setFormData({
                ...formData,
                office: offId,
                assigned_kitchen: matchedKitchen ? matchedKitchen.id : (offId ? '' : formData.assigned_kitchen)
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
          >
            <option value="">-- Main Office (Default) --</option>
            {offices.map((off) => (
              <option key={off.id} value={off.id}>
                {off.name} ({off.code})
              </option>
            ))}
          </select>
        </div>

        {(formData.role === 'staff' || formData.role === 'staff_admin') && (
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Assigned Kitchen</label>
            <select
              value={formData.assigned_kitchen || ''}
              onChange={(e) => setFormData({ ...formData, assigned_kitchen: e.target.value ? parseInt(e.target.value) : '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">-- Auto (Office Kitchen) --</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.office_name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex space-x-2 pt-2">
        <button
          type="submit"
          className="flex items-center px-4 py-2 space-x-2 text-white transition-colors rounded-lg bg-primary hover:bg-cobalt-700"
        >
          <Save size={16} />
          <span>{editingUser ? 'Update' : 'Add'} User</span>
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="btn-tactile flex items-center px-4 py-2 space-x-2 text-white transition-colors bg-slate-500 rounded-xl hover:bg-slate-600"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
      </div>
    </form>
  </Modal>
);

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const isStaffAdmin = currentUser?.role === 'staff_admin';

  const [users, setUsers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('all');
  const [userSubFilter, setUserSubFilter] = useState('all'); // 'all' | 'employee' | 'guest'
  const [activeTab, setActiveTab] = useState(isStaffAdmin ? 'staff_crew' : 'staff_admin');
  const [formData, setFormData] = useState({
    username: '',
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    role: isStaffAdmin ? 'staff' : 'employee',
    work_shift: 'day',
    office: '',
    assigned_kitchen: '',
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Could not load users. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOfficesAndKitchens = useCallback(async () => {
    try {
      const [offRes, kitRes] = await Promise.all([
        adminAPI.getOffices(),
        adminAPI.getKitchens(),
      ]);
      setOffices(offRes.data.results || offRes.data || []);
      setKitchens(kitRes.data.results || kitRes.data || []);
    } catch (err) {
      console.error('Failed to load offices and kitchens:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchOfficesAndKitchens();
  }, [fetchUsers, fetchOfficesAndKitchens]);

  const fetchDeletedUsers = useCallback(async () => {
    setLoadingDeleted(true);
    try {
      const response = await adminAPI.getDeletedUsers();
      setDeletedUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching deleted users:', error);
      toast.error('Could not load deleted users. Please refresh the page.');
    } finally {
      setLoadingDeleted(false);
    }
  }, []);

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
      office: formData.office ? parseInt(formData.office) : null,
      assigned_kitchen: formData.assigned_kitchen ? parseInt(formData.assigned_kitchen) : null,
    };

    if (editingUser) {
      await adminAPI.updateUser(editingUser.id, payload);
      setUsers(users.map(user =>
        user.id === editingUser.id ? { ...user, ...payload } : user
      ));
      setEditingUser(null);
      toast.success('User updated successfully');
      fetchUsers();
    } else {
      const response = await adminAPI.createUser(payload);
      setUsers([response.data, ...users]);
      setShowAddForm(false);
      toast.success('User created successfully');
      fetchUsers();
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
      office: user.office || user.office_id || '',
      assigned_kitchen: user.assigned_kitchen || user.assigned_kitchen_id || '',
    });
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await adminAPI.deleteUser(id);
        setUsers(users.filter(user => user.id !== id));
        toast.success('User deleted');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error(formatApiError(error) || 'Failed to delete user');
      }
    }
  };

  const handleRestore = async (id) => {
    setRestoringId(id);
    try {
      const response = await adminAPI.restoreUser(id);
      setDeletedUsers(deletedUsers.filter(user => user.id !== id));
      setUsers(prev => [response.data, ...prev.filter(u => u.id !== id)]);
      toast.success('User restored');
    } catch (error) {
      console.error('Error restoring user:', error);
      toast.error(formatApiError(error) || 'Failed to restore user');
    } finally {
      setRestoringId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      user_id: '',
      first_name: '',
      last_name: '',
      email: '',
      role: isStaffAdmin ? 'staff' : 'employee',
      work_shift: 'day',
      office: '',
      assigned_kitchen: '',
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const [resetModalUser, setResetModalUser] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResettingPassword(true);
    try {
      const response = await adminAPI.resetUserPassword(resetModalUser.id);
      toast.success(
        response.data?.message || `${resetModalUser.username} can now set a new password from the reset page.`
      );
      setResetModalUser(null);
    } catch (err) {
      console.error('Password reset authorisation error:', err);
      toast.error(err.response?.data?.error || 'Failed to authorise the password reset');
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
      toast.error('Could not load password reset requests.');
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
      toast.success(res.data?.message || 'Password reset request approved.');
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
      case 'admin': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'staff_admin': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'staff': return 'bg-cobalt-100 text-cobalt-800 border border-cobalt-200';
      case 'employee': return 'bg-green-100 text-green-800 border border-green-200';
      case 'guest': return 'bg-slate-100 text-slate-800 border border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  // Categorized counts
  const staffAdminsCount = users.filter(u => u.role === 'staff_admin').length;
  const staffCrewCount = users.filter(u => u.role === 'staff').length;
  const regularUsersCount = users.filter(u => u.role === 'employee' || u.role === 'guest').length;
  const employeesCount = users.filter(u => u.role === 'employee').length;
  const guestsCount = users.filter(u => u.role === 'guest').length;

  useEffect(() => {
    if (activeTab === 'deleted') fetchDeletedUsers();
  }, [activeTab, fetchDeletedUsers]);

  const displayedUsers = useMemo(() => {
    let list = filteredUsers;

    // Office Location Filter (for Super Admin)
    if (!isStaffAdmin && selectedOfficeFilter !== 'all') {
      const offId = parseInt(selectedOfficeFilter);
      list = list.filter(u => (u.office === offId || u.office_id === offId));
    }

    if (isStaffAdmin) {
      return list.filter(u => u.role === 'staff');
    }

    if (activeTab === 'staff_admin') {
      return list.filter(u => u.role === 'staff_admin');
    }
    if (activeTab === 'staff_crew' || activeTab === 'staff') {
      return list.filter(u => u.role === 'staff');
    }
    if (activeTab === 'users') {
      if (userSubFilter === 'employee') return list.filter(u => u.role === 'employee');
      if (userSubFilter === 'guest') return list.filter(u => u.role === 'guest');
      return list.filter(u => u.role === 'employee' || u.role === 'guest');
    }
    if (activeTab === 'all') {
      return list;
    }
    return list;
  }, [filteredUsers, isStaffAdmin, selectedOfficeFilter, activeTab, userSubFilter]);

  const handleOpenAddForm = () => {
    let defaultRole = 'employee';
    if (isStaffAdmin || activeTab === 'staff_crew' || activeTab === 'staff') {
      defaultRole = 'staff';
    } else if (activeTab === 'staff_admin') {
      defaultRole = 'staff_admin';
    } else if (activeTab === 'users') {
      defaultRole = userSubFilter === 'guest' ? 'guest' : 'employee';
    }

    let defaultOffice = selectedOfficeFilter !== 'all' ? parseInt(selectedOfficeFilter) : '';
    let defaultKitchen = '';
    if (defaultOffice) {
      const matchK = kitchens.find(k => k.office === defaultOffice);
      if (matchK) defaultKitchen = matchK.id;
    }
    if (isStaffAdmin) {
      const k = currentUser?.active_kitchen || currentUser?.assigned_kitchen;
      if (k) defaultKitchen = k.id || k;
      if (currentUser?.office) defaultOffice = currentUser.office;
    }

    setFormData({
      username: '',
      user_id: '',
      first_name: '',
      last_name: '',
      email: '',
      role: defaultRole,
      work_shift: 'day',
      office: defaultOffice,
      assigned_kitchen: defaultKitchen,
    });
    setEditingUser(null);
    setShowAddForm(true);
  };

  return (
    <div className="flex flex-col h-full">
   <div className="p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {isStaffAdmin 
              ? `Staff Crew — ${currentUser?.assigned_kitchen_name || currentUser?.active_kitchen?.name || 'Kitchen Pass'}` 
              : 'User & Staff Directory'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStaffAdmin 
              ? 'Manage kitchen and service staff crew members assigned strictly to your kitchen' 
              : 'Dedicated management for Staff Admins, Kitchen Crew, and Users segmented by Office'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-none">
          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-9 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Search className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
          </div>

          {!isStaffAdmin && offices.length > 0 && (
            <div className="relative">
              <select
                value={selectedOfficeFilter}
                onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                className="btn-tactile h-full px-3 py-2 text-xs font-bold text-slate-800 bg-white border rounded-xl border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                title="Filter users by office location & kitchen"
              >
                <option value="all">🏢 All Offices & Kitchens</option>
                {offices.map((off) => (
                  <option key={off.id} value={off.id}>
                    📍 {off.name} ({off.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!showAddForm && !editingUser && activeTab !== 'deleted' && (
            <>
              <button
                onClick={() => setShowBulkPanel((prev) => !prev)}
                className="btn-tactile flex items-center px-3.5 py-2 space-x-1.5 text-xs font-semibold text-slate-800 bg-white border rounded-xl border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
              >
                <Upload size={14} />
                <span>Bulk Upload</span>
              </button>
              <button
                onClick={handleOpenAddForm}
                className="btn-tactile flex items-center px-3.5 py-2 space-x-1.5 text-xs font-bold text-white transition-colors rounded-xl bg-primary hover:bg-cobalt-700 shadow-cobalt"
              >
                <Plus size={15} />
                <span>
                  {isStaffAdmin 
                    ? 'Add Staff' 
                    : activeTab === 'staff_admin' 
                    ? 'Add Staff Admin' 
                    : activeTab === 'staff_crew' 
                    ? 'Add Staff Crew' 
                    : 'Add User'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Upload Panel */}
      {showBulkPanel && (
        <BulkUploadPanel
          title={isStaffAdmin ? "Bulk Upload Staff" : "Bulk Upload Users"}
          description={isStaffAdmin ? "Import kitchen and service staff from CSV, JSON, or Excel (.xlsx)." : "Import employees, guests or staff from a CSV, JSON or Excel (.xlsx) file — or paste rows. Existing usernames are updated; new ones are created."}
          templateFilename={isStaffAdmin ? "VDart_Cafe_Staff_Template.csv" : "VDart_Cafe_Users_Template.csv"}
          templateContent={isStaffAdmin ? STAFF_TEMPLATE_CSV : USERS_TEMPLATE_CSV}
          placeholder={'username,user_id,first_name,last_name,email,role,work_shift,monthly_tokens\nemp101,EMP101,Arun,Kumar,arun.kumar@vdart.com,employee,day,\n-- OR JSON / console dump --\n{username: "staff_chef1", user_id: "STF001", role: "staff", work_shift: "day"}'}
          importFn={adminAPI.bulkImportUsers}
          onImported={(data) => {
            const created = data?.created ?? 0;
            const updated = data?.updated ?? 0;
            toast.success(`Users imported — ${created} created, ${updated} updated.`);
            fetchUsers();
          }}
          onClose={() => setShowBulkPanel(false)}
        />
      )}

      {/* Form */}
      {(showAddForm || editingUser) && (
        <UserForm
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
          editingUser={editingUser}
          isStaffAdmin={isStaffAdmin}
          offices={offices}
          kitchens={kitchens}
        />
      )}

      {/* Segmented Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-gray-200">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto">
          {!isStaffAdmin ? (
            <>
              {/* Tab 1: Staff Admin */}
              <button
                onClick={() => setActiveTab('staff_admin')}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === 'staff_admin' ? 'text-indigo-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Staff Admins</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'staff_admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {staffAdminsCount}
                </span>
                {activeTab === 'staff_admin' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 transition-all duration-300"></span>
                )}
              </button>

              {/* Tab 2: Staff Crew */}
              <button
                onClick={() => setActiveTab('staff_crew')}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === 'staff_crew' ? 'text-emerald-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Staff Crew</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'staff_crew' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {staffCrewCount}
                </span>
                {activeTab === 'staff_crew' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 transition-all duration-300"></span>
                )}
              </button>

              {/* Tab 3: Users */}
              <button
                onClick={() => setActiveTab('users')}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === 'users' ? 'text-cobalt-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'users' ? 'bg-cobalt-100 text-cobalt-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {regularUsersCount}
                </span>
                {activeTab === 'users' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cobalt-600 transition-all duration-300"></span>
                )}
              </button>

              {/* Tab 4: All Accounts */}
              <button
                onClick={() => setActiveTab('all')}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === 'all' ? 'text-primary font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All Accounts</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {users.length}
                </span>
                {activeTab === 'all' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-all duration-300"></span>
                )}
              </button>

              {/* Tab 5: Deleted */}
              <button
                onClick={() => setActiveTab('deleted')}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === 'deleted' ? 'text-primary font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Deleted</span>
                {activeTab === 'deleted' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-all duration-300"></span>
                )}
              </button>
            </>
          ) : (
            /* For staff_admin: Strictly Staff Crew only */
            <button
              onClick={() => setActiveTab('staff_crew')}
              className="relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 font-extrabold"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Kitchen Staff Crew</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {staffCrewCount}
              </span>
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600"></span>
            </button>
          )}

          {/* Password Reset Requests */}
          <button
            onClick={() => setActiveTab('requests')}
            className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'requests' ? 'text-primary font-extrabold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Reset Requests</span>
            {pendingRequestsCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cobalt-600 text-white animate-pulse">
                {pendingRequestsCount} pending
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
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

      {/* Sub-filter pill row for Users tab */}
      {!isStaffAdmin && activeTab === 'users' && (
        <div className="flex items-center gap-2 mb-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-1.5 text-xs w-fit">
          <span className="text-[11px] font-bold text-slate-500 uppercase px-2">Role:</span>
          <button
            onClick={() => setUserSubFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors ${
              userSubFilter === 'all'
                ? 'bg-cobalt-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            All Users ({regularUsersCount})
          </button>
          <button
            onClick={() => setUserSubFilter('employee')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors ${
              userSubFilter === 'employee'
                ? 'bg-cobalt-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Employees ({employeesCount})
          </button>
          <button
            onClick={() => setUserSubFilter('guest')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors ${
              userSubFilter === 'guest'
                ? 'bg-cobalt-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Guests ({guestsCount})
          </button>
        </div>
      )}

      {/* RENDER TAB: PASSWORD RESET REQUESTS */}
      {activeTab === 'requests' ? (
        <div className="space-y-4">
          <div className="p-4 bg-cobalt-50/70 border border-cobalt-200/80 rounded-2xl flex items-start space-x-3 text-xs text-cobalt-900">
            <ShieldCheck className="w-5 h-5 text-cobalt-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-cobalt-950 mb-0.5">Password Reset Policy</p>
              <p className="text-cobalt-800">
                When an employee or staff member forgets their password, they submit a request here. When you click <strong>"Approve"</strong>, they receive a single-use permission to set their own new password from the reset page. The password is never shown, stored in plain text, or chosen by an administrator.
              </p>
            </div>
          </div>

          {loadingRequests ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-b-2 rounded-full animate-spin border-primary"></div>
            </div>
          ) : resetRequests.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              art="receipt"
              title="No Password Reset Requests"
              hint="When employees or staff request a password reset, it will appear here for your approval."
            />
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
                      <span className="min-w-0">Email: <strong className="text-slate-800 break-all">{req.user_details?.email || 'N/A'}</strong></span>
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
                          <span>Approve</span>
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
                      req.reset_completed_at ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Password Set
                        </span>
                      ) : req.reset_permission_granted ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          Approved — Awaiting New Password
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approved
                        </span>
                      )
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
      ) : activeTab === 'deleted' ? (
        /* RENDER TAB: DELETED USERS */
        <div className="space-y-4">
          <div className="flex items-start space-x-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="mb-0.5 text-sm font-semibold text-amber-950">Recoverable Accounts</p>
              <p className="text-amber-800">
                Deleted accounts are hidden from the user list but their orders, tokens and transactions are preserved. Restoring an account re-activates it and makes it visible again.
              </p>
            </div>
          </div>

          {loadingDeleted ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-1.5">
                      <div className="skeleton-shimmer h-3.5 w-32 rounded-full" />
                      <div className="skeleton-shimmer h-2.5 w-24 rounded-full" />
                    </div>
                  </div>
                  <div className="skeleton-shimmer h-8 w-24 rounded-xl" />
                </div>
              ))}
            </div>
          ) : deletedUsers.length === 0 ? (
            <EmptyState
              icon={History}
              art="tray"
              title="No Deleted Users"
              hint="Accounts you delete will appear here, so you can restore them if needed."
            />
          ) : (
            <div className="grid gap-4">
              {deletedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <UserCheck className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="group">
                      <p className="text-sm font-semibold text-slate-500 line-through">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-slate-400" title={`@${user.username}`}>
                        @{user.username}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      <Clock className="h-3 w-3" />
                      <span>
                        {user.deleted_at ? `Deleted ${new Date(user.deleted_at).toLocaleDateString()}` : 'Deleted'}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleRestore(user.id)}
                      disabled={restoringId === user.id}
                      className="inline-flex items-center space-x-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
                      title="Restore user"
                    >
                      {restoringId === user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* User List */
        loading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center justify-between p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="skeleton-shimmer h-9 w-9 rounded-full shrink-0" />
                  <div className="space-y-1.5">
                    <div className="skeleton-shimmer h-3.5 w-32 rounded-full" />
                    <div className="skeleton-shimmer h-2.5 w-24 rounded-full" />
                  </div>
                </div>
                <div className="skeleton-shimmer h-8 w-24 rounded-xl" />
              </div>
            ))}
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
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full shrink-0">
                    <UserCheck className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="group">
                     <p className="text-sm font-semibold text-slate-900">
                       {user.first_name} {user.last_name}
                     </p>
                     <p className="text-xs text-slate-500 group-hover:underline" title={`@${user.username}`}>
                       @{user.username}
                     </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                    title={`Role: ${user.role}`}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>

                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    title={`Office: ${user.office_name || 'Main Office'}${user.assigned_kitchen_name ? ` • Kitchen: ${user.assigned_kitchen_name}` : ''}`}
                  >
                    📍 {user.office_name || 'Main Office'}
                  </span>

                  {(user.role === 'staff' || user.role === 'staff_admin') && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                      title={`Kitchen: ${user.assigned_kitchen_name || user.active_kitchen?.name || 'Main Kitchen'}`}
                    >
                      🍳 {user.assigned_kitchen_name || user.active_kitchen?.name || 'Main Kitchen'}
                    </span>
                  )}

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
                 <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">

                  <span
                     className="text-slate-500 truncate max-w-[150px]"
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
                    }}
                    className="p-1 text-cobalt-600 transition-colors hover:text-cobalt-800 hover:bg-cobalt-50 rounded-lg"
                    title="Authorise user to set a new password"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(user)}
                    className="btn-tactile p-1 text-cobalt-600 transition-colors hover:text-cobalt-800 hover:bg-cobalt-50 rounded-lg"
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
            <EmptyState
              art={searchTerm || activeTab !== 'all' ? 'receipt' : 'tray'}
              title="No users found"
              hint={
                searchTerm
                  ? `Nothing matched "${searchTerm}". Try a different name, email or username.`
                  : 'No users in this view yet. Add a user or run a bulk upload to get started.'
              }
            />
          )}
        </div>
        )
      )}

      {/* Admin Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 bg-white border border-slate-100 shadow-2xl rounded-2xl animate-modalIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 text-cobalt-600 bg-cobalt-50 rounded-xl">
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

            <div className="p-3 mb-4 text-xs rounded-xl bg-cobalt-50/80 border border-cobalt-200/80 text-cobalt-900">
              <p>
                <strong>{resetModalUser.username}</strong> will be able to set their own new password from the
                reset page. The permission is single-use and you never see the password they choose.
              </p>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
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
                  disabled={resettingPassword}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-cobalt-600 hover:bg-cobalt-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm shadow-cobalt-500/20"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Authorising...
                    </>
                  ) : (
                    'Authorise Password Reset'
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