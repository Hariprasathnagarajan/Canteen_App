import { useState, useCallback, useRef, useEffect } from 'react';

// Track active requests to prevent duplicates
const activeRequests = new Map();

// Helper to normalize API responses
const normalizeResponse = (response) => {
  // Handle different response formats
  if (!response) return { data: null, status: 0, statusText: 'No response' };
  
  // If response is already normalized
  if (response.data !== undefined && response.status !== undefined) {
    return response;
  }
  
  // Handle axios response
  if (response.config) {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config
    };
  }
  
  // Handle direct data
  return { data: response, status: 200, statusText: 'OK' };
};

// Helper to extract error information
const extractErrorInfo = (error) => {
  if (!error) return { message: 'Unknown error', status: 500 };
  
  // Handle stale request error
  if (error === 'Stale request' || error?.message === 'Stale request') {
    return { message: 'Stale request', status: 499 };
  }
  
  // Handle abort error
  if (error.name === 'AbortError' || error.message === 'canceled') {
    return { message: 'Request aborted', status: 0, isAborted: true };
  }
  
  // Axios error
  if (error.isAxiosError) {
    return {
      message: error.response?.data?.message || error.message || 'Network Error',
      status: error.response?.status || 500,
      data: error.response?.data,
      code: error.code,
      config: error.config
    };
  }
  
  // Standard Error object
  if (error instanceof Error) {
    return {
      message: error.message,
      status: error.status || 500,
      stack: error.stack
    };
  }
  
  // String error
  return { message: String(error), status: 500 };
};

export const useApi = (options = {}) => {
  const { 
    initialData = null, 
    onSuccess, 
    onError,
    defaultErrorMessage = 'An error occurred',
    logRequests = (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') || false,
    skipIfLoading = true, // Default to true to prevent duplicate requests
    showErrorToast = true
  } = options;
  
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);
  // Refs keep callApi identity stable across renders (loading state and
  // callbacks live in refs so they never invalidate the useCallback below).
  const loadingRef = useRef(false);
  const callbacksRef = useRef({ onSuccess, onError });
  callbacksRef.current = { onSuccess, onError };
  
  // Cleanup on unmount
  useEffect(() => {
    // React 18 StrictMode mounts, unmounts, then remounts components in
    // development. The flag must be reset here (not just in useRef init),
    // otherwise the remounted instance would permanently discard responses.
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      loadingRef.current = false;
      // Clean up any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);
  
  const callApi = useCallback(async (apiCall, ...args) => {
    // Skip if already loading and not forced (check BEFORE incrementing requestIdRef
    // so we do not invalidate in-flight request completion in finally block).
    if (skipIfLoading && loadingRef.current) {
      console.log(`[useApi] Skipping duplicate request: ${apiCall.name || 'anonymous'}`);
      return { aborted: true, requestId: requestIdRef.current };
    }

    // Generate a unique ID for this request
    const requestId = ++requestIdRef.current;
    
    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // Generate a request key for deduplication
    const requestKey = `${apiCall.name || 'anonymous'}-${JSON.stringify(args)}`;
    
    // Check if there's an existing request with the same key
    if (activeRequests.has(requestKey)) {
      console.log(`[useApi] Cancelling duplicate request: ${requestKey}`);
      const existingController = activeRequests.get(requestKey);
      if (existingController) {
        existingController.abort();
      }
    }
    
    // Add to active requests
    activeRequests.set(requestKey, controller);
    
    // Set loading state
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      if (logRequests) {
        console.log(`[API] Making request #${requestId}:`, {
          method: apiCall.name || 'anonymous',
          args,
          options,
          requestKey
        });
      }
      
      // Add signal to the request options if not already present
      let requestArgs = [...args];
      const lastArg = args[args.length - 1];
      
      if (lastArg && typeof lastArg === 'object' && !(lastArg instanceof FormData)) {
        requestArgs = [
          ...args.slice(0, -1),
          { ...lastArg, signal: controller.signal }
        ];
      } else if (apiCall.length > args.length) {
        // If the function expects more arguments than provided, add signal
        requestArgs = [...args, { signal: controller.signal }];
      } else if (apiCall.length === 0 && args.length === 0) {
        // If no arguments expected, add signal as first argument
        requestArgs = [{ signal: controller.signal }];
      }
      
      const response = await apiCall(...requestArgs);
      
      // Remove from active requests
      activeRequests.delete(requestKey);
      
      // Check if this is the latest request
      if (requestId !== requestIdRef.current) {
        console.log(`[API] Ignoring stale request #${requestId}, current is #${requestIdRef.current}`);
        return { aborted: true, requestId, isStale: true };
      }
      
      // Check if the request was aborted
      if (controller.signal.aborted) {
        console.log(`[API] Request #${requestId} was aborted`);
        return { aborted: true, requestId };
      }
      
      const normalizedResponse = normalizeResponse(response);
      
      if (logRequests) {
        console.log(`[API] Request #${requestId} successful:`, {
          status: normalizedResponse.status,
          data: normalizedResponse.data
        });
      }
      
      if (isMounted.current) {
        setData(normalizedResponse.data);
        setLoading(false);
        
        const successCallback = callbacksRef.current.onSuccess;
        if (successCallback) {
          try {
            successCallback(normalizedResponse.data);
          } catch (err) {
            console.error('[API] Error in success callback:', err);
          }
        }
      }
      
      return {
        data: normalizedResponse.data,
        error: null,
        status: normalizedResponse.status,
        statusText: normalizedResponse.statusText,
        response: normalizedResponse,
        requestId,
        aborted: false
      };
      
    } catch (err) {
      // Remove from active requests
      activeRequests.delete(requestKey);
      
      // Check if this is still the current request
      if (requestId !== requestIdRef.current) {
        console.log(`[API] Ignoring stale request #${requestId}, current is #${requestIdRef.current}`);
        return { 
          aborted: true, 
          requestId, 
          isStale: true,
          data: null,
          error: 'Stale request',
          status: 0
        };
      }
      
      const errorInfo = extractErrorInfo(err);
      const errorMessage = errorInfo.message || defaultErrorMessage;
      
      if (logRequests) {
        console.error(`[API] Request #${requestId} failed:`, {
          error: errorInfo,
          request: { endpoint: apiCall?.name || 'unknown-endpoint', args }
        });
      }
      
      // Only update error state if this is still the current request
      if (requestId === requestIdRef.current) {
        setError(errorMessage);
      }
      
      const errorCallback = callbacksRef.current.onError;
      if (typeof errorCallback === 'function') {
        try {
          errorCallback(errorMessage, errorInfo);
        } catch (callbackErr) {
          console.error('[API] Error in error callback:', callbackErr);
        }
      }
      
      return { 
        data: null, 
        error: errorMessage, 
        status: errorInfo.status || 500, 
        errorInfo,
        isError: true,
        aborted: errorInfo.isAborted || false,
        isStale: false
      };
      
    } finally {
      // Only update loading state if this is still the current request
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [defaultErrorMessage, logRequests, skipIfLoading]);

  // Reset state
  const reset = useCallback(() => {
    requestIdRef.current++;
    loadingRef.current = false;
    setData(initialData);
    setError(null);
    setLoading(false);
    
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [initialData]);
  
  const cancel = useCallback(() => {
    requestIdRef.current++;
    loadingRef.current = false;
    setLoading(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { 
    data, 
    error, 
    loading, 
    callApi,
    cancel,
    reset
  };
};

export default useApi;
