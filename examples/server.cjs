#!/usr/bin/env node

/**
 * Basic Redux-Cluster-WS Server Example
 *
 * This example demonstrates how to create a simple WebSocket server
 * that synchronizes Redux state across multiple clients.
 */

const { createStore } = require("redux-cluster");
const { server } = require("../dist/cjs/index.js");

// Simple counter reducer
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

console.log("🚀 Starting Redux-Cluster-WS Server Example...");

// Create Redux store
const store = createStore(counterReducer);

// Add WebSocket server capability
server(store);

// Configure synchronization mode
store.mode = "snapshot"; // Send full state on changes

// Subscribe to state changes for logging
store.subscribe(() => {
  const state = store.getState();
  console.log(
    `📊 State updated: count=${state.count}, lastUpdate=${state.lastUpdate}`
  );
});

// Start WebSocket server
store.createWSServer({
  host: "0.0.0.0",
  port: 8088,
  logins: {
    admin: "password123",
    user: "secret456",
    demo: "demo",
  },
});

console.log("✅ WebSocket server started on ws://localhost:8088");
console.log("🔑 Available logins:");
console.log("   - admin:password123");
console.log("   - user:secret456");
console.log("   - demo:demo");
console.log("");
console.log("💡 Try connecting with the client example or browser!");
console.log("");

// Simulate some activity on the server
let counter = 0;
setInterval(() => {
  counter++;

  if (counter % 3 === 0) {
    store.dispatch({ type: "INCREMENT" });
    console.log("🎯 Server auto-increment");
  }
}, 5000);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\\n👋 Shutting down server...");
  process.exit(0);
});

console.log("🔄 Server will auto-increment every 5 seconds");
console.log("Press Ctrl+C to stop");
