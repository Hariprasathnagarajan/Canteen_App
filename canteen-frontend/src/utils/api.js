import axios from 'axios';
import { getCSRFToken as getCSRFTokenFromCookie, ensureCSRFCookie, refreshCSRFToken, CSRF_COOKIE_NAME } from './cookies';

// Determine and normalize API_BASE_URL safely
const resolveApiBaseUrl = () => {
  let url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    || (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
    || 'https://canteen-app-l261.onrender.com/api';

  // If running on Netlify and url is relative /api or missing, direct to Render production backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('netlify.app')) {
    if (!url || url === '/api' || !url.startsWith('http')) {
      url = 'https://canteen-app-l261.onrender.com/api';
    }
  }

  // Remove trailing slashes
  url = url.trim().replace(/\/+$/, '');

  // Ensure /api suffix is present on absolute HTTP URLs
  if (url.startsWith('http') && !url.endsWith('/api')) {
    url = `${url}/api`;
  }

  return url;
};

export const API_BASE_URL = resolveApiBaseUrl();

// Initialize API instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
    xsrfCookieName: CSRF_COOKIE_NAME,
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Track if we're initializing to prevent multiple simultaneous initializations
let isInitializing = false;

// Ensure we have a CSRF token
export const ensureCSRFToken = async () => {
  if (isInitializing) {
    // If we're already initializing, wait for it to complete
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (!isInitializing) {
          resolve(getCSRFTokenFromCookie());
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  isInitializing = true;
  
  try {
    const token = await ensureCSRFCookie(api);
    isInitializing = false;
    return token;
  } catch (error) {
    console.error('Failed to ensure CSRF token:', error);
    isInitializing = false;
    throw error;
  }
};

// Initialize the API with CSRF token
export const initializeAPI = async () => {
  try {
    const token = await ensureCSRFToken();
    return token;
  } catch (error) {
    console.error('Failed to initialize API:', error);
    throw error;
  }
};

// Call initialize on import
initializeAPI().catch(console.error);

// Request interceptor to handle CSRF tokens
api.interceptors.request.use(
  async (config) => {
    // Skip for requests that don't need CSRF
    if (['get', 'head', 'options'].includes(config.method?.toLowerCase())) {
      return config;
    }

    try {
      // Ensure we have a valid CSRF token
      const token = getCSRFTokenFromCookie() || await ensureCSRFToken();
      if (token) {
        config.headers['X-CSRFToken'] = token;
      }
    } catch (error) {
      console.warn('CSRF token not available, continuing with request', error);
    }

    // Ensure credentials are included
    config.withCredentials = true;
    
    // Add necessary headers
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Detect a CSRF-validation failure (Django returns 403, DRF can surface 400).
const isCSRFError = (err) => {
  const status = err.response?.status;
  if (status !== 403 && status !== 400) return false;
  const blob = JSON.stringify(err.response?.data || '').toLowerCase();
  return blob.includes('csrf');
};

// Response interceptor — unified handler for CSRF refresh and session expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle a CSRF failure: force-refresh the token once, then retry.
    // (Forced refresh — ensureCSRFToken would short-circuit on the same stale token.)
    if (isCSRFError(error) && originalRequest && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      try {
        await refreshCSRFToken(api);
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Failed to refresh CSRF token:', refreshError);
        if (window.location.pathname !== '/login') {
          const hadSession = !!localStorage.getItem('user');
          localStorage.removeItem('user');
          window.location.href = hadSession ? '/login?reason=expired' : '/login';
        }
      }
    }

    // Handle 401 Unauthorized — clear stored user and redirect to login
    if (error.response?.status === 401) {
      const isLoginAttempt = originalRequest?.url?.includes('/login/');
      const hadSession = !!localStorage.getItem('user');
      localStorage.removeItem('user');
      if (!isLoginAttempt && !window.location.pathname.includes('/login')) {
        window.location.href = hadSession ? '/login?reason=expired' : '/login';
      }
    }

    return Promise.reject(error);
  }
);


// CSRF fetcher
export const fetchCSRFToken = () => api.get('/csrf/');

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/login/', credentials, {
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }),
  
  logout: () => {
    // Create a separate axios instance for logout to avoid circular dependencies
    const logoutApi = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    
    // Add CSRF token to the request
    const csrfToken = getCSRFTokenFromCookie();
    if (csrfToken) {
      logoutApi.defaults.headers.common['X-CSRFToken'] = csrfToken;
    }
    
    return logoutApi.post('/logout/');
  },
  
  getProfile: () => api.get('/profile/'),
  
  updatePassword: (passwordData) => api.post('/update_password/', passwordData, {
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }),
  
  resetPassword: (resetData) => api.post('/password_reset/', resetData, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }),

  requestPasswordReset: (requestData) => api.post('/password_reset/request/', requestData, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }),

  checkPasswordResetStatus: (identifier) => api.get(`/password_reset/status/?identifier=${encodeURIComponent(identifier)}`),
};

// Employee API
export const employeeAPI = {
  getMenu: () => api.get('/employee/menu/'),
  placeOrder: (orderData) => api.post('/employee/order/', orderData),
  getOrders: () => api.get('/employee/orders/'),
  getOrderReceipt: (orderId) => api.get(`/orders/${orderId}/receipt/`),
  getProfile: () => api.get('/profile/'),
};

// Guest API
export const guestAPI = {
  getMenu: () => api.get('/guest/menu/'),
  placeOrder: (orderData) => api.post('/guest/order/', orderData),
  getOrders: () => api.get('/guest/orders/'),
  getOrderReceipt: (orderId) => api.get(`/orders/${orderId}/receipt/`),
  getProfile: () => api.get('/profile/'),
};


// Shared payload builder for bulk imports (file upload or pasted text)
const buildBulkPayload = ({ file = null, text = '', format = '' }) => {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  }
  return { text, format };
};

// Staff API
export const staffAPI = {
  getMenu: () => api.get('/staff/menu/'),
  createMenuItem: (data) => api.post('/staff/menu/', data),
  updateMenuItem: (id, data) => api.put(`/staff/menu/${id}/`, data),
  deleteMenuItem: (id) => api.delete(`/staff/menu/${id}/`),
  bulkImportMenuItems: async ({ file = null, text = '', format = '' } = {}) => {
    const response = await api.post('/staff/menu/bulk-import/', buildBulkPayload({ file, text, format }));
    return response;
  },
  getOrders: (params = '') => {
    if (typeof params === 'string') {
      return api.get(`/staff/orders/${params ? `?search=${encodeURIComponent(params)}` : ''}`);
    }
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status && params.status !== 'all') q.append('status', params.status);
    if (params?.category && params.category !== 'all') q.append('category', params.category);
    const qs = q.toString();
    return api.get(`/staff/orders/${qs ? `?${qs}` : ''}`);
  },
  getLiveFeed: (sinceId = null) =>
    api.get(`/staff/orders/live_feed/${sinceId ? `?since_id=${sinceId}` : ''}`),
  getOrderReceipt: (orderId) => api.get(`/orders/${orderId}/receipt/`),
  updateOrderStatus: (orderId, status) =>
    api.patch(`/staff/orders/${orderId}/update_status/`, { status }),
};

// Admin API
export const adminAPI = {
  // User Management
  getUsers: async () => {
    const response = await api.get('/admin/users/');
    return response;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/admin/users/', userData);
    return response;
  },
  
  updateUser: async (userId, userData) => {
    const response = await api.put(`/admin/users/${userId}/`, userData);
    return response;
  },
  
  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}/`);
    return response;
  },
  
  resetUserPassword: async (userId, data = {}) => {
    const response = await api.post(`/admin/users/${userId}/reset-password/`, data);
    return response;
  },

  getPasswordResetRequests: async () => {
    const response = await api.get('/admin/password-resets/');
    return response;
  },

  approvePasswordReset: async (requestId) => {
    const response = await api.post(`/admin/password-resets/${requestId}/approve/`);
    return response;
  },

  rejectPasswordReset: async (requestId, data = {}) => {
    const response = await api.post(`/admin/password-resets/${requestId}/reject/`, data);
    return response;
  },
  
  // Token Management

  assignTokens: async (shift, tokens = null) => {
    const endpoint = '/admin/tokens/assign/';
    try {
      // Normalize _shift suffix to match backend expectations
      const normalizedShift = typeof shift === 'string' ? shift.replace(/_shift$/, '') : shift;
      const payload = { shift: normalizedShift };
      if (tokens !== null && tokens !== undefined && !isNaN(Number(tokens))) {
        payload.tokens = Number(tokens);
      }
      return await api.post(endpoint, payload);
    } catch (error) {
      console.error(`[API] Error assigning tokens for ${shift} shift:`, error.response?.data || error.message);
      throw error;
    }
  },

  assignAllTokens: async (tokensByShift) => {
    try {
      return await api.post('/admin/tokens/assign/', { shift: 'all', tokens: tokensByShift });
    } catch (error) {
      console.error('[API] Error in bulk token assignment:', error.response?.data || error.message);
      throw error;
    }
  },

  getTokenSummary: async () => {
    try {
      const response = await api.get('/admin/tokens/summary/');

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      return response;
    } catch (error) {
      console.error('[API] Error in getTokenSummary:', error.response?.status, error.response?.data || error.message);
      throw error;
    }
  },

  bulkImportUsers: async ({ file = null, text = '', format = '' } = {}) => {
    const response = await api.post('/admin/users/bulk-import/', buildBulkPayload({ file, text, format }));
    return response;
  },

  // Dashboard endpoint
  getDashboardStats: async () => {
    try {
      return await api.get('/admin/dashboard/stats/');
    } catch (error) {
      console.error('Error in getDashboardStats:', error.response?.status, error.response?.data || error.message);
      throw error;
    }
  },
};

export default api;
