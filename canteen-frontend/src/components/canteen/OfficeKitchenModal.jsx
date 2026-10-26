import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  UtensilsCrossed, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Users, 
  ChefHat, 
  Save, 
  RefreshCw 
} from 'lucide-react';
import { adminAPI } from '../../utils/api';
import Modal from '../Modal';
import { toast } from 'react-toastify';

export default function OfficeKitchenModal({ isOpen, onClose, onOfficeUpdated }) {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOffice, setEditingOffice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
  });

  const loadOffices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getOffices();
      const list = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);
      setOffices(list);
    } catch (err) {
      console.error('Failed to load offices:', err);
      toast.error('Could not load offices list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadOffices();
      setShowAddForm(false);
      setEditingOffice(null);
    }
  }, [isOpen, loadOffices]);

  const resetForm = () => {
    setFormData({ name: '', code: '', location: '' });
    setShowAddForm(false);
    setEditingOffice(null);
  };

  const handleStartEdit = (office) => {
    setEditingOffice(office);
    setFormData({
      name: office.name,
      code: office.code,
      location: office.location || '',
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Office name and code are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingOffice) {
        await adminAPI.updateOffice(editingOffice.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          location: formData.location.trim(),
        });
        toast.success(`Office "${formData.name}" updated successfully.`);
      } else {
        await adminAPI.createOffice({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          location: formData.location.trim(),
        });
        toast.success(`Office "${formData.name}" and paired Kitchen created!`);
      }
      resetForm();
      loadOffices();
      if (onOfficeUpdated) onOfficeUpdated();
    } catch (err) {
      console.error('Error saving office:', err);
      const msg = err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || err.response?.data?.error || 'Failed to save office.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (office) => {
    const action = office.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${office.name}?`)) return;

    try {
      await adminAPI.updateOffice(office.id, { is_active: !office.is_active });
      toast.success(`${office.name} ${action}d.`);
      loadOffices();
      if (onOfficeUpdated) onOfficeUpdated();
    } catch (err) {
      toast.error(`Could not ${action} office.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Office Locations & Kitchens"
      subtitle="Manage corporate office branches. When an office is created, its dedicated kitchen is automatically generated."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-700">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-ink">Total Locations: {offices.length}</p>
              <p className="text-[11px] text-ink-mute">1-to-1 Kitchen binding active</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOffices}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-ink-mute hover:text-ink hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (showAddForm) resetForm();
                else setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{showAddForm ? 'Cancel' : 'Add Office'}</span>
            </button>
          </div>
        </div>

        {/* Create / Edit Office Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-cobalt-200/80 bg-cobalt-50/50 p-4 space-y-3.5 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cobalt-950 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-cobalt-700" />
                  {editingOffice ? `Edit Office: ${editingOffice.name}` : 'Create New Office Location'}
                </h4>
                <span className="text-[10px] font-mono font-medium text-cobalt-700 bg-cobalt-100/80 px-2 py-0.5 rounded-full">
                  Auto-creates Kitchen
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Office Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trichy Campus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cobalt-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Location Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. TRZ or HQ"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cobalt-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Address / Building Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IT Park, Phase 2, Floor 3"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cobalt-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cobalt-600 hover:bg-cobalt-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{editingOffice ? 'Save Changes' : 'Create Office & Kitchen'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Office & Kitchen Cards Grid */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-cobalt-600" />
            <p className="text-xs text-ink-mute">Loading office locations…</p>
          </div>
        ) : offices.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <Building2 className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Offices Configured</p>
            <p className="text-xs text-slate-500 mt-1">Click "Add Office" above to create your first office location.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
            {offices.map((office) => (
              <div
                key={office.id}
                className={`rounded-2xl border p-4 space-y-3 transition-shadow hover:shadow-sm ${
                  office.is_active ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-slate-200/60 opacity-75'
                }`}
              >
                {/* Office Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cobalt-600 text-white font-bold text-xs shadow-sm">
                      {office.code}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-ink leading-tight flex items-center gap-1.5">
                        {office.name}
                        {!office.is_active && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-ink-mute flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[180px]">{office.location || 'Location details not specified'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(office)}
                      className="p-1.5 text-slate-500 hover:text-cobalt-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit office"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(office)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        office.is_active 
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={office.is_active ? 'Deactivate location' : 'Activate location'}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Paired Kitchen Banner */}
                <div className="rounded-xl border border-leaf-600/20 bg-leaf-50/60 p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-leaf-700 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-800 block">
                        Paired Kitchen
                      </span>
                      <span className="font-semibold text-leaf-950 text-xs">
                        {office.kitchen_name || `${office.name} Kitchen`}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-leaf-800 bg-leaf-100/80 px-2 py-0.5 rounded-full">
                    {office.menu_item_count ?? 0} dishes
                  </span>
                </div>

                {/* Office Metrics Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-slate-400" />
                    <strong>{office.user_count ?? 0}</strong> assigned diners
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    ID #{office.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
