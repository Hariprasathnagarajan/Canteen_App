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
  Flame, 
  Sparkles,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SectionHeading from './SectionHeading';
import TokenPill from './TokenPill';
import MenuCard from './MenuCard';
import CartDock from './CartDock';
import MenuSkeleton from './MenuSkeleton';
import EmptyState from './EmptyState';

export default function MenuExperience({ api, serviceNote }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placedOrderInfo, setPlacedOrderInfo] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { user, updateUser } = useAuth();
  const searchInputRef = useRef(null);
  const msgTimer = useRef(null);

  const showMessage = useCallback((text, type = 'error') => {
    setMessage({ text, type });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage({ text: '', type: '' }), 4500);
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
      showMessage('Could not fetch the menu. Check connection and retry.', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [api, updateUser, showMessage]);

  useEffect(() => {
    loadData(true);
    const id = setInterval(() => loadData(false), 15000);
    return () => clearInterval(id);
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const avail = menuItems.filter((i) => i.is_available);
    if (!q) return avail;
    return avail.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    );
  }, [searchTerm, menuItems]);

  const marqueeItems = useMemo(
    () => menuItems.slice(0, 8).map((i) => i.name),
    [menuItems]
  );

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
      if (insufficient) showMessage('Insufficient tokens for this thali.', 'error');
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
        showMessage('Order fired to the kitchen. See you at the pickup shelf.', 'success');
      } else throw new Error('Failed to place order');
    } catch (err) {
      showMessage(err.response?.data?.error || err.response?.data?.message || 'Could not place order. Try again.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading && menuItems.length === 0) {
    return (
      <div className="space-y-6 pb-28">
        <SectionHeading
          kicker={serviceNote}
          title="Today's menu"
          hint="Plating up… fetching the freshest items from the kitchen."
          right={<div className="hidden sm:block"><TokenPill value={balance} /></div>}
        />
        <MenuSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <SectionHeading
        kicker={serviceNote}
        title="Today's menu"
        hint="Cooked this morning, priced in tokens. Add to your thali and fire the order — no queue, no cash."
        right={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-600" /> Kitchen live
            </span>
            <div className="hidden sm:block">
              <TokenPill value={balance} />
            </div>
          </div>
        }
      />

      {marqueeItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-cobalt-600 py-2 text-white" aria-hidden>
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap px-4">
            {[...marqueeItems, ...marqueeItems].map((n, i) => (
              <span key={i} className="flex items-center gap-8 font-mono-tokens text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                {n} <span className="text-cobalt-300">·</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_280px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Craving something? Try sambar, biryani, curd…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-11 text-xs sm:text-sm text-ink shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-cobalt-500 focus:ring-4 focus:ring-cobalt-500/10"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
              className="btn-tactile absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-paper-dark text-ink-mute hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          )}
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-2 shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper-dark shrink-0">
            <UtensilsCrossed className="h-4 w-4 text-cobalt-700" strokeWidth={2} />
          </span>
          <div className="leading-tight">
            <p className="font-mono-tokens text-base font-bold text-ink">{filteredItems.length}</p>
            <p className="text-[11px] text-ink-mute">dishes available now</p>
          </div>
          <span className="ml-auto font-mono-tokens text-[11px] uppercase tracking-[0.14em] text-ink-mute">
            {count} in thali
          </span>
        </div>
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm font-medium ${
              message.type === 'success' ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'
            }`}
            role={message.type === 'success' ? 'status' : 'alert'}
          >
            {message.type === 'success'
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Search}
          art={searchTerm ? 'receipt' : 'cup'}
          title={searchTerm ? 'Nothing matched that craving' : 'Kitchen is resting'}
          hint={searchTerm ? 'Try a shorter word — sambar, rice, curd — or clear the search to see everything.' : 'No dishes are live right now. Check back at the next service window.'}
          action={searchTerm ? (
            <button onClick={() => setSearchTerm('')} className="btn-tactile rounded-2xl bg-cobalt-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cobalt-700">
              Clear search
            </button>
          ) : (
            <button onClick={() => loadData(true)} className="btn-tactile rounded-2xl bg-cobalt-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cobalt-700">
              Refresh menu
            </button>
          )}
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
              <MenuCard
                key={item.id}
                item={item}
                index={idx}
                qty={qtyOf(item.id)}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CartDock count={count} total={total} balance={balance} placing={placing} insufficient={insufficient} onOrder={placeOrder} />

      {/* Order Placement Success Overlay with Spring Physics */}
      <AnimatePresence>
        {placedOrderInfo && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-success-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ 
                type: 'spring', 
                damping: 20, 
                stiffness: 300,
                mass: 0.8
              }}
              className="relative w-full max-w-sm overflow-hidden rounded-4xl bg-white p-6 shadow-2xl text-center border border-slate-200"
            >
              {/* Floating Success Glow Circle */}
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-800 shadow-lg shadow-emerald-500/20">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.15, damping: 15, stiffness: 260 }}
                >
                  <Check className="h-8 w-8 stroke-[3]" />
                </motion.div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600"></span>
                </span>
              </div>

              <h3 id="order-success-title" className="text-xl font-black tracking-tight text-ink">
                Ticket Fired to Kitchen!
              </h3>
              <p className="mt-1 text-xs text-ink-mute">
                The chefs have received your thali order #{placedOrderInfo.id}.
              </p>

              {/* Order Info Summary Box */}
              <div className="my-5 rounded-2xl border border-slate-200/90 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-mute">Order Number:</span>
                  <span className="font-mono-tokens font-black text-ink text-sm">#{placedOrderInfo.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-mute">Total Charged:</span>
                  <span className="font-mono-tokens font-black text-cobalt-700 text-sm">{placedOrderInfo.total_tokens} tokens</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-mute">Items Count:</span>
                  <span className="font-semibold text-slate-800">{placedOrderInfo.itemsCount} plate{placedOrderInfo.itemsCount === 1 ? '' : 's'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-ink-mute flex items-center gap-1">
                    <Hourglass className="h-3 w-3 text-amber-600" /> Est. Pickup Window:
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[11px]">
                    ~8 - 12 mins
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setPlacedOrderInfo(null);
                    // Navigate to employee or guest orders page
                    const role = user?.role || 'employee';
                    navigate(`/${role}/orders`);
                  }}
                  className="btn-tactile w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-cobalt-600 py-3 text-xs sm:text-sm font-extrabold text-white hover:bg-cobalt-700 transition shadow-sm"
                >
                  <Receipt className="h-4 w-4 text-cobalt-200" />
                  <span>Track Live Ticket Status</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPlacedOrderInfo(null)}
                  className="btn-tactile w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-ink-mute hover:text-ink hover:bg-slate-50 transition"
                >
                  Order More Dishes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
