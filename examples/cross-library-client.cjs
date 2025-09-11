#!/usr/bin/env node

/**
 * Cross-library WebSocket Client
 *
 * This client connects to the cross-library server via WebSocket
 * while the server also handles cluster workers via IPC/TCP
 */

const { createStore } = require("../dist/cjs/index.js");

// Same reducer as server
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
            type: action.payload.type || "web",
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

console.log("🌐 Starting WebSocket client for cross-library demo...");

// Create store
const store = createStore(todoReducer);

// Connect to WebSocket server
store.createWSClient({
  host: "ws://127.0.0.1",
  port: 8890,
  login: "web-client",
  password: "web123",
});

const clientName = `WebSocket Client ${process.pid}`;

// Wait for connection and add user
setTimeout(() => {
  if (store.connected) {
    store.dispatch({
      type: "ADD_USER",
      payload: { name: clientName, type: "web" },
    });

    console.log(`✅ Connected as "${clientName}"`);
  }
}, 1000);

// Subscribe to state changes
store.subscribe(() => {
  const state = store.getState();
  console.log(`\\n📊 Current state:`);
  console.log(`   Todos: ${state.todos.length}`);
  console.log(`   Users: ${state.users.length}`);
  console.log(`   Total created: ${state.stats.total}`);

  if (state.todos.length > 0) {
    console.log(`\\n📝 Recent todos:`);
    state.todos.slice(-3).forEach((todo) => {
      const status = todo.completed ? "✅" : "⏳";
      console.log(`   ${status} "${todo.text}" by ${todo.createdBy}`);
    });
  }

  if (state.users.length > 0) {
    console.log(`\\n👥 Connected users:`);
    state.users.forEach((user) => {
      const icon = user.type === "cluster" ? "🔧" : "🌐";
      console.log(`   ${icon} ${user.name} (${user.type})`);
    });
  }
});

// Interactive commands
process.stdin.setEncoding("utf8");
console.log("\\n📋 Commands:");
console.log('  Type "add <text>" to add a todo');
console.log('  Type "toggle <id>" to toggle a todo');
console.log('  Type "list" to show current state');
console.log('  Type "quit" to exit');
console.log("\\n> ");

process.stdin.on("data", (input) => {
  const command = input.trim();

  if (command.startsWith("add ")) {
    const text = command.substring(4);
    if (text) {
      store.dispatch({
        type: "ADD_TODO",
        payload: {
          text,
          user: clientName,
        },
      });
      console.log(`✅ Added todo: "${text}"`);
    }
  } else if (command.startsWith("toggle ")) {
    const id = parseInt(command.substring(7));
    if (id) {
      store.dispatch({
        type: "TOGGLE_TODO",
        payload: { id },
      });
      console.log(`🔄 Toggled todo ${id}`);
    }
  } else if (command === "list") {
    const state = store.getState();
    console.log("\\n📋 Current todos:");
    state.todos.forEach((todo) => {
      const status = todo.completed ? "✅" : "⏳";
      console.log(
        `   ${todo.id}: ${status} "${todo.text}" by ${todo.createdBy}`
      );
    });
  } else if (command === "quit") {
    console.log("👋 Goodbye!");
    process.exit(0);
  } else if (command) {
    console.log(
      '❌ Unknown command. Use "add <text>", "toggle <id>", "list", or "quit"'
    );
  }

  process.stdout.write("> ");
});

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\\n👋 Disconnecting...");
  if (store.connected) {
    store.dispatch({
      type: "REMOVE_USER",
      payload: { name: clientName },
    });
  }
  process.exit(0);
});
