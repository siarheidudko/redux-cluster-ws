/**
 * Cross-library integration test
 * Tests redux-cluster (IPC/TCP) + redux-cluster-ws (WebSocket) together
 */

const cluster = require("cluster");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");

// Test configuration
const TEST_CONFIG = {
  workerCount: 0, // No workers, only WebSocket clients
  wsPort: 8891,
  testDuration: 10000,
  actionInterval: 500,
  maxActions: 20,
};

// Simple hash function (should match server implementation)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Todo reducer (same as examples)
function todoReducer(
  state = { todos: [], users: [], stats: { total: 0 } },
  action
) {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            id: Date.now() + Math.random(),
            text: action.payload.text,
            completed: false,
            createdBy: action.payload.user || "anonymous",
            timestamp: new Date().toISOString(),
          },
        ],
        stats: { total: state.stats.total + 1 },
      };

    case "TOGGLE_TODO":
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id
            ? { ...todo, completed: !todo.completed }
            : todo
        ),
      };

    case "ADD_USER":
      const userExists = state.users.find(
        (u) => u.name === action.payload.name
      );
      if (userExists) return state;

      return {
        ...state,
        users: [
          ...state.users,
          {
            id: Date.now() + Math.random(),
            name: action.payload.name,
            joinedAt: new Date().toISOString(),
            type: action.payload.type || "cluster",
          },
        ],
      };

    case "REMOVE_USER":
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.payload.id),
      };

    default:
      return state;
  }
}

// WebSocket client for testing
class TestWebSocketClient {
  constructor(config) {
    this.config = config;
    this.authenticated = false;
    this.receivedActions = [];
    this.connected = false;

    // Hash credentials if provided
    this.login = config.login
      ? simpleHash(`REDUX_CLUSTER${config.login}`)
      : undefined;
    this.password = config.password
      ? simpleHash(`REDUX_CLUSTER${config.password}`)
      : undefined;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${this.config.port}/redux-cluster-${this.config.hash}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        if (this.login && this.password) {
          this.sendMessage({
            _msg: "REDUX_CLUSTER_SOCKET_AUTH",
            _hash: this.config.hash,
            _login: this.login,
            _password: this.password,
          });
        } else {
          // No auth required, directly authenticate
          this.authenticated = true;
          this.sendMessage({
            _msg: "REDUX_CLUSTER_START",
            _hash: this.config.hash,
          });
          resolve();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);

          if (
            message._msg === "REDUX_CLUSTER_SOCKET_AUTHSTATE" &&
            message._value === true
          ) {
            this.authenticated = true;
            this.sendMessage({
              _msg: "REDUX_CLUSTER_START",
              _hash: this.config.hash,
            });
            resolve();
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.authenticated = false;
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });
  }

  handleMessage(message) {
    if (message._hash !== this.config.hash) return;

    if (message._msg === "REDUX_CLUSTER_MSGTOWORKER" && message._action) {
      this.receivedActions.push({
        ...message._action,
        receivedAt: Date.now(),
      });
    }
  }

  dispatch(action) {
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.authenticated
    ) {
      this.sendMessage({
        _msg: "REDUX_CLUSTER_MSGTOMASTER",
        _hash: this.config.hash,
        _action: action,
      });
      return true;
    }
    return false;
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
  }
}

// Test results collector
class TestResults {
  constructor() {
    this.results = {
      master: { actionsSent: 0, actionsReceived: 0, errors: [] },
      workers: {},
      webClients: {},
      startTime: Date.now(),
      endTime: null,
    };
  }

  addWorkerResult(workerId, result) {
    this.results.workers[workerId] = result;
  }

  addWebClientResult(clientId, result) {
    this.results.webClients[clientId] = result;
  }

  addMasterResult(result) {
    this.results.master = { ...this.results.master, ...result };
  }

  finish() {
    this.results.endTime = Date.now();
    this.results.duration = this.results.endTime - this.results.startTime;
  }

  validate() {
    const errors = [];

    // Check if all participants received actions
    const masterActions = this.results.master.actionsReceived;

    Object.entries(this.results.workers).forEach(([workerId, worker]) => {
      if (worker.actionsReceived !== masterActions) {
        errors.push(
          `Worker ${workerId}: Expected ${masterActions} actions, got ${worker.actionsReceived}`
        );
      }
    });

    Object.entries(this.results.webClients).forEach(([clientId, client]) => {
      if (client.actionsReceived !== masterActions) {
        errors.push(
          `WebClient ${clientId}: Expected ${masterActions} actions, got ${client.actionsReceived}`
        );
      }
    });

    // Check for errors
    [
      this.results.master,
      ...Object.values(this.results.workers),
      ...Object.values(this.results.webClients),
    ].forEach((participant) => {
      if (participant.errors && participant.errors.length > 0) {
        errors.push(...participant.errors);
      }
    });

    return {
      success: errors.length === 0,
      errors,
      summary: {
        duration: this.results.duration,
        totalParticipants:
          1 +
          Object.keys(this.results.workers).length +
          Object.keys(this.results.webClients).length,
        actionsProcessed: masterActions,
        averageLatency: this.calculateAverageLatency(),
      },
    };
  }

  calculateAverageLatency() {
    const allLatencies = [];

    Object.values(this.results.workers).forEach((worker) => {
      if (worker.latencies) allLatencies.push(...worker.latencies);
    });

    Object.values(this.results.webClients).forEach((client) => {
      if (client.latencies) allLatencies.push(...client.latencies);
    });

    return allLatencies.length > 0
      ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length
      : 0;
  }
}

async function runCrossLibraryTest() {
  console.log("🧪 Starting cross-library integration test...");
  console.log(`📊 Configuration:`, TEST_CONFIG);

  const testResults = new TestResults();

  if (cluster.isMaster) {
    // Master process - runs the hybrid server
    try {
      const { createStore } = require("redux-cluster");
      const { server } = require("../dist/cjs/index.js");

      console.log("🖥️  Setting up master process...");

      // Create Redux store (simple store without clustering for WebSocket-only test)
      const store = createStore(todoReducer);

      // Setup WebSocket server
      const serverInstance = server(store);
      store.mode = "action"; // Send individual actions, not snapshots
      serverInstance.createWSServer({
        port: TEST_CONFIG.wsPort,
        logins: {
          test: "test123",
        },
      });

      console.log(
        `🔌 WebSocket server listening on port ${TEST_CONFIG.wsPort}`
      );

      // Track actions
      let actionsSent = 0;
      let actionsReceived = 0;
      const originalDispatch = store.dispatch;

      store.dispatch = (action) => {
        if (action.type !== "@@INIT") {
          actionsReceived++;
          console.log(
            `📨 Master received action: ${action.type} (${actionsReceived})`
          );
        }
        return originalDispatch(action);
      };

      // Connect WebSocket clients
      console.log("🌐 Connecting WebSocket clients...");
      const webClients = [];

      for (let i = 0; i < 2; i++) {
        try {
          const { createStore } = require("redux-cluster");
          const { client } = require("../dist/cjs/index.js");

          const clientStore = createStore(todoReducer);
          let clientActionsReceived = 0;

          client(clientStore);

          // Track received actions
          const originalDispatch = clientStore.dispatch;
          clientStore.dispatch = (action) => {
            if (
              action.type !== "@@INIT" &&
              action.type !== "REDUX_CLUSTER_SYNC"
            ) {
              clientActionsReceived++;
            }
            return originalDispatch(action);
          };

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Connection timeout")),
              5000
            );

            clientStore.subscribe(() => {
              clearTimeout(timeout);
              resolve();
            });

            clientStore.createWSClient({
              host: "ws://localhost",
              port: TEST_CONFIG.wsPort,
              login: "test",
              password: "test123",
            });
          });

          webClients.push({
            store: clientStore,
            actionsReceived: () => clientActionsReceived,
            disconnect: () => {
              if (clientStore.ws) clientStore.ws.close();
            },
          });

          console.log(`🔗 WebSocket client ${i + 1} connected`);
        } catch (error) {
          console.error(
            `❌ Failed to connect WebSocket client ${i + 1}:`,
            error.message
          );
        }
      }

      // Run test
      console.log("🚀 Starting test actions...");
      const testInterval = setInterval(() => {
        if (actionsSent < TEST_CONFIG.maxActions) {
          const action = {
            type: "ADD_TODO",
            payload: {
              text: `Test todo ${actionsSent + 1}`,
              user: "Master",
            },
          };

          store.dispatch(action);
          actionsSent++;
          console.log(`📤 Master sent action: ${action.type} (${actionsSent})`);
        } else {
          clearInterval(testInterval);
        }
      }, TEST_CONFIG.actionInterval);

      // Wait for test completion
      await new Promise((resolve) => {
        setTimeout(resolve, TEST_CONFIG.testDuration);
      });

      // Collect WebSocket client results
      webClients.forEach((client, index) => {
        testResults.addWebClientResult(`client_${index + 1}`, {
          actionsReceived: client.actionsReceived(),
          latencies: [],
          errors: [],
        });
        client.disconnect();
      });

      // Add all results
      testResults.addMasterResult({
        actionsSent,
        actionsReceived,
        errors: [],
      });

      testResults.finish();

      // Cleanup
      if (serverInstance.server) {
        serverInstance.server.close();
      }

      // Validate and report results
      const validation = testResults.validate();

      console.log("\n📋 Test Results:");
      console.log("================");
      console.log(`✅ Success: ${validation.success}`);
      console.log(`⏱️  Duration: ${validation.summary.duration}ms`);
      console.log(`👥 Participants: ${validation.summary.totalParticipants}`);
      console.log(
        `📊 Actions Processed: ${validation.summary.actionsProcessed}`
      );
      console.log(
        `⚡ Average Latency: ${validation.summary.averageLatency.toFixed(2)}ms`
      );

      if (validation.errors.length > 0) {
        console.log("\n❌ Errors:");
        validation.errors.forEach((error) => console.log(`   ${error}`));
        process.exit(1);
      } else {
        console.log("\n🎉 Cross-library integration test passed!");
        process.exit(0);
      }
    } catch (error) {
      console.error("❌ Master process error:", error);
      process.exit(1);
    }
  } else {
    // No worker processes in WebSocket-only test
    console.log("👷 No workers needed for WebSocket-only test");
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  runCrossLibraryTest().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}

module.exports = { runCrossLibraryTest, TestWebSocketClient, TestResults };
