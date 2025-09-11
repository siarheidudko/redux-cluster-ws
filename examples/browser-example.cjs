/**
 * Redux-Cluster-WS Browser Example JavaScript
 *
 * This script demonstrates how to use redux-cluster-ws in a browser environment.
 * It creates a simple counter application that synchronizes with a WebSocket server.
 */

// Store instance
let store = null;
let wsClient = null;

// Simple Redux implementation for browser (minimal version)
function createSimpleRedux(reducer) {
  let state = reducer(undefined, {});
  let listeners = [];

  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach((listener) => listener());
      return action;
    },
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
}

// Counter reducer (same as server)
function counterReducer(state = { count: 0, lastUpdate: null }, action) {
  switch (action.type) {
    case "INCREMENT":
      return {
        count: state.count + 1,
        lastUpdate: new Date().toISOString(),
      };

    case "DECREMENT":
      return {
        count: state.count - 1,
        lastUpdate: new Date().toISOString(),
      };

    case "RESET":
      return {
        count: 0,
        lastUpdate: new Date().toISOString(),
      };

    default:
      return state;
  }
}

// Simple hash function (simplified version of redux-cluster-ws hasher)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// WebSocket Client implementation
class BrowserWSClient {
  constructor(store, config) {
    this.store = store;
    this.config = config;
    this.authenticated = false;
    this.login = simpleHash(`REDUX_CLUSTER${config.login}`);
    this.password = simpleHash(`REDUX_CLUSTER${config.password}`);
    this.originalDispatch = store.dispatch;

    // Override store dispatch
    this.store.dispatch = this.dispatch.bind(this);
    this.store.connected = false;
    this.store.RCHash = "browser-example-hash";
  }

  connect() {
    const url = `${this.config.host}:${this.config.port}/redux-cluster-${this.store.RCHash}`;
    log(`Connecting to: ${url}`, "info");

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        log("WebSocket connected", "success");
        this.sendMessage({
          _msg: "REDUX_CLUSTER_SOCKET_AUTH",
          _hash: this.store.RCHash,
          _login: this.login,
          _password: this.password,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          log(`Message parse error: ${error.message}`, "error");
        }
      };

      this.ws.onclose = () => {
        log("WebSocket disconnected", "warning");
        this.authenticated = false;
        this.store.connected = false;
        updateUI();
      };

      this.ws.onerror = (error) => {
        log(`WebSocket error: ${error}`, "error");
        this.authenticated = false;
        this.store.connected = false;
        updateUI();
      };
    } catch (error) {
      log(`Connection error: ${error.message}`, "error");
      this.store.connected = false;
      updateUI();
    }
  }

  handleMessage(message) {
    if (message._hash !== this.store.RCHash) {
      return;
    }

    switch (message._msg) {
      case "REDUX_CLUSTER_MSGTOWORKER":
        if (message._action) {
          log(`Received action: ${message._action.type}`, "info");
          this.originalDispatch(message._action);
        }
        break;

      case "REDUX_CLUSTER_SOCKET_AUTHSTATE":
        if (message._value === true) {
          this.authenticated = true;
          this.store.connected = true;
          log("Authentication successful", "success");
          updateUI();

          // Request initial sync
          this.sendMessage({
            _msg: "REDUX_CLUSTER_START",
            _hash: this.store.RCHash,
          });
        } else {
          this.authenticated = false;
          this.store.connected = false;

          if (message._banned) {
            log("Authentication failed: IP banned", "error");
          } else {
            log("Authentication failed: Invalid credentials", "error");
          }
          updateUI();
        }
        break;
    }
  }

  dispatch(action) {
    try {
      if (
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        this.authenticated
      ) {
        log(`Sending action: ${action.type}`, "info");
        this.sendMessage({
          _msg: "REDUX_CLUSTER_MSGTOMASTER",
          _hash: this.store.RCHash,
          _action: action,
        });
      } else {
        log("Cannot dispatch: not connected or not authenticated", "warning");
      }
    } catch (error) {
      log(`Dispatch error: ${error.message}`, "error");
    }
    return action;
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.store.dispatch = this.originalDispatch;
  }
}

// Logging function
function log(message, type = "info") {
  const logEl = document.getElementById("log");
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${timestamp}] ${message}`;

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;

  // Keep only last 50 entries
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
}

// UI update function
function updateUI() {
  const statusEl = document.getElementById("status");
  const connectBtn = document.getElementById("connectBtn");
  const counterEl = document.getElementById("counterValue");
  const lastUpdateEl = document.getElementById("lastUpdate");
  const buttons = ["incBtn", "decBtn", "resetBtn"];

  if (store && store.connected) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";
    connectBtn.textContent = "Disconnect";

    // Enable action buttons
    buttons.forEach((id) => {
      document.getElementById(id).disabled = false;
    });

    // Update counter display
    const state = store.getState();
    counterEl.textContent = state.count;
    lastUpdateEl.textContent = state.lastUpdate
      ? `Last updated: ${new Date(state.lastUpdate).toLocaleString()}`
      : "Never updated";
  } else if (store) {
    statusEl.textContent = "Connecting...";
    statusEl.className = "status connecting";
    connectBtn.textContent = "Cancel";

    // Disable action buttons
    buttons.forEach((id) => {
      document.getElementById(id).disabled = true;
    });
  } else {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status disconnected";
    connectBtn.textContent = "Connect";

    // Disable action buttons
    buttons.forEach((id) => {
      document.getElementById(id).disabled = true;
    });

    counterEl.textContent = "0";
    lastUpdateEl.textContent = "Never updated";
  }
}

// Connection toggle function
function toggleConnection() {
  if (store && store.connected) {
    // Disconnect
    log("Disconnecting...", "info");
    if (wsClient) {
      wsClient.disconnect();
    }
    store = null;
    wsClient = null;
    updateUI();
  } else if (store && !store.connected) {
    // Cancel connection attempt
    if (wsClient) {
      wsClient.disconnect();
    }
    store = null;
    wsClient = null;
    updateUI();
  } else {
    // Connect
    const host = document.getElementById("host").value.trim();
    const port = document.getElementById("port").value.trim();
    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!host || !port || !login || !password) {
      log("Please fill in all connection fields", "error");
      return;
    }

    log("Creating store and connecting...", "info");

    // Create store
    store = createSimpleRedux(counterReducer);

    // Subscribe to state changes
    store.subscribe(() => {
      updateUI();
    });

    // Create WebSocket client
    wsClient = new BrowserWSClient(store, {
      host: host,
      port: parseInt(port),
      login: login,
      password: password,
    });

    updateUI();
    wsClient.connect();
  }
}

// Action functions
function increment() {
  if (store && store.connected) {
    store.dispatch({ type: "INCREMENT" });
  }
}

function decrement() {
  if (store && store.connected) {
    store.dispatch({ type: "DECREMENT" });
  }
}

function reset() {
  if (store && store.connected) {
    store.dispatch({ type: "RESET" });
  }
}

// Initialize UI on page load
document.addEventListener("DOMContentLoaded", () => {
  log("Browser example loaded", "success");
  updateUI();
});
