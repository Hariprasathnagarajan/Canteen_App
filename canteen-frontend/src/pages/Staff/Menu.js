import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, Upload, UtensilsCrossed, List, LayoutGrid, Check, Search, X, CupSoda, Cookie, RotateCcw, Download, Loader2 } from 'lucide-react';
import { staffAPI, reportsAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import BulkUploadPanel from '../../components/BulkUploadPanel';
import SectionHeading from '../../components/canteen/SectionHeading';
import FoodLineIcon from '../../components/canteen/FoodLineIcon';
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
  { key: 'all', label: 'All', icon: null },
  { key: 'meal', label: 'Meals', icon: UtensilsCrossed },
  { key: 'snack', label: 'Snacks', icon: Cookie },
  { key: 'beverage', label: 'Beverages', icon: CupSoda },
];

const DIET_TABS = [
  { key: 'all', label: 'All Diet' },
  { key: 'veg', label: 'Veg' },
  { key: 'non_veg', label: 'Non-Veg' },
];

const AVAILABILITY_TABS = [
  { key: 'all', label: 'All Dishes' },
  { key: 'available', label: 'Available' },
  { key: 'unavailable', label: 'Out of Stock' },
];

const getCategory = (item) => {
  const cat = (item.category || '').toLowerCase().trim();
  if (cat === 'beverage' || cat === 'drinks' || cat === 'drink' || cat === 'beverages') return 'beverage';
  if (cat === 'snack' || cat === 'snacks') return 'snack';
  if (cat === 'meal' || cat === 'meals') return 'meal';

  const name = (item.name || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const text = `${name} ${desc}`;
  if (['coffee', 'tea', 'juice', 'shake', 'beverage', 'water', 'soda', 'lassi'].some(k => text.includes(k))) return 'beverage';
  if (['snack', 'samosa', 'puff', 'sandwich', 'biscuit', 'cookie', 'chips', 'vada', 'bajji', 'pakoda'].some(k => text.includes(k))) return 'snack';
  return 'meal';
};

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
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${formData.is_veg
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
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${!formData.is_veg
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
                className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition ${active
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
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer ${formData.is_available ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${formData.is_available ? 'translate-x-7' : 'translate-x-1'
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
  const [dietFilter, setDietFilter] = useState('all');
  const [viewMode, setViewMode] = useState('all');
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('canteen_staff_menu_layout') || 'list');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  const handleExportMenu = async (format = 'xlsx') => {
    try {
      setExporting(true);
      await reportsAPI.downloadReportFile({
        format,
        report_type: 'menu',
      });
      toast.success(`Kitchen menu exported successfully (${format.toUpperCase()})!`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to export menu');
    } finally {
      setExporting(false);
    }
  };

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

  const handleToggleLayout = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('canteen_staff_menu_layout', mode);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (items) => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchMarkAvailability = async (markAvailable) => {
    if (selectedIds.size === 0) return;
    const idsToUpdate = Array.from(selectedIds);
    setBatchUpdating(true);
    try {
      await Promise.all(
        idsToUpdate.map(async (id) => {
          const itemToUpdate = menuItems.find((item) => item.id === id);
          if (!itemToUpdate) return;
          const updatePayload = {
            name: itemToUpdate.name,
            description: itemToUpdate.description,
            price: Number(itemToUpdate.price),
            category: getCategory(itemToUpdate),
            is_veg: itemToUpdate.is_veg ?? (itemToUpdate.food_type !== 'non_veg'),
            food_type: itemToUpdate.food_type ?? ((itemToUpdate.is_veg ?? true) ? 'veg' : 'non_veg'),
            is_available: markAvailable,
          };
          return staffAPI.updateMenuItem(id, updatePayload);
        })
      );
      setMenuItems((prev) =>
        prev.map((item) =>
          selectedIds.has(item.id) ? { ...item, is_available: markAvailable } : item
        )
      );
      toast.success(`${idsToUpdate.length} dish(es) marked as ${markAvailable ? 'Available' : 'Unavailable'}`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to update some dishes');
    } finally {
      setBatchUpdating(false);
    }
  };

  const availableItems = useMemo(
    () => menuItems.filter((item) => Boolean(item.is_available)),
    [menuItems]
  );

  const counts = useMemo(() => {
    const cat = { all: menuItems.length, meal: 0, snack: 0, beverage: 0 };
    const diet = { all: menuItems.length, veg: 0, non_veg: 0 };
    const avail = { all: menuItems.length, available: 0, unavailable: 0 };

    menuItems.forEach((item) => {
      const c = getCategory(item);
      cat[c] = (cat[c] || 0) + 1;

      const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');
      if (isVeg) diet.veg += 1;
      else diet.non_veg += 1;

      if (item.is_available) avail.available += 1;
      else avail.unavailable += 1;
    });

    return { cat, diet, avail };
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Availability filter
      if (viewMode === 'available' && !item.is_available) return false;
      if (viewMode === 'unavailable' && item.is_available) return false;

      // Category filter (Meals, Snacks, Beverages)
      if (activeCategory !== 'all' && getCategory(item) !== activeCategory) return false;

      // Dietary filter (Veg, Non-Veg)
      const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');
      if (dietFilter === 'veg' && !isVeg) return false;
      if (dietFilter === 'non_veg' && isVeg) return false;

      // Search query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  }, [menuItems, viewMode, activeCategory, dietFilter, searchQuery]);

  const hasActiveFilters = activeCategory !== 'all' || dietFilter !== 'all' || viewMode !== 'all' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setActiveCategory('all');
    setDietFilter('all');
    setViewMode('all');
    setSearchQuery('');
  };

  return (
    <div className="pb-16 space-y-3">
      {/* Header and Controls */}
      <SectionHeading
        kicker="Menu Catalog"
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
                onClick={() => handleExportMenu('xlsx')}
                disabled={exporting}
                title="Download kitchen menu audit log (.xlsx)"
                className="btn-tactile flex items-center px-2.5 py-1.5 space-x-1 font-semibold text-slate-800 bg-white border rounded-xl border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors text-xs"
              >
                {exporting ? <Loader2 size={13} className="animate-spin text-cobalt-600" /> : <Download size={13} className="text-cobalt-600" />}
                <span>Export</span>
              </button>
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
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs space-y-3">
          {/* Top Row: Category Tabs + Search + Layout Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Category Filter Tabs */}
            <div className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1">
              {CATEGORY_TABS.map((tab) => {
                const active = activeCategory === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key)}
                    aria-pressed={active}
                    className={`btn-tactile flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${active
                        ? 'bg-cobalt-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-ink hover:bg-white/60'
                      }`}
                  >
                    {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono-tokens text-[10px] ${active ? 'bg-cobalt-700 text-white' : 'bg-white text-slate-600 shadow-2xs'
                        }`}
                    >
                      {counts.cat[tab.key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search & Layout Mode Switcher */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter dishes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-ink placeholder:text-slate-400 outline-none focus:bg-white focus:border-cobalt-500 shadow-2xs transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Layout Switcher */}
              <div className="flex items-center rounded-xl bg-slate-100/80 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleLayout('list')}
                  title="List View"
                  className={`btn-tactile flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${layoutMode === 'list'
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-slate-500 hover:text-ink'
                    }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="text-[11px]">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLayout('grid')}
                  title="Grid View"
                  className={`btn-tactile flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${layoutMode === 'grid'
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-slate-500 hover:text-ink'
                    }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subtle separator */}
          <div className="h-px bg-slate-100" />

          {/* Bottom Row: Availability + Diet + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Availability Filter Tabs */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status:</span>
                <div className="inline-flex rounded-xl bg-slate-100/80 p-0.5">
                  {AVAILABILITY_TABS.map((mode) => {
                    const active = viewMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setViewMode(mode.key)}
                        className={`btn-tactile inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${active
                            ? 'bg-white text-ink shadow-2xs'
                            : 'text-slate-500 hover:text-ink'
                          }`}
                      >
                        {mode.key === 'available' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        {mode.key === 'unavailable' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                        <span>{mode.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono-tokens ${active ? 'bg-slate-100 text-slate-700' : 'text-slate-400'
                            }`}
                        >
                          {counts.avail[mode.key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dietary Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Diet:</span>
                <div className="inline-flex rounded-xl bg-slate-100/80 p-0.5">
                  {DIET_TABS.map((tab) => {
                    const active = dietFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setDietFilter(tab.key)}
                        className={`btn-tactile inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${active
                            ? tab.key === 'veg'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : tab.key === 'non_veg'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-white text-ink shadow-2xs'
                            : 'text-slate-500 hover:text-ink'
                          }`}
                      >
                        {tab.key === 'veg' && (
                          <span className="flex h-3 w-3 items-center justify-center border border-current rounded-[2px] p-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                        )}
                        {tab.key === 'non_veg' && (
                          <span className="flex h-3 w-3 items-center justify-center border border-current rounded-[2px] p-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                        )}
                        <span>{tab.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono-tokens ${active
                              ? tab.key === 'all'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-white/20 text-white'
                              : 'text-slate-400'
                            }`}
                        >
                          {counts.diet[tab.key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-2xs transition cursor-pointer"
                  title="Clear all active filters"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Match Counter & Quick Select All button */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Showing <strong className="font-bold text-slate-800">{visibleItems.length}</strong> of {menuItems.length} dishes
              </span>
              {visibleItems.length > 0 && selectedIds.size === 0 && (
                <button
                  type="button"
                  onClick={() => selectAll(visibleItems)}
                  className="btn-tactile rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-ink cursor-pointer"
                  title="Select all currently visible dishes for batch marking"
                >
                  Select All
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-cobalt-200 bg-cobalt-50/90 p-2.5 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cobalt-600 text-white font-mono text-xs font-bold">
                  {selectedIds.size}
                </span>
                <span className="text-xs font-bold text-cobalt-950">
                  {selectedIds.size} dish(es) selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBatchMarkAvailability(true)}
                  disabled={batchUpdating}
                  className="btn-tactile inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
                  title="Mark all selected dishes as available to diners"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Mark Available</span>
                </button>
                <button
                  onClick={() => handleBatchMarkAvailability(false)}
                  disabled={batchUpdating}
                  className="btn-tactile inline-flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
                  title="Mark all selected dishes as out of stock / unavailable"
                >
                  <span>Mark Out of Stock</span>
                </button>
                <button
                  onClick={deselectAll}
                  className="btn-tactile rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Deselect
                </button>
              </div>
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
        <EmptyState
          icon={UtensilsCrossed}
          art="tray"
          title="No matching dishes found"
          hint="Try adjusting your category, veg/non-veg, or availability filters."
          action={
            hasActiveFilters ? (
              <button
                onClick={handleResetFilters}
                className="btn-tactile rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-ink-soft hover:bg-slate-50 hover:text-ink cursor-pointer"
              >
                Reset All Filters
              </button>
            ) : null
          }
        />
      ) : layoutMode === 'list' ? (
        /* LIST VIEW: Easy to Select, Edit, and Mark */
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-paper text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id))}
                      onChange={(e) => (e.target.checked ? selectAll(visibleItems) : deselectAll())}
                      className="h-4 w-4 rounded border-slate-300 text-cobalt-600 focus:ring-cobalt-500 cursor-pointer"
                      title="Select all visible dishes"
                    />
                  </th>
                  <th className="py-3 px-3">Dish</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Mark Availability</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isVeg = item.is_veg ?? (item.food_type !== 'non_veg');
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${isSelected ? 'bg-cobalt-50/50' : 'hover:bg-slate-50/70'
                        }`}
                    >
                      {/* Checkbox for easy select */}
                      <td className="py-2.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-cobalt-600 focus:ring-cobalt-500 cursor-pointer"
                        />
                      </td>

                      {/* Thumbnail + Name + Dietary */}
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="flex items-center gap-2.5">
                          <FoodLineIcon item={item} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <VegBadge isVeg={isVeg} size="xs" showLabel={false} />
                              <span className="truncate font-bold text-ink text-xs sm:text-sm" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            {item.description && (
                              <p className="line-clamp-1 text-[11px] text-ink-mute mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide text-ink-mute">
                          {CATEGORY_TABS.find((t) => t.key === getCategory(item))?.label || 'Meals'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-3 font-mono-tokens font-black text-ink whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-cobalt-200 bg-cobalt-50 px-2 py-0.5 text-xs text-cobalt-800">
                          {item.price} tk
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${item.is_available
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.is_available ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>

                      {/* Instant Toggle for Mark */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.is_available}
                          onClick={() => toggleAvailability(item.id, item.is_available)}
                          title={item.is_available ? 'Click to mark Unavailable' : 'Click to mark Available'}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${item.is_available ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${item.is_available ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </td>

                      {/* Actions: Edit & Delete */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(item)}
                            className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cobalt-700 hover:bg-cobalt-50 hover:border-cobalt-300 transition shadow-2xs"
                            title="Edit dish details"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition shadow-2xs"
                            title="Delete dish"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW: Card Grid Layout with Select, Edit, and Mark */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {visibleItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-2.5 sm:p-3 shadow-2xs transition-all ${isSelected ? 'border-cobalt-500 ring-2 ring-cobalt-200 bg-cobalt-50/20' : 'border-slate-200/80 hover:border-cobalt-300'
                  }`}
              >
                <div>
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox for easy selection */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-cobalt-600 focus:ring-cobalt-500 cursor-pointer"
                      />
                    </div>
                    <FoodLineIcon item={item} size="md" />
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
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.is_available
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

                  {/* Mark toggle */}
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
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${item.is_available ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${item.is_available ? 'translate-x-7' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffMenu;