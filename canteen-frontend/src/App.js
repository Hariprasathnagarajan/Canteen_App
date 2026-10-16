import { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import { Soup } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDefaultRoute } from './utils/routes';

const PAGE_TITLES = {
  '/login': 'Sign In | VDart Cafe',
  '/reset-password': 'Reset Password | VDart Cafe',
  '/unauthorized': 'Access Denied | VDart Cafe',
  '/employee/menu': "Today's Menu | VDart Cafe",
  '/employee/orders': 'My Orders | VDart Cafe',
  '/employee/profile': 'Employee Profile | VDart Cafe',
  '/guest/menu': 'Guest Menu | VDart Cafe',
  '/guest/orders': 'Guest Orders | VDart Cafe',
  '/guest/profile': 'Guest Profile | VDart Cafe',
  '/staff/orders': 'Kitchen Orders | VDart Cafe',
  '/staff/menu': 'Menu Management | VDart Cafe',
  '/staff/profile': 'Staff Profile | VDart Cafe',
  '/admin/dashboard': 'Admin Dashboard | VDart Cafe',
  '/admin/users': 'User Management | VDart Cafe',
  '/admin/tokens': 'Token Allocations | VDart Cafe',
  '/admin/profile': 'Admin Profile | VDart Cafe',
};

const PageTitle = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'VDart Cafe — Canteen Management System';
  }, [location.pathname]);
  return null;
};

import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Unauthorized from './pages/Unauthorized';

import EmployeeMenu from './pages/Employee/Menu';
import EmployeeOrders from './pages/Employee/Orders';
import EmployeeProfile from './pages/Employee/Profile';

import GuestMenu from './pages/Guest/Menu';
import GuestOrders from './pages/Guest/Orders';
import GuestProfile from './pages/Guest/Profile';

import StaffOrders from './pages/Staff/Orders';
import StaffMenu from './pages/Staff/Menu';
import StaffProfile from './pages/Staff/Profile';

import AdminUsers from './pages/Admin/Users';
import AdminTokens from './pages/Admin/Tokens';
import AdminProfile from './pages/Admin/Profile';
import AdminDashboard from './pages/Admin/Dashboard';

const LoadingFallback = () => (
  <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-cream px-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 shadow-diffusion">
      <Soup className="h-7 w-7 animate-floaty text-cream" strokeWidth={2} />
    </div>
    <div className="w-full max-w-xs space-y-2.5">
      <div className="skeleton-shimmer h-3.5 w-full rounded-full" />
      <div className="skeleton-shimmer h-3.5 w-4/5 rounded-full" />
      <div className="skeleton-shimmer h-3.5 w-3/5 rounded-full" />
    </div>
    <p className="font-mono-tokens text-[11px] uppercase tracking-[0.22em] text-ink-mute">Warming up the kitchen…</p>
  </div>
);

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="grain-overlay" />
      {isAuthenticated && <Navbar />}
      <main className="pb-28 pt-4 sm:pt-5 lg:pb-16">
        <div className="mx-auto w-full max-w-[1400px] px-3.5 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      {isAuthenticated && <MobileBottomNav />}
    </div>
  );
};

const RoleBasedRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRoute(user.role)} replace />;
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <PageTitle />
          <ToastContainer
            position="top-right"
            autoClose={1600}
            pauseOnHover={false}
            pauseOnFocusLoss={false}
            hideProgressBar
            closeOnClick
            newestOnTop
            limit={1}
            toastStyle={{ borderRadius: '1rem', fontFamily: 'Outfit, sans-serif' }}
          />
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/unauthorized" element={<Unauthorized />} />

              <Route path="/employee/menu" element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <Layout><EmployeeMenu /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/employee/orders" element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <Layout><EmployeeOrders /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/employee/profile" element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <Layout><EmployeeProfile /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/guest/menu" element={
                <ProtectedRoute allowedRoles={['guest']}>
                  <Layout><GuestMenu /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/guest/orders" element={
                <ProtectedRoute allowedRoles={['guest']}>
                  <Layout><GuestOrders /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/guest/profile" element={
                <ProtectedRoute allowedRoles={['guest']}>
                  <Layout><GuestProfile /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/staff/orders" element={
                <ProtectedRoute allowedRoles={['staff', 'admin']}>
                  <Layout><StaffOrders /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/staff/menu" element={
                <ProtectedRoute allowedRoles={['staff', 'admin']}>
                  <Layout><StaffMenu /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/staff/profile" element={
                <ProtectedRoute allowedRoles={['staff', 'admin']}>
                  <Layout><StaffProfile /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Navigate to="/admin/dashboard" replace />
                </ProtectedRoute>
              } />
              <Route path="/admin/dashboard" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout><AdminDashboard /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout><AdminUsers /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/admin/tokens" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout><AdminTokens /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/admin/profile" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout><AdminProfile /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/" element={<RoleBasedRedirect />} />

              <Route path="*" element={
                <ProtectedRoute>
                  <Layout>
                  <div className="mx-auto max-w-lg py-20 text-center">
                    <p className="font-mono-tokens text-xs uppercase tracking-[0.24em] text-ember-600">Off the menu</p>
                    <h1 className="mt-2 text-6xl font-extrabold tracking-tighter text-ink">404</h1>
                    <p className="mt-2 text-ink-mute">This plate is empty — the page you want is not on today's menu.</p>
                    <Link to="/" className="btn-tactile mt-6 inline-flex items-center rounded-2xl bg-stone-900 px-6 py-3 text-sm font-bold text-cream hover:bg-ember-600">
                      Back to today's menu
                    </Link>
                  </div>
                  </Layout>
                </ProtectedRoute>
              } />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
};

export default App;
