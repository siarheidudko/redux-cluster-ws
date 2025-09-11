
# Redux-Cluster-WS

WebSocket wrapper for Redux-Cluster library with TypeScript support.

[![npm](https://img.shields.io/npm/v/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
[![npm](https://img.shields.io/npm/dy/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
[![License](https://img.shields.io/npm/l/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
![GitHub last commit](https://img.shields.io/github/last-commit/siarheidudko/redux-cluster-ws.svg)
![GitHub release](https://img.shields.io/github/release/siarheidudko/redux-cluster-ws.svg)

## Features

- 🚀 **Modern TypeScript**: Built with TypeScript for better type safety and developer experience
- 🔄 **Redux-Cluster v2**: Compatible with the latest <redux-cluster@2.x>
- 🌐 **WebSocket**: Uses native WebSocket instead of Socket.IO for better performance
- 📦 **Dual Package**: Supports both ESM and CommonJS
- 🔒 **Secure**: Built-in authentication and IP banning
- 🛠 **Lightweight**: Minimal dependencies using @sergdudko/objectstream and protoobject

## Installation

```bash
npm install redux-cluster-ws redux-cluster redux ws
```

**Note**: `ws` is a peer dependency required for Node.js environments.

## Quick Start

### Server Setup

```typescript
import { createStore } from 'redux-cluster';
import { server } from 'redux-cluster-ws';

// Your reducer
function myReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    default:
      return state;
  }
}

// Create store
const store = createStore(myReducer);

// Add WebSocket server capability
server(store);
store.mode = 'snapshot'; // or 'action'

// Start WebSocket server
store.createWSServer({
  host: '0.0.0.0',
  port: 8888,
  logins: {
    'user1': 'password123',
    'user2': 'secret456'
  }
});
```

### Client Setup (Node.js)

```typescript
import { createStore } from 'redux-cluster';
import { client } from 'redux-cluster-ws';

// Same reducer as server
function myReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    default:
      return state;
  }
}

// Create store
const store = createStore(myReducer);

// Add WebSocket client capability
client(store);

// Connect to server
store.createWSClient({
  host: 'ws://localhost',
  port: 8888,
  login: 'user1',
  password: 'password123'
});

// Dispatch actions
store.dispatch({ type: 'INCREMENT' });
```

### Client Setup (Browser)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { createStore, client } from 'redux-cluster-ws';
    
    function myReducer(state = { count: 0 }, action) {
      switch (action.type) {
        case 'INCREMENT':
          return { count: state.count + 1 };
        default:
          return state;
      }
    }
    
    const store = createStore(myReducer);
    client(store);
    
    store.createWSClient({
      host: 'ws://localhost',
      port: 8888,
      login: 'user1',
      password: 'password123'
    });
    
    // Listen for state changes
    store.subscribe(() => {
      console.log('New state:', store.getState());
    });
    
    // Dispatch actions
    document.getElementById('btn').onclick = () => {
      store.dispatch({ type: 'INCREMENT' });
    };
  </script>
</head>
<body>
  <button id="btn">Increment</button>
</body>
</html>
```

## API Reference

### Server Configuration

```typescript
interface WSServerConfig {
  host?: string;          // Default: '0.0.0.0'
  port?: number;          // Default: 10002
  server?: any;           // HTTP/HTTPS server instance
  logins?: Record<string, string>; // login-password pairs
  ssl?: {
    key: string;          // Path to SSL key file
    cert: string;         // Path to SSL certificate file  
    ca?: string;          // Path to SSL CA file
  };
}
```

### Client Configuration

```typescript
interface WSClientConfig {
  host: string;           // Server host (with protocol: ws:// or wss://)
  port?: number;          // Default: 10002
  login: string;          // Authentication login
  password: string;       // Authentication password
  reconnectInterval?: number; // Default: 10000ms
  timeout?: number;       // Default: 30000ms
}
```

### SSL/HTTPS Support

```typescript
// Server with SSL
store.createWSServer({
  host: '0.0.0.0',
  port: 8888,
  logins: { 'user': 'pass' },
  ssl: {
    key: '/path/to/private-key.pem',
    cert: '/path/to/certificate.pem',
    ca: '/path/to/ca-certificate.pem' // optional
  }
});

// Client connecting to SSL server
store.createWSClient({
  host: 'wss://example.com', // note wss:// protocol
  port: 8888,
  login: 'user',
  password: 'pass'
});
```

## Security Features

- **Authentication**: Login/password based authentication
- **IP Banning**: Automatic IP banning after failed authentication attempts
- **Encrypted Credentials**: Passwords are hashed using SHA-1
- **Connection Limits**: Built-in protection against brute force attacks

## Migration from v1.x

The v2.0 introduces several breaking changes:

1. **WebSocket Library**: Changed from Socket.IO to native WebSocket
2. **TypeScript**: Full TypeScript rewrite with proper type definitions
3. **Build System**: Now builds both ESM and CommonJS
4. **Dependencies**: Updated to use <redux-cluster@2.x> and latest libraries
5. **API Changes**: Simplified API with better error handling

### Migration Example

**v1.x:**

```javascript
const ReduxClusterWS = require('redux-cluster-ws');
const store = ReduxClusterWS.createStore(reducer);
```

**v2.x:**

```typescript
import { createStore } from 'redux-cluster';
import { client } from 'redux-cluster-ws';

const store = createStore(reducer);
client(store);
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run only Node.js tests
npm run test:node

# Run browser tests (starts test server)
npm run test:browser
```

## Testing

The package includes comprehensive tests for both Node.js and browser environments:

- **Node.js Tests**: Located in `tests/node.test.cjs`
- **Browser Tests**: Located in `tests/browser/` with a test server

Run browser tests by executing `npm run test:browser` and opening <http://localhost:3000> in your browser.

## Compatibility

- **Node.js**: >= 16.0.0  
- **Redux**: ^5.0.0
- **Redux-Cluster**: ^2.0.0
- **WebSocket**: Uses native WebSocket API or `ws` library
- **TypeScript**: Full type definitions included

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 💖 [Donate](http://dudko.dev/donate)
- ☕ [Buy me a coffee](https://www.buymeacoffee.com/dudko.dev)
- 💳 [PayPal](https://paypal.me/dudkodev)
- 🎖 [Patreon](https://patreon.com/dudko_dev)

## Related Projects

- [redux-cluster](https://github.com/siarheidudko/redux-cluster) - Core cluster synchronization library
- [redux](https://github.com/reduxjs/redux) - Predictable state container for JavaScript apps
