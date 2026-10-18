import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, Upload, UtensilsCrossed } from 'lucide-react';
import { staffAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import BulkUploadPanel from '../../components/BulkUploadPanel';
import SectionHeading from '../../components/canteen/SectionHeading';
import FoodImage from '../../components/canteen/FoodImage';
import EmptyState from '../../components/canteen/EmptyState';
import MenuSkeleton from '../../components/canteen/MenuSkeleton';

const MENU_TEMPLATE_CSV = [
  'name,price,description,category,is_available',
  'Filter Coffee,15,Fresh filter coffee,beverage,true',
  'Veg Biryani,50,Fragrant veg biryani with raita,meal,true',
  'Samosa,10,Crispy potato samosa,snack,true',
].join('\r\n');

const MenuForm = ({ editingItem, formData, setFormData, handleSubmit, resetForm }) => (
  <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card">
    <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
      <div>
        <h3 className="text-lg font-bold text-ink">
          {editingItem ? 'Edit Dish Details' : 'Add New Dish to Menu'}
        </h3>
        <p className="text-xs text-ink-mute mt-0.5">
          {editingItem ? `Updating ${editingItem.name}` : 'Dishes added here are immediately live and visible to diners.'}
        </p>
      </div>
      <button
        type="button"
        onClick={resetForm}
        aria-label="Close form"
        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
      >
        <X size={18} />
      </button>
    </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="field-label">Item Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. South Indian Filter Coffee"
          className="field-input"
        />
      </div>
      
      <div>
        <label className="field-label">Description</label>
        <textarea
          rows={3}
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief culinary note or ingredients..."
          className="field-input resize-none"
        />
      </div>
      
      <div>
        <label className="field-label">Price (Tokens)</label>
        <input
          type="number"
          required
          min="1"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          placeholder="e.g. 15"
          className="field-input font-mono-tokens font-bold"
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
        <div>
          <p className="text-xs font-bold text-ink">Available for ordering</p>
          <p className="text-[11px] text-ink-mute">When disabled, this dish cannot be added to customer thalis.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={formData.is_available}
          onClick={() =>
            setFormData({ ...formData, is_available: !formData.is_available })
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            formData.is_available ? 'bg-cobalt-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              formData.is_available ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      
      <div className="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onClick={resetForm}
          className="btn-tactile rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-ink-soft hover:bg-slate-50 hover:text-ink transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 shadow-cobalt transition"
        >
          <Save size={15} />
          <span>{editingItem ? 'Save Changes' : 'Publish Dish'}</span>
        </button>
      </div>
    </form>
  </div>
);

const StaffMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_available: true
  });

  const fetchMenu = useCallback(async () => {
    try {
      const response = await staffAPI.getMenu();
      setMenuItems(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('Could not load the menu. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price)
      };

      if (editingItem) {
        await staffAPI.updateMenuItem(editingItem.id, payload);
        setMenuItems(menuItems.map(item => 
          item.id === editingItem.id ? { ...item, ...payload } : item
        ));
        setEditingItem(null);
        toast.success('Menu item updated successfully');
      } else {
        const response = await staffAPI.createMenuItem(payload);
        setMenuItems([response.data, ...menuItems]);
        setShowAddForm(false);
        toast.success('Menu item added successfully');
      }
      resetForm();
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Error saving menu item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      is_available: item.is_available
    });
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await staffAPI.deleteMenuItem(id);
        setMenuItems(menuItems.filter(item => item.id !== id));
        toast.success('Menu item deleted');
      } catch (error) {
        console.error('Error deleting menu item:', error);
        toast.error('Failed to delete menu item');
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      is_available: true
    });
    setEditingItem(null);
    setShowAddForm(false);
  };

  const toggleAvailability = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      // Find the complete menu item
      const itemToUpdate = menuItems.find(item => item.id === id);
      if (!itemToUpdate) return;

      // Prepare the update payload with all required fields
      const updatePayload = {
        name: itemToUpdate.name,
        description: itemToUpdate.description,
        price: Number(itemToUpdate.price),
        is_available: newStatus
      };

      await staffAPI.updateMenuItem(id, updatePayload);
      
      // Update local state
      setMenuItems(menuItems.map(item =>
        item.id === id ? { ...item, is_available: newStatus } : item
      ));
      toast.success(`"${itemToUpdate.name}" is now ${newStatus ? 'available' : 'unavailable'}`);
    } catch (error) {
      console.error('Error updating availability:', error);
      // Revert UI if API call fails
      setMenuItems(menuItems.map(item =>
        item.id === id ? { ...item, is_available: currentStatus } : item
      ));
      toast.error('Failed to update item availability');
    }
  };

  return (
    <div className="pb-16 space-y-6">      
      {/* Header and Controls */}
      <SectionHeading
        kicker="Kitchen Catalog · Live Menu Control"
        title="Menu Management"
        hint="Live dishes, daily token prices, and counter availability for employees and guests."
        right={
          !showAddForm && !editingItem && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkPanel((prev) => !prev)}
                className="btn-tactile flex items-center px-4 py-2.5 space-x-2 font-semibold text-slate-800 bg-white border rounded-2xl border-slate-200 hover:bg-slate-50 shadow-sm transition-colors text-xs sm:text-sm"
              >
                <Upload size={16} />
                <span>Bulk Upload</span>
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-tactile flex items-center px-4 py-2.5 space-x-2 text-white transition-colors rounded-2xl bg-cobalt-600 hover:bg-cobalt-700 shadow-cobalt text-xs sm:text-sm font-bold"
              >
                <Plus size={16} />
                <span>Add Item</span>
              </button>
            </div>
          )
        }
      />

      {showBulkPanel && (
        <BulkUploadPanel
          title="Bulk Upload Menu Items"
          description="Import dishes from a CSV, JSON or Excel (.xlsx) file — or paste rows. Existing item names are updated; new ones are created."
          templateFilename="VDart_Cafe_Menu_Template.csv"
          templateContent={MENU_TEMPLATE_CSV}
          importFn={staffAPI.bulkImportMenuItems}
          onImported={(data) => {
            const created = data?.created ?? 0;
            const updated = data?.updated ?? 0;
            toast.success(`Menu imported — ${created} created, ${updated} updated.`);
            fetchMenu();
          }}
          onClose={() => setShowBulkPanel(false)}
        />
      )}

      {(showAddForm || editingItem) && (
        <MenuForm
          editingItem={editingItem}
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
        />
      )}

      {loading ? (
        <MenuSkeleton count={6} />
      ) : menuItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          art="tray"
          title="No Dishes in Catalog"
          hint="Start by adding today's dishes manually or import a batch via CSV."
          action={
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-tactile rounded-2xl bg-cobalt-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 shadow-cobalt"
            >
              Add First Dish
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="spotlight-card group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card hover:border-cobalt-300 transition-all duration-200"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <FoodImage
                    seed={`canteen-${item.id}-${item.name}`}
                    alt={item.name}
                    className="h-16 w-16 shrink-0 rounded-2xl shadow-2xs"
                    imgClassName="group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-ink leading-tight group-hover:text-cobalt-900 transition-colors">
                      {item.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-cobalt-200 bg-cobalt-50 px-2 py-0.5 font-mono-tokens text-xs font-bold text-cobalt-800">
                        {item.price} tk
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.is_available 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.is_available ? 'bg-emerald-500 animate-breathe' : 'bg-slate-400'}`} />
                        {item.is_available ? 'Live on pass' : 'Resting'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-ink-mute leading-relaxed">
                  {item.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                {/* Availability Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.is_available}
                    onClick={() => toggleAvailability(item.id, item.is_available)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      item.is_available ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                    title={item.is_available ? 'Click to pause dish' : 'Click to activate dish'}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        item.is_available ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold text-ink-mute">
                    {item.is_available ? 'Available' : 'Paused'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(item)}
                    className="btn-tactile inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-cobalt-50 hover:text-cobalt-800 transition"
                    title="Edit dish details"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="btn-tactile inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                    title="Delete dish"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffMenu;