import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, UtensilsCrossed, UserCheck, User, Loader2, Sunrise, Sunset, MoonStar, RotateCcw, Flame } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SectionHeading from '../../components/canteen/SectionHeading';

const spring = { type: 'spring', stiffness: 120, damping: 20 };

const AdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ staff: 0, menu: 0, employees: 0, guests: 0, newItems: 0 });
  const [shiftData, setShiftData] = useState({
    employees: { day: 0, mid: 0, night: 0, total: 0 },
    guests: { day: 0, mid: 0, night: 0, total: 0 }
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 400));
      const response = await adminAPI.getDashboardStats().catch((err) => {
        throw new Error(`Failed to load dashboard statistics: ${err.message}`);
      });
      if (!response || !response.data) throw new Error('Invalid response from server');
      const d = response.data;

      const proc = (s) => {
        if (!s) return { day: 0, mid: 0, night: 0, total: 0 };
        const total = Object.values(s).reduce((sum, c) => sum + (parseInt(c) || 0), 0);
        return { day: s.day || 0, mid: s.mid || 0, night: s.night || 0, total };
      };
      const sd = d.shiftData || {};
      setShiftData({ employees: proc(sd.employees), guests: proc(sd.guests) });
      setStats({
        staff: d.totalStaff ?? 0,
        menu: d.totalMenuItems ?? 0,
        employees: d.totalEmployees ?? ((d.totalUsers ?? 0) - (d.totalStaff || 0)),
        guests: d.totalGuests ?? 0,
        newItems: d.newItemsThisWeek ?? 0,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load dashboard data', { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeading kicker="Mess overview" title="Good morning" hint="Counting heads, plates and tokens…" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
          {['xl:col-span-5', 'xl:col-span-4', 'xl:col-span-3'].map((span, i) => (
            <div key={i} className={`rounded-5xl border border-stone-200/70 bg-white p-8 shadow-card ${span}`}>
              <div className="skeleton-shimmer h-10 w-10 rounded-2xl" />
              <div className="skeleton-shimmer mt-5 h-8 w-24 rounded-full" />
              <div className="skeleton-shimmer mt-2 h-3 w-40 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: 'Employees fed',
      value: stats.employees,
      sub: `${shiftData.employees.total} across shifts today`,
      Icon: Users,
      span: 'xl:col-span-5',
      dark: true,
      bars: [shiftData.employees.day, shiftData.employees.mid, shiftData.employees.night],
    },
    {
      label: 'Live dishes',
      value: stats.menu,
      sub: stats.newItems > 0 ? `+${stats.newItems} new this week` : 'Menu steady this week',
      Icon: UtensilsCrossed,
      span: 'xl:col-span-4',
      pulse: true,
    },
    {
      label: 'Crew on duty',
      value: stats.staff,
      sub: 'Staff + admins',
      Icon: UserCheck,
      span: 'md:col-span-1 xl:col-span-3',
    },
  ];

  const shiftRows = [
    { label: 'Employees', Icon: Users, data: shiftData.employees, tone: 'bg-ember-500' },
    { label: 'Guests', Icon: User, data: shiftData.guests, tone: 'bg-stone-900' },
  ];
  const maxShift = Math.max(1, shiftData.employees.day, shiftData.employees.mid, shiftData.employees.night, shiftData.guests.day, shiftData.guests.mid, shiftData.guests.night);
  const shiftCols = [
    { key: 'day', label: 'Day', Icon: Sunrise },
    { key: 'mid', label: 'Mid', Icon: Sunset },
    { key: 'night', label: 'Night', Icon: MoonStar },
  ];

  return (
    <div className="space-y-8 pb-10">
      <SectionHeading
        kicker="Mess overview"
        title={`Good day, ${(user?.name || 'Admin').split(' ')[0]}`}
        hint="Heads on seats, dishes live, tokens moving. Everything below updates from the live register."
        right={
          <button onClick={fetchDashboardData} className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-ink-soft shadow-card hover:text-ink">
            <RotateCcw className="h-4 w-4" strokeWidth={2} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.07 }}
            className={c.span}
          >
            <div className={`relative overflow-hidden rounded-5xl p-7 shadow-card ${c.dark ? 'bg-stone-900 text-cream shadow-diffusion' : 'border border-stone-200/70 bg-white text-ink'}`}>
              {c.dark && <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-ember-600/25 blur-3xl" />}
              <div className="flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.dark ? 'bg-white/10 text-amber-200' : 'bg-cream-dark text-ember-700'}`}>
                  <c.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                {c.pulse && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-800">
                    <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-600" /> Live
                  </span>
                )}
              </div>
              <p className={`mt-5 font-mono-tokens text-5xl font-bold tracking-tight ${c.dark ? 'text-cream' : 'text-ink'}`}>{c.value}</p>
              {c.dark && c.bars && (
                <div className="mt-4 flex h-14 items-end gap-2">
                  {[...c.bars, ...c.bars, ...c.bars].slice(0, 14).map((v, bi) => (
                    <motion.span
                      key={bi}
                      initial={{ scaleY: 0.3 }}
                      animate={{ scaleY: [0.4, 1, 0.55] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: bi * 0.12, ease: 'easeInOut' }}
                      className="w-full origin-bottom rounded-full bg-gradient-to-t from-ember-700 to-ember-500"
                      style={{ height: `${28 + ((v + bi * 7) % 72)}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="px-2 pt-2.5">
              <p className="text-sm font-bold text-ink">{c.label}</p>
              <p className="font-mono-tokens text-xs text-ink-mute">{c.sub}</p>
            </div>
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.21 }} className="md:col-span-2 xl:col-span-12">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
            <div className="rounded-5xl border border-stone-200/70 bg-white p-7 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
                  <Flame className="h-5 w-5 text-ember-600" strokeWidth={2} /> Shift-wise plates
                </h2>
                <span className="font-mono-tokens text-xs text-ink-mute">
                  {(shiftData.employees.total + shiftData.guests.total)} heads today
                </span>
              </div>
              <div className="mt-5 space-y-5">
                {shiftRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-bold text-ink">
                        <row.Icon className="h-4 w-4 text-ink-mute" strokeWidth={2} /> {row.label}
                      </span>
                      <span className="font-mono-tokens text-xs font-bold text-ink">{row.data.total} total</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {shiftCols.map((sc) => (
                        <div key={sc.key} className="rounded-2xl bg-cream px-3 py-2.5">
                          <p className="flex items-center gap-1 font-mono-tokens text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                            <sc.Icon className="h-3 w-3" strokeWidth={2} /> {sc.label}
                          </p>
                          <p className="font-mono-tokens text-lg font-bold text-ink">{row.data[sc.key]}</p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(row.data[sc.key] / maxShift) * 100}%` }}
                              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                              className={`h-full rounded-full ${row.tone}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-5xl bg-stone-900 p-7 text-cream shadow-diffusion">
                <p className="font-mono-tokens text-[11px] uppercase tracking-[0.2em] text-stone-400">Guest covers</p>
                <p className="mt-1 font-mono-tokens text-5xl font-bold">{stats.guests}</p>
                <p className="mt-1 text-sm text-stone-400">Day {shiftData.guests.day} · Mid {shiftData.guests.mid} · Night {shiftData.guests.night}</p>
              </div>
              <div className="rounded-5xl border border-stone-200/70 bg-white p-7 shadow-card">
                <p className="font-mono-tokens text-[11px] uppercase tracking-[0.2em] text-ink-mute">Token flow</p>
                <p className="mt-1 font-mono-tokens text-2xl font-bold text-ink">Healthy</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-mute">Declines auto-refund. Watch pending tickets during peak lunch.</p>
                {loading && <Loader2 className="mt-3 h-4 w-4 animate-spin text-ember-600" strokeWidth={2} />}
              </div>
            </div>
          </div>
          <div className="px-2 pt-2.5">
            <p className="text-sm font-bold text-ink">Service distribution</p>
            <p className="font-mono-tokens text-xs text-ink-mute">All counts use tabular numerals and update on refresh.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
