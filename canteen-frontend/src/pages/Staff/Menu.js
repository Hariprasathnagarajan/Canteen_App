import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, Upload, UtensilsCrossed } from 'lucide-react';
import { staffAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import BulkUploadPanel from '../../components/BulkUploadPanel';
import SectionHeading from '../../components/canteen/SectionHeading';
import FoodImage from '../../components/canteen/FoodImage';
import EmptyState from '../../components/canteen/EmptyState';
import MenuSkeleton from '../../components/canteen/MenuSkeleton';
import VegBadge from '../../components/canteen/VegBadge';
import Modal from '../../components/Modal';

const MENU_TEMPLATE_CSV = [
  'name,price,description,category,is_veg,is_available',
  'Filter Coffee,15,Fresh filter coffee,beverage,true,true',
  'Veg Biryani,50,Fragrant veg biryani with raita,meal,true,true',
  'Chicken Biryani,90,Authentic chicken biryani,meal,false,true',
  'Samosa,10,Crispy potato samosa,snack,true,true',
].join('\r\n');

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'meal', label: 'Meals' },
  { key: 'snack', label: 'Snacks' },
  { key: 'beverage', label: 'Beverages' },
];

const VIEW_MODES = [
  { key: 'available', label: 'Available' },
  { key: 'all', label: 'All Dishes' },
];

const getCategory = (item) => item.category || 'meal';

const MenuForm = ({ editingItem, formData, setFormData, handleSubmit, resetForm }) => (
  <Modal
    onClose={resetForm}
    title={editingItem ? 'Edit Dish Details' : 'Add New Dish to Menu'}
    subtitle={editingItem ? `Updating ${editingItem.name}` : 'Dishes added here are immediately live and visible to diners.'}
  >
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

      {/* Veg vs Non-Veg Selection */}
      <div>
        <label className="field-label">Dietary Classification</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, is_veg: true, food_type: 'veg' })}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
              formData.is_veg
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center border-2 border-emerald-600 rounded-[3px] bg-white p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            </span>
            <span>Vegetarian (Veg)</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, is_veg: false, food_type: 'non_veg' })}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
              !formData.is_veg
                ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center border-2 border-rose-600 rounded-[3px] bg-white p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            </span>
            <span>Non-Vegetarian</span>
          </button>
        </div>
      </div>

      {/* Category Selection */}
      <div>
        <label className="field-label">Category</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {CATEGORY_TABS.filter((tab) => tab.key !== 'all').map((tab) => {
            const active = formData.category === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFormData({ ...formData, category: tab.key })}
                className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition ${
                  active
                    ? 'border-cobalt-600 bg-cobalt-50 text-cobalt-800 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div>
          <p className="text-sm font-bold text-ink">Dish Availability Status</p>
          <p className="text-xs text-ink-mute">Toggle right to make this dish live for diners to order immediately.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-black tracking-tight ${formData.is_available ? 'text-emerald-700' : 'text-slate-600'}`}>
            {formData.is_available ? 'Available' : 'Unavailable'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={formData.is_available}
            onClick={() =>
              setFormData({ ...formData, is_available: !formData.is_available })
            }
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer ${
              formData.is_available ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                formData.is_available ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
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
  </Modal>
);

const StaffMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('available');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'meal',
    is_veg: true,
    food_type: 'veg',
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
        price: Number(formData.price),
        is_veg: Boolean(formData.is_veg),
        food_type: formData.is_veg ? 'veg' : 'non_veg'
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
    const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: getCategory(item),
      is_veg: isVeg,
      food_type: isVeg ? 'veg' : 'non_veg',
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
      category: 'meal',
      is_veg: true,
      food_type: 'veg',
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
        category: getCategory(itemToUpdate),
        is_veg: itemToUpdate.is_veg ?? (itemToUpdate.food_type !== 'non_veg'),
        food_type: itemToUpdate.food_type ?? ((itemToUpdate.is_veg ?? true) ? 'veg' : 'non_veg'),
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

  const availableItems = menuItems.filter((item) => item.is_available);
  const scopedItems = viewMode === 'available' ? availableItems : menuItems;
  const isReadOnly = viewMode === 'available';

  const categoryCounts = CATEGORY_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === 'all'
      ? scopedItems.length
      : scopedItems.filter((item) => getCategory(item) === tab.key).length;
    return acc;
  }, {});

  const viewCounts = {
    available: availableItems.length,
    all: menuItems.length,
  };

  const visibleItems = activeCategory === 'all'
    ? scopedItems
    : scopedItems.filter((item) => getCategory(item) === activeCategory);

  return (
    <div className="pb-16 space-y-3">      
      {/* Header and Controls */}
      <SectionHeading
        kicker="Kitchen Catalog"
        title="Menu Management"
        hint={
          viewMode === 'available'
            ? `${availableItems.length} live for diners right now.`
            : 'All dishes and counter availability.'
        }
        right={
          !showAddForm && !editingItem && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowBulkPanel((prev) => !prev)}
                className="btn-tactile flex items-center px-2.5 py-1.5 space-x-1 font-semibold text-slate-800 bg-white border rounded-xl border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors text-xs"
              >
                <Upload size={13} />
                <span>Bulk</span>
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-tactile flex items-center px-2.5 py-1.5 space-x-1 text-white transition-colors rounded-xl bg-cobalt-600 hover:bg-cobalt-700 shadow-cobalt text-xs font-bold"
              >
                <Plus size={13} />
                <span>Add Item</span>
              </button>
            </div>
          )
        }
      />

      {showBulkPanel && (
        <BulkUploadPanel
          title="Bulk Upload Menu Items"
          description="Import dishes from a CSV, JSON, Excel (.xlsx) or Console TXT file — or paste rows. Download the XLSX template, fill it in, and upload it. Existing item names are updated; new ones are created."
          templateFilename="VDart_Cafe_Menu_Template.xlsx"
          templateUrl="/VDart_Cafe_Menu_Template.xlsx"
          templateContent={MENU_TEMPLATE_CSV}
          importFn={staffAPI.bulkImportMenuItems}
          previewTxtFn={staffAPI.previewTxtImport}
          confirmTxtFn={staffAPI.confirmTxtImport}
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

      {!loading && menuItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Top-level view switcher: Available (live) vs All Dishes */}
          <div className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs">
            {VIEW_MODES.map((mode) => {
              const active = viewMode === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    setViewMode(mode.key);
                    if (mode.key === 'available') setActiveCategory('all');
                  }}
                  aria-pressed={active}
                  className={`btn-tactile flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    active ? 'bg-cobalt-600 text-white' : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {mode.key === 'available' && (
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                  )}
                  <span>{mode.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-mono-tokens text-[10px] ${
                    active ? 'bg-cobalt-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {viewCounts[mode.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Category sub-tabs (all-dishes view only) */}
          {viewMode === 'all' && scopedItems.length > 0 && (
            <div className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs">
              {CATEGORY_TABS.map((tab) => {
                const active = activeCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key)}
                    aria-pressed={active}
                    className={`btn-tactile flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      active ? 'bg-slate-900 text-white' : 'text-ink-mute hover:text-ink'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 font-mono-tokens text-[10px] ${
                      active ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {categoryCounts[tab.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
      ) : visibleItems.length === 0 ? (
        viewMode === 'available' ? (
          <EmptyState
            icon={UtensilsCrossed}
            art="tray"
            title="No Available Dishes Right Now"
            hint="Every dish is toggled off for diners. Mark items available to show them here."
            action={
              <button
                onClick={() => setViewMode('all')}
                className="btn-tactile rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-ink-soft hover:bg-slate-50 hover:text-ink"
              >
                Open All Dishes
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            art="tray"
            title={`No ${CATEGORY_TABS.find((t) => t.key === activeCategory)?.label} yet`}
            hint="Add a dish in this category or switch to another tab."
            action={
              <button
                onClick={() => setActiveCategory('all')}
                className="btn-tactile rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-ink-soft hover:bg-slate-50 hover:text-ink"
              >
                View All Dishes
              </button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs hover:border-cobalt-300 transition-all"
            >
              <div>
                <div className="flex items-start gap-2.5">
                  <FoodImage
                    seed={`canteen-${item.id}-${item.name}`}
                    alt={item.name}
                    className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl shadow-2xs"
                    imgClassName="group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <VegBadge isVeg={item.is_veg ?? (item.food_type !== 'non_veg')} size="xs" showLabel={true} />
                      <h3 className="truncate text-xs sm:text-sm font-bold text-ink leading-tight">
                        {item.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md border border-cobalt-200 bg-cobalt-50 px-1.5 py-0.5 font-mono-tokens text-[11px] font-bold text-cobalt-800">
                        {item.price} tk
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        item.is_available 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {item.is_available ? 'Live' : 'Resting'}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                        {CATEGORY_TABS.find((t) => t.key === getCategory(item))?.label || 'Meals'}
                      </span>
                    </div>
                  </div>
                </div>

                {item.description && (
                  <p className="mt-1.5 line-clamp-1 text-[11px] text-ink-mute leading-snug">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                {isReadOnly ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-emerald-500" />
                      Live for diners
                    </span>
                    <button
                      onClick={() => setViewMode('all')}
                      className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-cobalt-50 hover:border-cobalt-300 transition shadow-2xs"
                    >
                      <Edit2 size={12} />
                      <span>Manage</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Actions: Edit & Delete on Left */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(item)}
                        className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-cobalt-50 hover:border-cobalt-300 transition shadow-2xs"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition shadow-2xs"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>

                    {/* Big Availability Toggle on the Right Side */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black tracking-tight ${item.is_available ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.is_available}
                        onClick={() => toggleAvailability(item.id, item.is_available)}
                        title={item.is_available ? 'Click to mark Unavailable' : 'Click to mark Available'}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                          item.is_available ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            item.is_available ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffMenu;