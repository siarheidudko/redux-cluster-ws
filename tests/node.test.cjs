/**
 * Redux-Cluster-WS Node.js Test
 * (c) 2025 by Siarhei Dudko.
 *
 * Test for WebSocket client/server functionality
 * LICENSE MIT
 */

const { createStore } = require("redux-cluster");
const { server, client } = require("../dist/cjs/index.js");

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

// Color logging functions
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
};

console.log(colors.blue("Starting Redux-Cluster-WS Test..."));

// Create stores
const serverStore = createStore(testReducer);
const clientStore = createStore(testReducer);

// Setup server
server(serverStore);
serverStore.mode = "snapshot";

// Setup client
client(clientStore);
clientStore.mode = "action";

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

function runTest(name, testFn) {
  testResults.total++;
  try {
    const result = testFn();
    if (result === true || typeof result === "undefined") {
      testResults.passed++;
      console.log(colors.green(`✓ ${name}`));
      return true;
    } else {
      testResults.failed++;
      console.log(colors.red(`✗ ${name}: ${result}`));
      return false;
    }
  } catch (error) {
    testResults.failed++;
    console.log(colors.red(`✗ ${name}: ${error.message}`));
    return false;
  }
}

// Basic tests
runTest("Server store should be created", () => {
  return serverStore && typeof serverStore.getState === "function";
});

runTest("Client store should be created", () => {
  return clientStore && typeof clientStore.getState === "function";
});

runTest("Server store should have correct initial state", () => {
  const state = serverStore.getState();
  return state.versions.length === 0 && state.counter === 0;
});

runTest("Server should have createWSServer method", () => {
  return typeof serverStore.createWSServer === "function";
});

runTest("Client should have createWSClient method", () => {
  return typeof clientStore.createWSClient === "function";
});

// Start WebSocket server
console.log(colors.blue("Starting WebSocket server..."));

try {
  serverStore.createWSServer({
    host: "127.0.0.1",
    port: 8888,
    logins: {
      test: "password123",
    },
  });

  runTest("WebSocket server should start without errors", () => true);

  // Wait a bit for server to be ready
  setTimeout(() => {
    console.log(colors.blue("Connecting WebSocket client..."));

    try {
      clientStore.createWSClient({
        host: "ws://127.0.0.1",
        port: 8888,
        login: "test",
        password: "password123",
      });

      runTest("WebSocket client should connect without errors", () => true);

      // Wait for connection to establish
      setTimeout(() => {
        console.log(
          colors.blue(`Client connected status: ${clientStore.connected}`)
        );
        runTest("Client should be connected", () => {
          return clientStore.connected === true;
        });

        // Test dispatching actions
        console.log(colors.blue("Testing action dispatching..."));

        let syncTestPassed = false;

        // Subscribe to client store changes
        const unsubscribe = clientStore.subscribe(() => {
          const clientState = clientStore.getState();
          const serverState = serverStore.getState();

          if (
            clientState.counter > 0 &&
            clientState.counter === serverState.counter &&
            clientState.versions.length === serverState.versions.length
          ) {
            syncTestPassed = true;
          }
        });

        // Dispatch test action on server
        serverStore.dispatch({
          type: "ADD_VERSION",
          payload: "server-test-1",
        });

        // Check sync after a delay
        setTimeout(() => {
          runTest("Client should sync with server state", () => {
            return syncTestPassed;
          });

          // Test client dispatching to server
          clientStore.dispatch({
            type: "ADD_VERSION",
            payload: "client-test-1",
          });

          setTimeout(() => {
            const finalServerState = serverStore.getState();
            const finalClientState = clientStore.getState();

            runTest("Server should receive client actions", () => {
              return finalServerState.versions.includes("client-test-1");
            });

            runTest("Final states should be synchronized", () => {
              return (
                finalServerState.counter === finalClientState.counter &&
                finalServerState.versions.length ===
                  finalClientState.versions.length
              );
            });

            // Print final results
            console.log(colors.blue("\\n=== Test Results ==="));
            console.log(`Total tests: ${testResults.total}`);
            console.log(colors.green(`Passed: ${testResults.passed}`));
            console.log(colors.red(`Failed: ${testResults.failed}`));

            const successRate = Math.round(
              (testResults.passed / testResults.total) * 100
            );
            console.log(`Success rate: ${successRate}%`);

            if (testResults.failed === 0) {
              console.log(colors.green("\\n🎉 All tests passed!"));
              process.exit(0);
            } else {
              console.log(colors.red("\\n❌ Some tests failed!"));
              process.exit(1);
            }
          }, 1000);
        }, 1000);
      }, 1000);
    } catch (error) {
      console.log(colors.red(`Client connection error: ${error.message}`));
      process.exit(1);
    }
  }, 500);
} catch (error) {
  console.log(colors.red(`Server startup error: ${error.message}`));
  process.exit(1);
}
