/**
 * Real-time Order Synchronization Module
 *
 * Provides real-time synchronization of order transactions across clients and tabs using:
 * 1. Vite WebSocket server (import.meta.hot) for instant live dev events
 * 2. BroadcastChannel ('vcafe_orders') for 0ms cross-tab real-time communication
 * 3. Native WebSocket client if custom WS URL is configured (VITE_WS_URL)
 * 4. Window CustomEvent dispatch for intra-tab instant reactivity
 */

const CHANNEL_NAME = 'vcafe_orders_channel';
const listeners = new Set();

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event?.data) {
        notifyListeners(event.data);
      }
    };
  }
} catch (e) {
  // Graceful fallback if BroadcastChannel is restricted
}

// Listen to Vite Dev Server WebSocket custom events
if (typeof import.meta !== 'undefined' && import.meta.hot) {
  import.meta.hot.on('canteen:order_transaction', (data) => {
    notifyListeners(data);
  });
}

// Optional: Native WebSocket connection if backend WS URL is configured
let nativeSocket = null;
const initNativeSocket = () => {
  const wsUrl = import.meta?.env?.VITE_WS_URL;
  if (!wsUrl || typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

  try {
    nativeSocket = new WebSocket(wsUrl);
    nativeSocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        notifyListeners(payload);
      } catch (err) {
        // Ignored
      }
    };
    nativeSocket.onclose = () => {
      // Auto-reconnect after 5 seconds
      setTimeout(initNativeSocket, 5000);
    };
  } catch (err) {
    // Graceful fallback
  }
};
initNativeSocket();

function notifyListeners(payload) {
  listeners.forEach((callback) => {
    try {
      callback(payload);
    } catch (e) {
      console.error('Error in orderSync listener:', e);
    }
  });
}

/**
 * Broadcast an order event (e.g. order placed, order accepted, order declined)
 * @param {string} action - 'order_created' | 'order_accepted' | 'order_declined' | 'status_changed'
 * @param {object} data - Order payload (orderId, status, etc.)
 */
export const broadcastOrderEvent = (action, data = {}) => {
  const payload = {
    action,
    data,
    timestamp: Date.now(),
  };

  // 1. Notify local subscribers in current page
  notifyListeners(payload);

  // 2. Broadcast via BroadcastChannel to sibling tabs/windows
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {}
  }

  // 3. Send over Vite dev server WebSocket to broadcast to all clients
  if (typeof import.meta !== 'undefined' && import.meta.hot) {
    try {
      import.meta.hot.send('canteen:order_transaction', payload);
    } catch (e) {}
  }

  // 4. Send via Native WebSocket if connected
  if (nativeSocket && nativeSocket.readyState === WebSocket.OPEN) {
    try {
      nativeSocket.send(JSON.stringify(payload));
    } catch (e) {}
  }
};

/**
 * Subscribe to real-time order updates
 * @param {function} callback - Receives { action, data, timestamp }
 * @returns {function} unsubscribe function
 */
export const subscribeToOrderUpdates = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
