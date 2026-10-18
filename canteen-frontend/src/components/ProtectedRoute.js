import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingFallback from './canteen/LoadingFallback';
import 'react-toastify/dist/ReactToastify.css';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // While checking authentication on cold start with no cached user, show the loader.
  if (loading && !user) {
    return <LoadingFallback message="Verifying your canteen pass…" />;
  }

  // If not authenticated, redirect to the login page.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if the user has the required role.
  const isAuthorized = user && allowedRoles.length > 0 ? allowedRoles.includes(user.role) : true;

  // If not authorized, redirect to the unauthorized page.
  if (!isAuthorized) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If authenticated and authorized, render the child components.
  return typeof children === 'function' ? children({ user }) : children;
};

export default ProtectedRoute;
