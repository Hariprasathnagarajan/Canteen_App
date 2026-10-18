// Cookie utility functions
let memoryCSRFToken = null;

// Namespaced CSRF cookie name — matches backend settings.CSRF_COOKIE_NAME.
// Generic `csrftoken` collides with other apps on shared `localhost`.
export const CSRF_COOKIE_NAME = 'vcafe_csrftoken';

export const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Detect whether we are in a cross-site production deployment
// (Netlify frontend -> Render backend over HTTPS requires SameSite=None; Secure)
const isCrossSiteProduction = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('netlify.app') || host.includes('vercel.app') ||
    (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168'));
};

export const setCookie = (name, value, days = 365) => {
  if (typeof document === 'undefined') return;

  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  const crossSite = isCrossSiteProduction();
  const sameSite = crossSite ? 'None' : 'Lax';
  const secure = crossSite ? '; Secure' : '';
  document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=${sameSite}${secure}`;
};

export const deleteCookie = (name) => {
  if (typeof document === 'undefined') return;

  // Expire in both SameSite variants to ensure removal in all environments
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure`;
  if (name === CSRF_COOKIE_NAME || name === 'csrftoken') {
    memoryCSRFToken = null;
  }
};


// CSRF Token specific functions
export const getCSRFToken = () => {
  // Read the namespaced cookie only — a generic `csrftoken` from another
  // app on localhost would otherwise be sent as our token and fail CSRF.
  return getCookie(CSRF_COOKIE_NAME) || memoryCSRFToken;
};

// Force a fresh CSRF token, discarding any stale/cached one. Used by the
// response interceptor when a request fails CSRF validation.
export const refreshCSRFToken = async (api) => {
  deleteCookie(CSRF_COOKIE_NAME);
  memoryCSRFToken = null;
  return ensureCSRFCookie(api);
};

export const ensureCSRFCookie = async (api) => {
  const existingToken = getCSRFToken();
  if (existingToken) return existingToken;
  
  // If no token, fetch one from the server
  try {
    const response = await api.get('/csrf/', {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    // In cross-origin deployments (Netlify frontend -> Render backend),
    // document.cookie cannot read third-party cookies set by the backend domain,
    // so we store the token returned in the JSON payload response:
    const receivedToken = response.data?.csrftoken || response.data?.csrfToken || getCookie(CSRF_COOKIE_NAME);
    if (receivedToken) {
      memoryCSRFToken = receivedToken;
      return receivedToken;
    }
    
    return getCSRFToken();
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    throw error;
  }
};
