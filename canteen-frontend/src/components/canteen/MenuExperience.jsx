import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, CheckCircle2, TriangleAlert, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SectionHeading from './SectionHeading';
import TokenPill from './TokenPill';
import MenuCard from './MenuCard';
import CartDock from './CartDock';
import MenuSkeleton from './MenuSkeleton';
import EmptyState from './EmptyState';

export default function MenuExperience({ api, serviceNote }) {
  const [menuItems, setMenuItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
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
        api.getMenu().catch(() => null),
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
    () => (menuItems.length ? menuItems.slice(0, 8).map((i) => i.name) : ['Sambar sadham', 'Curd rice', 'Lemon rice', 'Veg biryani', 'Rasam', 'Kootu', 'Poriyal', 'Buttermilk']),
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
        setCart([]);
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
          right={<TokenPill value={balance} />}
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
            <TokenPill value={balance} />
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-900 py-2 text-cream" aria-hidden>
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap px-4">
          {[...marqueeItems, ...marqueeItems].map((n, i) => (
            <span key={i} className="flex items-center gap-8 font-mono-tokens text-xs font-medium uppercase tracking-[0.2em] text-stone-300">
              {n} <span className="text-ember-500">·</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-mute" strokeWidth={2} />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Craving something? Try sambar, biryani, curd…"
            className="w-full rounded-2xl border border-stone-200 bg-white py-3.5 pl-12 pr-12 text-[15px] text-ink shadow-card outline-none transition-all placeholder:text-stone-400 focus:border-ember-500 focus:ring-4 focus:ring-ember-500/10"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
              className="btn-tactile absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-cream-dark text-ink-mute hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          )}
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-dark">
            <UtensilsCrossed className="h-5 w-5 text-ember-700" strokeWidth={2} />
          </span>
          <div className="leading-tight">
            <p className="font-mono-tokens text-lg font-bold text-ink">{filteredItems.length}</p>
            <p className="text-xs text-ink-mute">dishes available now</p>
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
          title={searchTerm ? 'Nothing matched that craving' : 'Kitchen is resting'}
          hint={searchTerm ? 'Try a shorter word — sambar, rice, curd — or clear the search to see everything.' : 'No dishes are live right now. Check back at the next service window.'}
          action={searchTerm ? (
            <button onClick={() => setSearchTerm('')} className="btn-tactile rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-cream hover:bg-ember-600">
              Clear search
            </button>
          ) : (
            <button onClick={() => loadData(true)} className="btn-tactile rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-cream hover:bg-ember-600">
              Refresh menu
            </button>
          )}
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
              <MenuCard
                key={item.id}
                item={item}
                index={idx}
                qty={qtyOf(item.id)}
                onAdd={addToCart}
                onRemove={removeFromCart}
                featured={idx === 0 && filteredItems.length > 3}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CartDock count={count} total={total} balance={balance} placing={placing} insufficient={insufficient} onOrder={placeOrder} />
    </div>
  );
}
