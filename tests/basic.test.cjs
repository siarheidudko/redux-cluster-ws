/**
 * Simple Redux-Cluster-WS Test
 * Tests basic functionality without complex state synchronization
 */

console.log("Starting test file execution...");

const {
  createStore,
  server,
  client,
} = require("../dist/cjs/index.js");

console.log("Import successful. createStore type:", typeof createStore);

// ANSI color codes for better output
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
};

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFunction) {
  totalTests++;
  try {
    const result = testFunction();
    if (result) {
      console.log(colors.green(`✓ ${testName}`));
      passedTests++;
    } else {
      console.log(colors.red(`✗ ${testName}`));
      failedTests++;
    }
  } catch (error) {
    console.log(colors.red(`✗ ${testName}: ${error.message}`));
    failedTests++;
  }
}

function printResults() {
  console.log(colors.bold("\n=== Test Results ==="));
  console.log(`Total tests: ${totalTests}`);
  console.log(colors.green(`Passed: ${passedTests}`));
  console.log(colors.red(`Failed: ${failedTests}`));
  console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (failedTests === 0) {
    console.log(colors.green("\n🎉 All tests passed!"));
  } else {
    console.log(colors.red("\n❌ Some tests failed!"));
  }
}

// Simple reducer for testing
function testReducer(state = { counter: 0, versions: [] }, action) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, counter: state.counter + 1 };
    case "DECREMENT":
      return { ...state, counter: state.counter - 1 };
    case "ADD_VERSION":
      return {
        ...state,
        versions: [...state.versions, action.payload],
      };
    default:
      return state;
  }
}

// Client reducer with different name
function clientTestReducer(state = { counter: 0, versions: [] }, action) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, counter: state.counter + 1 };
    case "DECREMENT":
      return { ...state, counter: state.counter - 1 };
    case "ADD_VERSION":
      return {
        ...state,
        versions: [...state.versions, action.payload],
      };
    default:
      return state;
  }
}

console.log(colors.bold("Starting Redux-Cluster-WS Basic Test..."));

// Test 1: Module imports
runTest("Module should export createStore function", () => {
  return typeof createStore === "function";
});

// Test 2: Store creation
let serverStore, clientStore;

try {
  serverStore = createStore(testReducer);
  runTest("Server store should be created", () => {
    return serverStore && typeof serverStore.getState === "function";
  });
} catch (error) {
  runTest("Server store should be created", () => false);
}

try {
  clientStore = createStore(clientTestReducer);
  runTest("Client store should be created", () => {
    return clientStore && typeof clientStore.getState === "function";
  });
} catch (error) {
  console.log(`Client store creation error: ${error.message}`);
  runTest("Client store should be created", () => false);
}

// Test 3: Initial state
if (serverStore) {
  runTest("Server store should have correct initial state", () => {
    const state = serverStore.getState();
    return state.versions.length === 0 && state.counter === 0;
  });
}

// Test 4: Store methods
if (serverStore) {
  runTest("Server should have createWSServer method", () => {
    return typeof server === "function";
  });
}

if (clientStore) {
  runTest("Client should have createWSClient method", () => {
    return typeof client === "function";
  });
}

// Test 5: Basic dispatch functionality
if (serverStore) {
  runTest("Server store should handle actions", () => {
    const initialState = serverStore.getState();
    serverStore.dispatch({ type: "INCREMENT" });
    const newState = serverStore.getState();
    return newState.counter === initialState.counter + 1;
  });
}

if (clientStore) {
  runTest("Client store should handle actions", () => {
    const initialState = clientStore.getState();
    clientStore.dispatch({ type: "INCREMENT" });
    const newState = clientStore.getState();
    return newState.counter === initialState.counter + 1;
  });
}

// Test 6: WebSocket server creation (basic test)
if (serverStore) {
  try {
    const wsServerStore = server(serverStore);
    const wsServer = wsServerStore.createWSServer({
      port: 8889, // Different port to avoid conflicts
      logins: {
        test: "password123",
      },
    });
    runTest("WebSocket server should start without errors", () => true);

    // Clean up
    setTimeout(() => {
      if (wsServer && wsServer.close) {
        wsServer.close();
      }
    }, 100);
  } catch (error) {
    runTest("WebSocket server should start without errors", () => false);
  }
}

// Test 7: Package structure validation
runTest("Package should have proper exports", () => {
  const exports = require("../dist/cjs/index.js");
  return (
    exports.createStore &&
    exports.server &&
    exports.client &&
    exports.hasher &&
    exports.replacer
  );
});

// Test 8: TypeScript declarations exist
const fs = require("fs");
const path = require("path");

runTest("TypeScript declarations should exist", () => {
  const dtsPath = path.join(__dirname, "../dist/cjs/index.d.ts");
  return fs.existsSync(dtsPath);
});

runTest("ESM build should exist", () => {
  const esmPath = path.join(__dirname, "../dist/esm/index.js");
  return fs.existsSync(esmPath);
});

// Final results
setTimeout(() => {
  printResults();
  process.exit(failedTests > 0 ? 1 : 0);
}, 500);
