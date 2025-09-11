#!/usr/bin/env node

/**
 * Basic Redux-Cluster-WS Client Example
 *
 * This example demonstrates how to create a WebSocket client
 * that connects to a Redux-Cluster-WS server and synchronizes state.
 */

const { createStore } = require("redux-cluster");
const { client } = require("../dist/cjs/index.js");
const readline = require("readline");

// Same reducer as server (must be identical for proper synchronization)
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

console.log("🔌 Starting Redux-Cluster-WS Client Example...");

// Create Redux store
const store = createStore(counterReducer);

// Add WebSocket client capability
client(store);

// Subscribe to state changes
store.subscribe(() => {
  const state = store.getState();
  console.log(
    `\\n📊 State synchronized: count=${state.count}, lastUpdate=${state.lastUpdate}`
  );
  showMenu();
});

// Connect to server
console.log("🔗 Connecting to server...");

store.createWSClient({
  host: "ws://localhost",
  port: 8088,
  login: "demo",
  password: "demo",
});

// Setup interactive menu
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function showMenu() {
  if (store.connected) {
    console.log("\\n🎮 Available actions:");
    console.log("  [1] Increment counter");
    console.log("  [2] Decrement counter");
    console.log("  [3] Reset counter");
    console.log("  [4] Show current state");
    console.log("  [q] Quit");
    console.log("");
    process.stdout.write("Choose action: ");
  } else {
    console.log("\\n⏳ Waiting for connection...");
  }
}

rl.on("line", (input) => {
  const choice = input.trim().toLowerCase();

  if (!store.connected) {
    console.log("❌ Not connected to server yet. Please wait...");
    return;
  }

  switch (choice) {
    case "1":
      console.log("➕ Sending INCREMENT action...");
      store.dispatch({ type: "INCREMENT" });
      break;

    case "2":
      console.log("➖ Sending DECREMENT action...");
      store.dispatch({ type: "DECREMENT" });
      break;

    case "3":
      console.log("🔄 Sending RESET action...");
      store.dispatch({ type: "RESET" });
      break;

    case "4":
      const state = store.getState();
      console.log("\\n📋 Current state:");
      console.log(JSON.stringify(state, null, 2));
      showMenu();
      break;

    case "q":
    case "quit":
    case "exit":
      console.log("\\n👋 Goodbye!");
      process.exit(0);
      break;

    default:
      console.log("❓ Invalid choice. Please try again.");
      showMenu();
      break;
  }
});

// Handle connection events
setTimeout(() => {
  if (store.connected) {
    console.log("✅ Connected to server!");
    const state = store.getState();
    console.log(`📊 Initial state: count=${state.count}`);
    showMenu();
  } else {
    console.log("❌ Failed to connect to server.");
    console.log("💡 Make sure the server is running on ws://localhost:8080");
    console.log("💡 Run: node examples/server.js");
    process.exit(1);
  }
}, 2000);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\\n👋 Shutting down client...");
  rl.close();
  process.exit(0);
});

console.log("⏳ Connecting... (this may take a moment)");
