import { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/canteen/LoadingFallback';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDefaultRoute } from './utils/routes';

import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

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

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
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
  if (loading && !user) return <LoadingFallback message="Directing to your station…" />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRoute(user.role)} replace />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Suspense fallback={<LoadingFallback message="Plating up…" />}>
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
                <Layout>
                  <NotFound />
                </Layout>
              } />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  </ErrorBoundary>
  );
};

export default App;
