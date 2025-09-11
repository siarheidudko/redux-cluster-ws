import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "fs";
import { IncomingMessage } from "http";
import {
  WSServerConfig,
  ReduxClusterStore,
  ReduxClusterMessage,
  WSConnection,
  AuthDatabase,
  IPBanDatabase,
  ReduxClusterWSServer,
} from "./types.js";
import { hasher, replacer, generateUID } from "./utils.js";

// Import WebSocket server for Node.js
import { WebSocketServer } from "ws";

export class ReduxClusterWSServerWrapper implements ReduxClusterWSServer {
  public store: ReduxClusterStore;
  public uid: string;
  public connections: Map<string, WSConnection>;
  public authDatabase: AuthDatabase;
  public ipBanDatabase: IPBanDatabase;
  public config: WSServerConfig;
  public server?: any;
  public wss?: any;
  public unsubscribe?: () => void;

  private readonly IP_BAN_ATTEMPTS = 15;
  private readonly IP_BAN_TIMEOUT = 10800000; // 3 hours
  private readonly CONNECTION_TIMEOUT = 30000;
  private gcInterval?: any;

  constructor(store: ReduxClusterStore) {
    this.store = store;
    this.uid = generateUID();
    this.connections = new Map();
    this.authDatabase = {};
    this.ipBanDatabase = {};
    this.config = { host: "0.0.0.0", port: 10002 };

    // Attach createWSServer method to store
    store.createWSServer = this.createWSServer.bind(this);
  }

  private createWSServer = (config: WSServerConfig): void => {
    this.config = { ...this.config, ...config };

    // Setup authentication database
    if (this.config.logins) {
      for (const [login, password] of Object.entries(this.config.logins)) {
        const hashedLogin = hasher(`REDUX_CLUSTER${login}`);
        const hashedPassword = hasher(`REDUX_CLUSTER${password}`);
        this.authDatabase[hashedLogin] = hashedPassword;
      }
    }

    // Start garbage collection for banned IPs
    this.startGarbageCollection();

    // Create HTTP/HTTPS server if not provided
    if (!this.config.server) {
      if (this.config.ssl?.key && this.config.ssl?.cert) {
        const ssl = {
          key: readFileSync(this.config.ssl.key),
          cert:
            readFileSync(this.config.ssl.cert) +
            (this.config.ssl.ca ? "\n" + readFileSync(this.config.ssl.ca) : ""),
        };
        this.server = createHttpsServer(ssl);
      } else {
        this.server = createHttpServer();
      }

      this.server.setTimeout(this.CONNECTION_TIMEOUT);
      this.server.listen(this.config.port, this.config.host);
    } else {
      this.server = this.config.server;
    }

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: `/redux-cluster-${this.store.RCHash}`,
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    // Subscribe to store changes
    this.unsubscribe = this.store.subscribe(() => {
      if (this.store.mode === "snapshot") {
        this.sendToAll();
      }
    });

    // For action mode, override dispatch to send individual actions
    if (this.store.mode === "action") {
      const originalDispatch = this.store.dispatch;
      this.store.dispatch = (action: any) => {
        const result = originalDispatch(action);
        // Send the action to all connected clients
        if (action.type !== "@@INIT" && action.type !== "REDUX_CLUSTER_SYNC") {
          this.sendToAll({
            _msg: "REDUX_CLUSTER_MSGTOWORKER",
            _hash: this.store.RCHash,
            _action: action,
          });
        }
        return result;
      };
    }

    // Add server role
    if (!this.store.role.includes("server")) {
      this.store.role.push("server");
    }
  };

  private handleConnection = (ws: any, req: IncomingMessage): void => {
    const connectionId = generateUID();
    const ip = this.extractIP(req);
    const processedIP = replacer(ip, true);

    // Check if IP is banned
    if (this.isIPBanned(processedIP)) {
      this.sendMessage(ws, {
        _msg: "REDUX_CLUSTER_SOCKET_AUTHSTATE",
        _hash: this.store.RCHash,
        _value: false,
        _banned: true,
      });
      ws.close();
      return;
    }

    const connection: WSConnection = {
      id: connectionId,
      ws,
      authenticated: false,
      ip: processedIP,
    };

    this.connections.set(connectionId, connection);

    ws.on("message", (data: any) => {
      try {
        const message: ReduxClusterMessage = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        this.store.stderr(
          `ReduxCluster.createWSServer message parse error: ${error}`
        );
        this.removeConnection(connectionId);
      }
    });

    ws.on("close", () => {
      this.removeConnection(connectionId);
    });

    ws.on("error", (error: any) => {
      this.store.stderr(
        `ReduxCluster.createWSServer connection error: ${error.message}`
      );
      this.removeConnection(connectionId);
    });
  };

  private handleMessage = (
    connectionId: string,
    message: ReduxClusterMessage
  ): void => {
    const connection = this.connections.get(connectionId);
    if (!connection || message._hash !== this.store.RCHash) {
      return;
    }

    switch (message._msg) {
      case "REDUX_CLUSTER_SOCKET_AUTH":
        this.handleAuthentication(connectionId, message);
        break;

      case "REDUX_CLUSTER_START":
        if (connection.authenticated) {
          this.sendMessage(connection.ws, {
            _msg: "REDUX_CLUSTER_MSGTOWORKER",
            _hash: this.store.RCHash,
            _action: {
              type: "REDUX_CLUSTER_SYNC",
              payload: this.store.getState(),
            },
          });
        }
        break;

      case "REDUX_CLUSTER_MSGTOMASTER":
        if (connection.authenticated && message._action) {
          if (message._action.type === "REDUX_CLUSTER_SYNC") {
            throw new Error("Please don't use REDUX_CLUSTER_SYNC action type!");
          }
          this.store.dispatch(message._action);
        }
        break;
    }
  };

  private handleAuthentication = (
    connectionId: string,
    message: ReduxClusterMessage
  ): void => {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { _login, _password } = message;

    if (
      _login &&
      _password &&
      this.authDatabase[_login] &&
      this.authDatabase[_login] === _password
    ) {
      // Authentication successful
      connection.authenticated = true;
      this.clearIPBan(connection.ip);

      this.sendMessage(connection.ws, {
        _msg: "REDUX_CLUSTER_SOCKET_AUTHSTATE",
        _hash: this.store.RCHash,
        _value: true,
      });
    } else {
      // Authentication failed
      this.recordFailedAttempt(connection.ip);

      this.sendMessage(connection.ws, {
        _msg: "REDUX_CLUSTER_SOCKET_AUTHSTATE",
        _hash: this.store.RCHash,
        _value: false,
      });

      this.removeConnection(connectionId);
    }
  };

  public sendToAll = (message?: ReduxClusterMessage): void => {
    const msg = message || {
      _msg: "REDUX_CLUSTER_MSGTOWORKER",
      _hash: this.store.RCHash,
      _action: { type: "REDUX_CLUSTER_SYNC", payload: this.store.getState() },
    };

    for (const connection of this.connections.values()) {
      if (connection.authenticated && connection.ws.readyState === 1) {
        // WebSocket.OPEN = 1
        try {
          this.sendMessage(connection.ws, msg);
        } catch (error) {
          this.store.stderr(
            `ReduxCluster.createWSServer write error: ${error}`
          );
        }
      }
    }
  };

  private sendMessage = (ws: any, message: ReduxClusterMessage): void => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  };

  private extractIP = (req: IncomingMessage): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return req.socket.remoteAddress || "127.0.0.1";
  };

  private isIPBanned = (ip: string): boolean => {
    const banInfo = this.ipBanDatabase[ip];
    if (!banInfo) return false;

    const isTimedOut = banInfo.time + this.IP_BAN_TIMEOUT < Date.now();
    if (isTimedOut) {
      delete this.ipBanDatabase[ip];
      return false;
    }

    return banInfo.count >= this.IP_BAN_ATTEMPTS;
  };

  private recordFailedAttempt = (ip: string): void => {
    const existing = this.ipBanDatabase[ip];
    let count = 0;

    if (existing) {
      const isTimedOut = existing.time + this.IP_BAN_TIMEOUT < Date.now();
      count = isTimedOut ? 0 : existing.count;
    }

    this.ipBanDatabase[ip] = {
      time: Date.now(),
      count: count + 1,
    };
  };

  private clearIPBan = (ip: string): void => {
    delete this.ipBanDatabase[ip];
  };

  private removeConnection = (connectionId: string): void => {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        connection.ws.close();
      } catch {
        // Ignore errors when closing
      }
      this.connections.delete(connectionId);
    }
  };

  private startGarbageCollection = (): void => {
    this.gcInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, banInfo] of Object.entries(this.ipBanDatabase)) {
        if (banInfo.time + this.IP_BAN_TIMEOUT < now) {
          delete this.ipBanDatabase[ip];
        }
      }
    }, 60000); // Run every minute
  };

  public destroy = (): void => {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    for (const connection of this.connections.values()) {
      this.removeConnection(connection.id);
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.server && this.server.close) {
      this.server.close();
    }
  };
}

export function server<S = any>(
  store: ReduxClusterStore<S>
): ReduxClusterStore<S> {
  new ReduxClusterWSServerWrapper(store);
  return store;
}
