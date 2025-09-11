# Redux-Cluster-WS Examples

This directory contains comprehensive examples demonstrating different usage patterns of Redux-Cluster-WS v2.0.

## 📁 Available Examples

### Basic WebSocket Examples

1. **`server.cjs`** - WebSocket server implementation
   - Authentication system
   - Connection management
   - Todo list application
   - Real-time synchronization

2. **`client.cjs`** - Interactive Node.js client
   - Command-line interface
   - Real-time state updates
   - Todo management
   - User interaction

3. **`browser.html`** - Browser-based client
   - Web UI for todo management
   - Real-time updates
   - Connection status monitoring
   - Statistics display

### Cross-Library Integration Examples

4. **`cross-library-server.cjs`** - Hybrid architecture server
   - Redux-Cluster for IPC/TCP (worker processes)
   - Redux-Cluster-WS for WebSocket (web clients)
   - Shared state management
   - Multi-protocol support

5. **`cross-library-client.cjs`** - Node.js client for hybrid setup
   - WebSocket connection to hybrid server
   - Interactive CLI
   - Real-time synchronization with both workers and web clients

6. **`cross-library-browser.html`** - Browser client for hybrid setup
   - Beautiful web interface
   - Real-time todo management
   - User statistics
   - Architecture documentation

## 🚀 Running the Examples

### Basic WebSocket Demo

1. **Start the server:**

   ```bash
   cd examples
   node server.cjs
   ```

   - Server starts on `ws://localhost:8088`
   - Authentication: `admin/password123` or `user/secret456`

2. **Connect Node.js client:**

   ```bash
   # In another terminal
   node client.cjs
   ```

   - Interactive CLI for todo management
   - Real-time synchronization

3. **Open browser client:**

   ```bash
   # Open in browser
   open browser.html
   # or
   python -m http.server 8000
   # then visit http://localhost:8000/browser.html
   ```

### Cross-Library Integration Demo

1. **Start the hybrid server:**

   ```bash
   node cross-library-server.cjs
   ```

   - Creates master process + 2 worker processes (IPC)
   - WebSocket server on port 8890
   - Shared todo application state

2. **Connect Node.js client:**

   ```bash
   # In another terminal
   node cross-library-client.cjs
   ```

   - WebSocket connection to hybrid server
   - Interactive todo management
   - See updates from all participants

3. **Open browser client:**

   ```bash
   # Open in browser
   open cross-library-browser.html
   ```

   - Beautiful web interface
   - Real-time synchronization with workers and other clients

## 🏗️ Architecture Examples

### Basic WebSocket Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Browser       │◄────────────────►│  Server         │
│   Client        │                  │  (Node.js)      │
└─────────────────┘                  └─────────────────┘
                                              │
┌─────────────────┐    WebSocket             │
│   Node.js       │◄─────────────────────────┘
│   Client        │
└─────────────────┘
```

### Cross-Library Hybrid Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Browser       │◄────────────────►│                 │
│   Clients       │                  │                 │
└─────────────────┘                  │                 │
                                     │   Master        │
┌─────────────────┐    WebSocket     │   Process       │
│   Node.js       │◄────────────────►│                 │
│   Clients       │                  │                 │
└─────────────────┘                  │                 │
                                     └─────────┬───────┘
                                               │
                                           IPC/TCP
                                               │
┌─────────────────┐    IPC/TCP       ┌────────▼───────┐
│   Worker        │◄────────────────►│   Worker        │
│   Process 1     │                  │   Process 2     │
└─────────────────┘                  └─────────────────┘
```

## 📊 Feature Comparison

| Feature | Basic Examples | Cross-Library Examples |
|---------|---------------|----------------------|
| WebSocket Server | ✅ | ✅ |
| Node.js Client | ✅ | ✅ |
| Browser Client | ✅ | ✅ |
| Worker Processes | ❌ | ✅ |
| IPC Communication | ❌ | ✅ |
| Hybrid Architecture | ❌ | ✅ |
| Multi-Protocol | ❌ | ✅ |

## 🔧 Configuration

### Server Configuration

```javascript
// Basic WebSocket server
const config = {
  port: 8080,
  auth: {
    'admin': 'password123',
    'user': 'secret456'
  },
  ips: ['127.0.0.1'],  // Optional: restrict IPs
  limit: 100           // Optional: connection limit
};

// Cross-library server
const hybridConfig = {
  // Redux-Cluster config
  worker: {
    count: 2,
    file: __filename
  },
  // WebSocket config
  wsPort: 8890,
  auth: {
    'web-client': 'web123',
    'node-client': 'node456'
  }
};
```

### Client Configuration

```javascript
// WebSocket client
const clientConfig = {
  host: '127.0.0.1',
  port: 8080,
  login: 'admin',
  password: 'password123'
};

// Cross-library client
const hybridClientConfig = {
  host: '127.0.0.1',
  port: 8890,
  login: 'web-client',
  password: 'web123'
};
```

## 🧪 Testing the Examples

### Manual Testing

1. **State Synchronization:**
   - Start server and multiple clients
   - Add/toggle todos in one client
   - Verify changes appear in all other clients

2. **Connection Management:**
   - Connect/disconnect clients
   - Verify proper cleanup
   - Check connection limits

3. **Authentication:**
   - Try connecting with wrong credentials
   - Verify rejection
   - Test multiple user types

### Automated Testing

```bash
# Run integration tests
node ../tests/simplified-integration.test.cjs

# Expected output:
# ✅ WebSocket server/client communication
# ✅ State synchronization works
# ✅ Cross-client communication functional
```

## 🔍 Debugging

### Enable Debug Logs

```bash
# Enable verbose logging
DEBUG=redux-cluster-ws:* node server.cjs
```

### Common Issues

1. **Connection Failed:**
   - Check server is running
   - Verify port is not blocked
   - Check authentication credentials

2. **State Not Syncing:**
   - Verify all clients use same store structure
   - Check reducer compatibility
   - Look for dispatch errors

3. **Performance Issues:**
   - Monitor connection count
   - Check for memory leaks
   - Verify proper cleanup

## 📚 Learning Path

1. **Start with basic examples** to understand WebSocket communication
2. **Explore cross-library examples** to see hybrid architecture benefits
3. **Modify the todo application** to add your own features
4. **Create your own reducer** to see custom state management
5. **Build production application** using the patterns shown

## 🤝 Contributing

Want to add more examples? Please:

1. Follow the existing code style
2. Add comprehensive comments
3. Include usage instructions
4. Test thoroughly
5. Update this README

## 📄 License

These examples are provided under the same MIT license as the main project.
