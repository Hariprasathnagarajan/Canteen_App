import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, fetchCSRFToken, ensureCSRFToken } from '../utils/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDefaultRoute } from '../utils/routes';

// Helper to clear auth data
const clearAuthData = () => {
  // Clear all cookies by setting them to expire in the past
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [name] = cookie.split('=').map(c => c.trim());
    if (name) {
      // Clear cookie by setting it to expire in the past
      document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      // Also clear for subdomains if applicable
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
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is authenticated
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First ensure we have a CSRF token
      await ensureCSRFToken();
      
      // Then check if we have a valid session
      const response = await authAPI.getProfile().catch(err => {
        // Clear auth data if we get a 401
        if (err.response?.status === 401) {
          clearAuthData();
        }
        throw err;
      });
      
      const userData = response?.data;
      if (!userData || !userData.id) {
        throw new Error('Invalid profile data');
      }
      
      // Update state with user data
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
      console.error('Auth check failed:', error);
      
      // Try to get user from localStorage as fallback for offline mode
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Only use stored user if we're not getting auth errors
          if (error.response?.status !== 401 && parsedUser?.id) {
            setUser(parsedUser);
            setIsAuthenticated(true);
            return parsedUser;
          }
        } catch (parseError) {
          console.error('Failed to parse stored user:', parseError);
          clearAuthData();
        }
      }
      
      // Clear auth state
      setUser(null);
      setIsAuthenticated(false);
      
      // Clear any invalid tokens on auth errors
      if (error.response?.status === 401) {
        clearAuthData();
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth status on initial load and when location changes
  useEffect(() => {
    if (location.pathname !== '/login') {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [location, checkAuth]);

  // Initial auth check on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure we have a fresh CSRF token
      await ensureCSRFToken();
      
      // Make the login request
      const loginResponse = await authAPI.login(credentials);
      const userFromLogin = loginResponse?.data;
      
      // Attempt to refresh profile with active session
      let userData = null;
      try {
        userData = await checkAuth();
      } catch (err) {
        console.warn('Profile fetch after login encountered an error, falling back to login response:', err);
      }
      
      const activeUser = userData || userFromLogin;
      if (!activeUser || !activeUser.id) {
        throw new Error('Login failed: Invalid user profile data received from server');
      }
      
      // Update auth state
      setUser(activeUser);
      setIsAuthenticated(true);
      
      // Store user data in localStorage for session persistence
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
      
      // Show success message
      toast.success(`Welcome back, ${userToStore.name}!`);
      
      // Redirect based on role
      const redirectPath = location.state?.from?.pathname || getDefaultRoute(activeUser.role);
      
      navigate(redirectPath, { replace: true });
      
      return { success: true, user: activeUser };
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Login failed. Please check your credentials.';
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
      const updated = { ...(prev || {}), ...(userData || {}) };
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
  const contextValue = {
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
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
