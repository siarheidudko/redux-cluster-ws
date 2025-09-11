#!/usr/bin/env node

/**
 * Redux-Cluster-WS Browser Test Server
 * (c) 2025 by Siarhei Dudko.
 *
 * HTTP server for browser tests
 * LICENSE MIT
 */

import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createStore } from "redux-cluster";
import { server } from "../../dist/esm/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

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

// Create Redux-Cluster store
const store = createStore(testReducer);
server(store);
store.mode = "snapshot";

// Start WebSocket server
store.createWSServer({
  host: "127.0.0.1",
  port: 8889,
  logins: {
    browser: "test123",
  },
});

console.log("WebSocket server started on port 8889");

// HTTP server for serving test files
const httpServer = createServer((req, res) => {
  let filePath;

  if (req.url === "/" || req.url === "/index.html") {
    filePath = join(__dirname, "index.html");
    res.setHeader("Content-Type", "text/html");
  } else if (req.url === "/test.js") {
    filePath = join(__dirname, "test.js");
    res.setHeader("Content-Type", "application/javascript");
  } else if (req.url === "/redux-cluster-ws.js") {
    // Serve the bundled client library
    filePath = join(projectRoot, "dist/esm/client.js");
    res.setHeader("Content-Type", "application/javascript");
  } else if (req.url === "/utils.js") {
    filePath = join(projectRoot, "dist/esm/utils.js");
    res.setHeader("Content-Type", "application/javascript");
  } else if (req.url === "/types.js") {
    filePath = join(projectRoot, "dist/esm/types.js");
    res.setHeader("Content-Type", "application/javascript");
  } else {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  try {
    const content = readFileSync(filePath);
    res.statusCode = 200;
    res.end(content);
  } catch (error) {
    res.statusCode = 404;
    res.end("File not found");
  }
});

httpServer.listen(3000, () => {
  console.log("HTTP server started on http://localhost:3000");
  console.log(
    "Open your browser and navigate to http://localhost:3000 to run tests"
  );
});

// Periodically dispatch actions for testing
let counter = 0;
setInterval(() => {
  store.dispatch({
    type: "ADD_VERSION",
    payload: `server-${counter++}`,
  });
}, 5000);

// Handle shutdown
process.on("SIGINT", () => {
  console.log("\\nShutting down servers...");
  httpServer.close();
  process.exit(0);
});
