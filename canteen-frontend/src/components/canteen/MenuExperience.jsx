import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  CheckCircle2, 
  TriangleAlert, 
  UtensilsCrossed, 
  Hourglass, 
  ArrowRight, 
  Receipt, 
  Check,
  LayoutGrid,
  List,
  CupSoda,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MenuCard, { getItemCategory } from './MenuCard';
import { getFoodLineArt } from './FoodLineIcon';
import CartDock from './CartDock';
import MenuSkeleton from './MenuSkeleton';
import EmptyState from './EmptyState';
import { broadcastOrderEvent } from '../../utils/orderSync';

export default function MenuExperience({ api, serviceNote }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewLayout, setViewLayout] = useState(() => localStorage.getItem('canteen_user_menu_layout') || 'grid');
  const [placing, setPlacing] = useState(false);
  const [placedOrderInfo, setPlacedOrderInfo] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { user, updateUser } = useAuth();
  const searchInputRef = useRef(null);
  const msgTimer = useRef(null);

  const handleToggleLayout = (layout) => {
    setViewLayout(layout);
    localStorage.setItem('canteen_user_menu_layout', layout);
  };

  const showMessage = useCallback((text, type = 'error') => {
    setMessage({ text, type });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage({ text: '', type: '' }), 3500);
  }, []);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [menuRes, userRes] = await Promise.all([
        api.getMenu(),
        api.getProfile().catch(() => null),
      ]);
      if (menuRes?.data) {
        const items = Array.isArray(menuRes.data.results)
          ? menuRes.data.results
          : (Array.isArray(menuRes.data) ? menuRes.data : []);
        setMenuItems(items);
      }
      if (userRes?.data && updateUser) updateUser(userRes.data);
    } catch (err) {
      showMessage('Could not fetch the menu. Check connection.', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [api, updateUser, showMessage]);

  useEffect(() => {
    loadData(true);
    const id = setInterval(() => loadData(false), 20000);
    return () => clearInterval(id);
  }, [loadData]);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dietFilter, setDietFilter] = useState('all');

  // Dynamically compute category tabs from the actual dishes available on the menu
  const categoryTabs = useMemo(() => {
    const map = new Map();
    const priority = { meal: 1, meals: 1, snack: 2, snacks: 2, beverage: 3, beverages: 3 };

    menuItems.forEach((item) => {
      if (!item.is_available) return;
      const lineArt = getFoodLineArt(item);
      const catKey = lineArt.category;
      if (!map.has(catKey)) {
        map.set(catKey, {
          key: catKey,
          label: lineArt.label,
          icon: lineArt.Icon,
          count: 0
        });
      }
      map.get(catKey).count += 1;
    });

    const list = Array.from(map.values()).sort((a, b) => {
      const pA = priority[a.key] || 50;
      const pB = priority[b.key] || 50;
      return pA - pB;
    });

    const totalAvailable = menuItems.filter((i) => i.is_available).length;
    return [
      { key: 'all', label: 'All', icon: null, count: totalAvailable },
      ...list
    ];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let avail = menuItems.filter((i) => i.is_available);
    if (categoryFilter !== 'all') {
      avail = avail.filter((i) => getItemCategory(i) === categoryFilter);
    }
    if (dietFilter === 'veg') {
      avail = avail.filter((i) => (i.is_veg ?? (i.food_type !== 'non_veg')) === true);
    } else if (dietFilter === 'non_veg') {
      avail = avail.filter((i) => (i.is_veg ?? (i.food_type !== 'non_veg')) === false);
    }
    if (!q) return avail;
    return avail.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    );
  }, [searchTerm, menuItems, categoryFilter, dietFilter]);

  const addToCart = (item) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.menu_item_id === item.id);
      if (ex) return prev.map((c) => (c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { menu_item_id: item.id, quantity: 1, item, price: item.price }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.menu_item_id === itemId);
      if (ex?.quantity > 1) return prev.map((c) => (c.menu_item_id === itemId ? { ...c, quantity: c.quantity - 1 } : c));
      return prev.filter((c) => c.menu_item_id !== itemId);
    });
  };

  const qtyOf = (id) => cart.find((c) => c.menu_item_id === id)?.quantity || 0;
  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const count = cart.reduce((s, c) => s + c.quantity, 0);
  const balance = user?.tokens ?? 0;
  const insufficient = total > balance;

  const placeOrder = async () => {
    if (!cart.length || insufficient) {
      if (insufficient) showMessage('Insufficient tokens balance.', 'error');
      return;
    }
    setPlacing(true);
    try {
      const res = await api.placeOrder({ items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) });
      if (res.status === 200 || res.status === 201) {
        await loadData(false);
        const orderData = res.data;
        const currentTotal = total;
        const currentCount = count;
        setCart([]);
        setPlacedOrderInfo({
          id: orderData.id,
          total_tokens: orderData.total_tokens || currentTotal,
          itemsCount: currentCount,
        });

        // Broadcast order placement in real time via WebSockets
        broadcastOrderEvent('order_created', {
          id: orderData.id,
          total_tokens: orderData.total_tokens || currentTotal,
        });

        showMessage('Order placed successfully!', 'success');
      } else throw new Error('Failed to place order');
    } catch (err) {
      showMessage(err.response?.data?.error || err.response?.data?.message || 'Could not place order.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading && menuItems.length === 0) {
    return (
      <div className="space-y-3 pb-16">
        <div className="skeleton-shimmer h-6 w-32 rounded-xl" />
        <MenuSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight">
            Today's Menu
          </h1>
          <p className="text-[11px] text-ink-mute">
            {serviceNote || 'Order dishes using your canteen tokens'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono-tokens text-xs font-bold text-cobalt-800 bg-cobalt-50 px-2 py-1 rounded-lg border border-cobalt-200">
            {balance} tk
          </span>
        </div>
      </div>

      {/* Compact Search Bar */}
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search coffee, meal, snacks…"
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-ink outline-none transition-all placeholder:text-slate-400 focus:border-cobalt-500"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
              className="btn-tactile absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-paper-dark text-ink-mute hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" strokeWidth={2.2} />
            </button>
          )}
        </label>
        <span className="text-[11px] font-bold text-ink-mute whitespace-nowrap bg-white border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
          {filteredItems.length} items
        </span>
      </div>

      {/* Category Tabs: dynamically derived from actual menu dishes (Meals, Snacks, Beverages, etc.) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {categoryTabs.map((tab) => {
          const active = categoryFilter === tab.key;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryFilter(tab.key)}
              className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-cobalt-600 text-white shadow-2xs'
                  : 'border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
              <span>{tab.label}</span>
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono-tokens font-semibold ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Diet Filters & View Mode Switcher */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setDietFilter('all')}
            className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${
              dietFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setDietFilter('veg')}
            className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${
              dietFilter === 'veg'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span className="flex h-3 w-3 items-center justify-center border border-current rounded-[2px] p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            <span>Veg</span>
          </button>
          <button
            type="button"
            onClick={() => setDietFilter('non_veg')}
            className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${
              dietFilter === 'non_veg'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'border border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <span className="flex h-3 w-3 items-center justify-center border border-current rounded-[2px] p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            <span>Non-Veg</span>
          </button>
        </div>

        {/* View Layout Switcher (Grid for mobile & desktop, List for compact rows) */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => handleToggleLayout('grid')}
            title="Grid View (both mobile & desktop)"
            className={`btn-tactile flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              viewLayout === 'grid'
                ? 'bg-cobalt-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-ink'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="text-[11px]">Grid</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLayout('list')}
            title="List View"
            className={`btn-tactile flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              viewLayout === 'list'
                ? 'bg-cobalt-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-ink'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span className="text-[11px]">List</span>
          </button>
        </div>
      </div>

      {/* Compact Alert message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${
              message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'
            }`}
            role={message.type === 'success' ? 'status' : 'alert'}
          >
            {message.type === 'success'
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              : <TriangleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Cards List: Compact & Viewable on Mobile Screen */}
      <AnimatePresence mode="wait">
        {filteredItems.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <EmptyState
              title={searchTerm ? 'No dish matches' : 'Menu is empty'}
              hint={searchTerm ? 'Try a different search term or clear the search.' : 'Dishes will appear once added by staff.'}
              action={searchTerm ? (
                <button onClick={() => setSearchTerm('')} className="btn-tactile rounded-xl bg-cobalt-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cobalt-700">
                  Clear search
                </button>
              ) : null}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`menu-${viewLayout}`}
            layout="position"
            transition={{ layout: { type: 'spring', stiffness: 380, damping: 30 } }}
            className={
              viewLayout === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3'
                : 'grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5'
            }
          >
            <AnimatePresence>
              {filteredItems.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  qty={qtyOf(item.id)}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  variant={viewLayout}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Floating Cart Dock */}
      <CartDock count={count} total={total} balance={balance} placing={placing} insufficient={insufficient} onOrder={placeOrder} />

      {/* Order Placement Success Dialog */}
      <AnimatePresence>
        {placedOrderInfo && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl text-center border border-slate-200"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>

              <h3 className="text-base font-extrabold text-ink">
                Order Placed!
              </h3>
              <p className="mt-0.5 text-xs text-ink-mute">
                Order #{placedOrderInfo.id} placed successfully.
              </p>

              <div className="my-3 rounded-xl border border-slate-200/90 bg-slate-50 p-2.5 space-y-1.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Order Number:</span>
                  <span className="font-mono-tokens font-bold text-ink">#{placedOrderInfo.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-mute">Total Charged:</span>
                  <span className="font-mono-tokens font-bold text-cobalt-700">{placedOrderInfo.total_tokens} tk</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-mute">Items:</span>
                  <span className="font-semibold text-ink">{placedOrderInfo.itemsCount} plates</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setPlacedOrderInfo(null);
                    const role = user?.role || 'employee';
                    navigate(`/${role}/orders`);
                  }}
                  className="btn-tactile w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-cobalt-600 py-2.5 text-xs font-bold text-white hover:bg-cobalt-700 transition"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>View My Orders</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setPlacedOrderInfo(null)}
                  className="btn-tactile w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-ink-mute hover:text-ink hover:bg-slate-50 transition"
                >
                  Order More
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
