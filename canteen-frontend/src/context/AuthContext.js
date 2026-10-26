import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authAPI, ensureCSRFToken } from '../utils/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDefaultRoute } from '../utils/routes';
import LoadingFallback from '../components/canteen/LoadingFallback';

// Helper to clear auth data
const OUR_COOKIES = ['vcafe_csrftoken', 'csrftoken', 'token', 'auth_token'];

const clearAuthData = () => {
  // Clear ONLY our own cookies — deleting every cookie on the domain would
  // wipe sibling apps' cookies that share `localhost`.
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [name] = cookie.split('=').map(c => c.trim());
    if (name && OUR_COOKIES.includes(name)) {
      document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      document.cookie = `${name}=; Path=/; Domain=${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      document.cookie = `${name}=; Path=/; Domain=.${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    }
  });
  
  // Clear local storage and session storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear indexedDB if used
  if (window.indexedDB) {
    window.indexedDB.databases().then(databases => {
      databases.forEach(db => {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      });
    }).catch(console.error);
  }
  
  // Clear any service worker caches
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    }).catch(console.error);
  }
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Synchronously initialize user and auth state from localStorage to prevent white screens
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return !!localStorage.getItem('user');
    } catch {
      return false;
    }
  });

  // Only start in loading state if we have NO cached user credentials at all
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('user');
    } catch {
      return false;
    }
  });

  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const initialCheckedRef = useRef(false);

  // Check if user is authenticated with backend session
  const checkAuth = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      
      // First ensure we have a CSRF token
      await ensureCSRFToken().catch(() => null);
      
      // Then check if we have a valid session
      const response = await authAPI.getProfile().catch(err => {
        if (err.response?.status === 401) {
          clearAuthData();
        }
        throw err;
      });
      
      const userData = response?.data;
      if (!userData || !userData.id) {
        throw new Error('Invalid profile data');
      }
      
      // Update state with verified user data
      setUser(userData);
      setIsAuthenticated(true);
      
      // Store minimal user data in localStorage for session persistence
      const userToStore = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        name: userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username,
        shift: userData.work_shift || userData.shift,
        tokens: userData.tokens ?? userData.monthly_tokens ?? userData.tokens_remaining ?? 0,
        monthly_tokens: userData.tokens ?? userData.monthly_tokens ?? userData.tokens_remaining ?? 0,
        tokens_remaining: userData.tokens ?? userData.monthly_tokens ?? userData.tokens_remaining ?? 0
      };
      
      localStorage.setItem('user', JSON.stringify(userToStore));
      return userData;
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthData();
        setUser(null);
        setIsAuthenticated(false);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth status ONCE on initial application mount only
  // DO NOT re-run on every location/route change (that caused white screens on every navigation)
  useEffect(() => {
    if (initialCheckedRef.current) return;
    initialCheckedRef.current = true;

    if (location.pathname !== '/login' && location.pathname !== '/reset-password') {
      const hasStoredUser = !!localStorage.getItem('user');
      // If we have a cached user, do silent background re-validation (0ms white screen)
      checkAuth(hasStoredUser);
    } else {
      setLoading(false);
    }
  }, [checkAuth, location.pathname]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure we have a fresh CSRF token
      await ensureCSRFToken().catch(() => null);
      
      // Make the login request
      const loginResponse = await authAPI.login(credentials);
      const activeUser = loginResponse?.data;
      
      if (!activeUser || !activeUser.id) {
        throw new Error('Login failed: Invalid user profile data received from server');
      }
      
      // Store user data in localStorage for immediate session persistence
      const userToStore = {
        id: activeUser.id,
        username: activeUser.username,
        email: activeUser.email,
        role: activeUser.role,
        name: activeUser.name || `${activeUser.first_name || ''} ${activeUser.last_name || ''}`.trim() || activeUser.username,
        shift: activeUser.work_shift || activeUser.shift,
        tokens: activeUser.tokens ?? activeUser.monthly_tokens ?? activeUser.tokens_remaining ?? 0,
        monthly_tokens: activeUser.tokens ?? activeUser.monthly_tokens ?? activeUser.tokens_remaining ?? 0,
        tokens_remaining: activeUser.tokens ?? activeUser.monthly_tokens ?? activeUser.tokens_remaining ?? 0
      };
      
      localStorage.setItem('user', JSON.stringify(userToStore));

      // Update state synchronously
      setUser(activeUser);
      setIsAuthenticated(true);
      setLoading(false);
      
      toast.success(`Welcome back, ${userToStore.name} — kitchen is open.`);
      
      // Redirect based on role
      const redirectPath = location.state?.from?.pathname || getDefaultRoute(activeUser.role);
      navigate(redirectPath, { replace: true });
      
      return { success: true, user: activeUser };
    } catch (error) {
      console.error('Login failed:', error);
      let errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error;

      if (!errorMessage) {
        if (error.response?.status === 404) {
          errorMessage = 'Canteen service is unavailable right now. Please try again in a moment.';
        } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          errorMessage = 'Cannot reach the canteen server. Check your connection and try again in a moment.';
        } else {
          errorMessage = error.message || 'Login failed. Please check your credentials.';
        }
      }

      setError(errorMessage);
      setUser(null);
      setIsAuthenticated(false);
      toast.error(errorMessage);
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      // Attempt to notify server of logout
      try {
        await ensureCSRFToken();
        await authAPI.logout();
      } catch (err) {
        console.warn('Logout API call failed, continuing client cleanup:', err);
      }
    } finally {
      // Always clear auth data and state
      clearAuthData();
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setLoading(false);
      navigate('/login', { replace: true });
      toast.success('Logged out successfully', { autoClose: 1400 });
    }
  };

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const patch = typeof userData === 'function' ? userData(prev) : userData;
      const updated = { ...(prev || {}), ...(patch || {}) };
      try {
        localStorage.setItem('user', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage user:', e);
      }
      return updated;
    });
  }, []);

  const updatePassword = async (passwordData) => {
    try {
      await ensureCSRFToken();
      const response = await authAPI.updatePassword(passwordData);
      return { success: true, data: response.data };
    } catch (err) {
      console.error('Password update error:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to update password';
      return { success: false, error: errorMessage };
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    setUser,
    updateUser,
    updatePassword,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    checkAuth,
  }), [user, isAuthenticated, loading, error, login, logout, checkAuth, updateUser, updatePassword]);

  return (
    <AuthContext.Provider value={contextValue}>
      {loading && !user ? <LoadingFallback message="Verifying session…" /> : children}
    </AuthContext.Provider>
  );
};
