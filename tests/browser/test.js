/**
 * Redux-Cluster-WS Browser Test
 * (c) 2025 by Siarhei Dudko.
 *
 * Browser test for WebSocket client functionality
 * LICENSE MIT
 */

// We'll need to manually import the modules since we can't use ES modules directly in browser without bundling
let ReduxCluster;
let store;
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

// Utility functions
function log(message) {
  const eventLog = document.getElementById("eventLog");
  const timestamp = new Date().toLocaleTimeString();
  eventLog.textContent += `[${timestamp}] ${message}\n`;
  eventLog.scrollTop = eventLog.scrollHeight;
  console.log(message);
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById("connectionStatus");
  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  if (connected) {
    statusEl.textContent = "Connected";
    statusEl.className = "connection-status connected";
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else {
    statusEl.textContent = "Disconnected";
    statusEl.className = "connection-status disconnected";
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
}

function updateStats() {
  document.getElementById("totalTests").textContent = testResults.total;
  document.getElementById("passedTests").textContent = testResults.passed;
  document.getElementById("failedTests").textContent = testResults.failed;

  const successRate =
    testResults.total > 0
      ? Math.round((testResults.passed / testResults.total) * 100)
      : 0;
  document.getElementById("successRate").textContent = successRate + "%";
}

function updateStateDisplay() {
  const stateEl = document.getElementById("stateDisplay");
  if (store) {
    const state = store.getState();
    stateEl.textContent = JSON.stringify(state, null, 2);
  } else {
    stateEl.textContent = "No store connected";
  }
}

function addTestResult(name, passed, message = "") {
  testResults.total++;
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }

  const resultsEl = document.getElementById("testResults");
  const resultEl = document.createElement("div");
  resultEl.className = `test-result ${passed ? "test-pass" : "test-fail"}`;
  resultEl.textContent = `${passed ? "✓" : "✗"} ${name}${
    message ? ": " + message : ""
  }`;
  resultsEl.appendChild(resultEl);

  updateStats();
  log(`Test ${passed ? "PASSED" : "FAILED"}: ${name}`);
}

// Test reducer
function testReducer(state = { versions: [], counter: 0 }, action) {
  switch (action.type) {
    case "ADD_VERSION":
      return {
        ...state,
        versions: [...state.versions, action.payload],
        counter: state.counter + 1,
      };

    case "RESET":
      return { versions: [], counter: 0 };

    default:
      return state;
  }
}

// Simple Redux implementation for browser
const Redux = {
  createStore: function (reducer) {
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
  },
};

// Simple WebSocket client implementation similar to redux-cluster-ws
function createStore(reducer) {
  const reduxStore = Redux.createStore(reducer);

  // Enhanced store with redux-cluster-ws functionality
  const enhancedStore = {
    ...reduxStore,
    mode: "action",
    connected: false,
    role: [],
    RCHash: "browser-test-hash",
    stderr: log,
    version: "2.0.0",
    homepage: "https://github.com/siarheidudko/redux-cluster-ws",
  };

  enhancedStore.createWSClient = function (config) {
    return new WebSocketClient(enhancedStore, config);
  };

  return enhancedStore;
}

class WebSocketClient {
  constructor(store, config) {
    this.store = store;
    this.config = {
      port: 10002,
      reconnectInterval: 10000,
      ...config,
    };

    this.authenticated = false;
    this.originalDispatch = this.store.dispatch;

    // Hash login and password (simple version)
    this.login = this.simpleHash(`REDUX_CLUSTER${config.login}`);
    this.password = this.simpleHash(`REDUX_CLUSTER${config.password}`);

    this.store.dispatch = this.dispatch.bind(this);
    this.store.role.push("client");
    this.store.connected = false;

    this.connect();
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  connect() {
    try {
      const url = `ws://${this.config.host.replace(/^https?:\/\//, "")}:${
        this.config.port
      }/redux-cluster-${this.store.RCHash}`;
      log(`Connecting to: ${url}`);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        log("WebSocket connected");
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
          log(`Message parse error: ${error.message}`);
        }
      };

      this.ws.onclose = () => {
        log("WebSocket disconnected");
        this.authenticated = false;
        this.store.connected = false;
        updateConnectionStatus(false);

        // Auto-reconnect
        setTimeout(() => {
          if (!this.manualDisconnect) {
            this.connect();
          }
        }, this.config.reconnectInterval);
      };

      this.ws.onerror = (error) => {
        log(`WebSocket error: ${error}`);
        this.authenticated = false;
        this.store.connected = false;
        updateConnectionStatus(false);
      };
    } catch (error) {
      log(`Connection error: ${error.message}`);
      this.store.connected = false;
      updateConnectionStatus(false);
    }
  }

  handleMessage(message) {
    if (message._hash !== this.store.RCHash) {
      return;
    }

    switch (message._msg) {
      case "REDUX_CLUSTER_MSGTOWORKER":
        if (message._action) {
          log(`Received action: ${message._action.type}`);
          this.originalDispatch(message._action);
          updateStateDisplay();
        }
        break;

      case "REDUX_CLUSTER_SOCKET_AUTHSTATE":
        if (message._value === true) {
          this.authenticated = true;
          this.store.connected = true;
          updateConnectionStatus(true);
          log("Authentication successful");

          // Request initial sync
          this.sendMessage({
            _msg: "REDUX_CLUSTER_START",
            _hash: this.store.RCHash,
          });
        } else {
          this.authenticated = false;
          this.store.connected = false;
          updateConnectionStatus(false);

          if (message._banned) {
            log("Authentication failed: IP banned");
          } else {
            log("Authentication failed: Invalid credentials");
          }
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
        log(`Sending action: ${action.type}`);
        this.sendMessage({
          _msg: "REDUX_CLUSTER_MSGTOMASTER",
          _hash: this.store.RCHash,
          _action: action,
        });
      } else {
        log("Cannot dispatch: WebSocket not connected or not authenticated");
      }
    } catch (error) {
      log(`Dispatch error: ${error.message}`);
    }
    return action;
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Global functions for UI
function connect() {
  if (!store) {
    store = createStore(testReducer);

    // Subscribe to state changes
    store.subscribe(() => {
      updateStateDisplay();
    });
  }

  store.createWSClient({
    host: "127.0.0.1",
    port: 8889,
    login: "browser",
    password: "test123",
  });

  updateStateDisplay();
}

function disconnect() {
  if (store && store.wsClient) {
    store.wsClient.disconnect();
  }
  updateConnectionStatus(false);
}

function sendTestAction() {
  if (store && store.connected) {
    const timestamp = Date.now();
    store.dispatch({
      type: "ADD_VERSION",
      payload: `browser-${timestamp}`,
    });
    log(`Sent test action with payload: browser-${timestamp}`);
  } else {
    log("Cannot send action: not connected");
  }
}

function clearResults() {
  testResults = { passed: 0, failed: 0, total: 0 };
  document.getElementById("testResults").innerHTML =
    "<p>Results cleared. Run tests to see new results.</p>";
  updateStats();
  log("Test results cleared");
}

function runTests() {
  log("Starting automated tests...");

  // Clear previous results
  clearResults();

  // Test 1: Store creation
  addTestResult("Store should be created", !!store);

  // Test 2: Store methods
  addTestResult(
    "Store should have getState method",
    store && typeof store.getState === "function"
  );

  addTestResult(
    "Store should have dispatch method",
    store && typeof store.dispatch === "function"
  );

  addTestResult(
    "Store should have subscribe method",
    store && typeof store.subscribe === "function"
  );

  // Test 3: Initial state
  if (store) {
    const initialState = store.getState();
    addTestResult(
      "Store should have correct initial state",
      initialState &&
        Array.isArray(initialState.versions) &&
        initialState.versions.length >= 0 &&
        typeof initialState.counter === "number"
    );
  }

  // Test 4: Connection method
  addTestResult(
    "Store should have createWSClient method",
    store && typeof store.createWSClient === "function"
  );

  // Test 5: Connection status
  addTestResult(
    "Store should have connection status",
    store && typeof store.connected === "boolean"
  );

  // Test 6: Redux-Cluster properties
  addTestResult(
    "Store should have RCHash property",
    store && typeof store.RCHash === "string"
  );

  addTestResult(
    "Store should have role array",
    store && Array.isArray(store.role)
  );

  addTestResult(
    "Store should have mode property",
    store && (store.mode === "action" || store.mode === "snapshot")
  );

  // Test 7: Connection functionality (if connected)
  if (store && store.connected) {
    addTestResult("WebSocket should be connected", true);

    // Test action dispatching
    const beforeState = store.getState();
    const testPayload = `test-${Date.now()}`;

    store.dispatch({
      type: "ADD_VERSION",
      payload: testPayload,
    });

    // Check after a short delay if state changed
    setTimeout(() => {
      const afterState = store.getState();
      addTestResult(
        "Action dispatch should work",
        afterState.counter !== beforeState.counter ||
          afterState.versions.length !== beforeState.versions.length
      );
    }, 100);
  } else {
    addTestResult("WebSocket connection", false, "Not connected");
  }

  log("Automated tests completed");
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  log("Browser test page loaded");
  updateConnectionStatus(false);
  updateStats();
  updateStateDisplay();
});
