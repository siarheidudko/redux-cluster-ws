#!/usr/bin/env node

/**
 * Cross-library Example: Redux-Cluster server + Redux-Cluster-WS client
 *
 * This example demonstrates how redux-cluster (IPC/TCP) can work alongside
 * redux-cluster-ws (WebSocket) to create a hybrid architecture where:
 * - Node.js processes communicate via IPC/TCP (redux-cluster)
 * - Web clients communicate via WebSocket (redux-cluster-ws)
 */

const { createStore } = require("redux-cluster");
const { server } = require("../dist/cjs/index.js");
const cluster = require("cluster");

// Shared reducer
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
            id: Date.now(),
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
            id: Date.now(),
            name: action.payload.name,
            joinedAt: new Date().toISOString(),
            type: action.payload.type || "web", // 'web' or 'cluster'
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

if (cluster.isMaster) {
  console.log("🚀 Starting cross-library demo...");

  // Create main store with redux-cluster
  const store = createStore(todoReducer, {
    mode: "snapshot",
    enableObjectStream: true, // Use protoobject for better performance
  });

  // Add WebSocket server capability
  server(store);

  // Start WebSocket server for web clients
  store.createWSServer({
    host: "127.0.0.1",
    port: 8890,
    logins: {
      "web-client": "web123",
      admin: "admin123",
    },
  });

  console.log("✅ WebSocket server started on port 8890");
  console.log("🔧 Web clients can connect to ws://127.0.0.1:8890");

  // Fork cluster workers for internal processing
  const worker1 = cluster.fork();
  const worker2 = cluster.fork();

  console.log("✅ Cluster workers started");

  // Add main process as admin user
  store.dispatch({
    type: "ADD_USER",
    payload: { name: "Main Process", type: "cluster" },
  });

  // Simulate periodic tasks from main process
  let counter = 0;
  setInterval(() => {
    store.dispatch({
      type: "ADD_TODO",
      payload: {
        text: `Scheduled task ${++counter} from main process`,
        user: "Main Process",
      },
    });
  }, 15000);

  // Log state changes
  store.subscribe(() => {
    const state = store.getState();
    console.log(
      `📊 State update: ${state.todos.length} todos, ${state.users.length} users`
    );
  });

  // Handle worker messages
  cluster.on("message", (worker, message) => {
    console.log(`💬 Message from worker ${worker.process.pid}:`, message);
  });

  // Cleanup on exit
  process.on("SIGINT", () => {
    console.log("\\n🛑 Shutting down cross-library demo...");
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });
} else {
  // Worker process
  const store = createStore(todoReducer, {
    mode: "action",
    enableObjectStream: true,
  });

  // Connect to master via cluster IPC
  store.createClient({
    host: "master",
  });

  const workerId = process.pid;
  console.log(`👷 Worker ${workerId} started and connected to master`);

  // Add worker as user
  store.dispatch({
    type: "ADD_USER",
    payload: { name: `Worker ${workerId}`, type: "cluster" },
  });

  // Worker-specific tasks
  let taskCount = 0;
  setInterval(() => {
    if (Math.random() > 0.7) {
      // 30% chance
      store.dispatch({
        type: "ADD_TODO",
        payload: {
          text: `Background task ${++taskCount} from worker ${workerId}`,
          user: `Worker ${workerId}`,
        },
      });
    }
  }, 8000);

  // Send periodic status to master
  setInterval(() => {
    if (process.send) {
      process.send({
        type: "status",
        workerId,
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
      });
    }
  }, 30000);

  // Subscribe to state changes
  store.subscribe(() => {
    const state = store.getState();
    console.log(`👷 Worker ${workerId} sees: ${state.todos.length} todos`);
  });
}

console.log("\\n📋 Instructions:");
console.log(
  "1. This demo shows redux-cluster (IPC) + redux-cluster-ws (WebSocket)"
);
console.log("2. Main process and workers communicate via cluster IPC");
console.log("3. Web clients can connect via WebSocket to the same store");
console.log("4. Open examples/cross-library-browser.html to see web client");
console.log(
  "5. Or run examples/cross-library-client.js for Node.js WebSocket client"
);
console.log("");
