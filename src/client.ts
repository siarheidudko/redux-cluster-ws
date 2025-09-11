import {
  createStore as createReduxStore,
  Reducer,
  AnyAction,
  Dispatch,
} from "redux";
import {
  WSClientConfig,
  ReduxClusterStore,
  ReduxClusterMessage,
  ReduxClusterWSClient,
} from "./types.js";
import { hasher, deepClone } from "./utils.js";

// Global types for browser compatibility
declare const window: any;
declare const global: any;

// WebSocket compatibility for both browser and Node.js
const WebSocketClass = (() => {
  if (typeof window !== "undefined" && window.WebSocket) {
    return window.WebSocket;
  }
  if (typeof global !== "undefined" && global.WebSocket) {
    return global.WebSocket;
  }
  try {
    return require("ws");
  } catch {
    throw new Error("WebSocket implementation not found");
  }
})();

export class ReduxCluster<S = any, A extends AnyAction = AnyAction>
  implements ReduxClusterStore<S, A>
{
  public stderr: (message: string) => void = console.error;
  public role: string[] = [];
  public mode: "action" | "snapshot" = "action";
  public connected: boolean = true;
  public resync: number = 1000;
  public RCHash: string;
  public version: string;
  public homepage: string;
  public createWSClient?: (config: WSClientConfig) => void;

  private store: ReturnType<typeof createReduxStore>;
  private altReducer: Reducer<S, A>;
  private defaultState: S;
  private static reducers: Record<string, string> = {};

  constructor(reducer: Reducer<S, A>) {
    this.altReducer = reducer;
    this.RCHash = hasher(reducer.name);

    // Get version and homepage from package.json (would need to be injected in real implementation)
    this.version = "2.0.0";
    this.homepage = "https://github.com/siarheidudko/redux-cluster-ws";

    // Check for duplicate reducer names
    if (ReduxCluster.reducers[reducer.name]) {
      throw new Error("Please don't use a reducer with the same name!");
    }
    ReduxCluster.reducers[reducer.name] = this.RCHash;

    // Get default state
    try {
      const defaultState = this.altReducer(undefined as any, {} as A);
      if (typeof defaultState === "object" && defaultState !== null) {
        this.defaultState = defaultState;
      } else {
        throw new Error("The returned value is not an object.");
      }
    } catch (error) {
      this.defaultState = {} as S;
    }

    // Create new reducer that handles sync actions
    const newReducer = (state: S = this.defaultState, action: A): S => {
      if ((action as any).type === "REDUX_CLUSTER_SYNC") {
        return deepClone((action as any).payload);
      } else {
        return this.altReducer(state, action);
      }
    };

    // Create Redux store
    this.store = createReduxStore(newReducer);
  }

  // Redux Store interface implementation
  public getState(): S {
    return this.store.getState() as S;
  }

  public dispatch = (action: any): any => {
    return this.store.dispatch(action);
  };

  public subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  public replaceReducer(nextReducer: Reducer<S, A>): void {
    throw new Error("replaceReducer is not supported in ReduxCluster");
  }

  public [Symbol.observable]() {
    return this.store[Symbol.observable]();
  }
}

export class ReduxClusterWSClientWrapper implements ReduxClusterWSClient {
  public store: ReduxClusterStore;
  public config: WSClientConfig;
  public ws?: WebSocket;
  public reconnectTimer?: NodeJS.Timeout;
  public authenticated: boolean = false;
  public login: string;
  public password: string;

  private originalDispatch: any;

  constructor(store: ReduxClusterStore, config: WSClientConfig) {
    this.store = store;
    this.config = {
      port: 10002,
      reconnectInterval: 10000,
      timeout: 30000,
      ...config,
    };

    // Validate config
    if (!config.host) {
      throw new Error("Config requires server address!");
    }
    if (!config.login) {
      throw new Error("Config requires login for server authorization!");
    }
    if (!config.password) {
      throw new Error("Config requires password for server authorization!");
    }

    // Setup authentication
    this.login = hasher(`REDUX_CLUSTER${config.login}`);
    this.password = hasher(`REDUX_CLUSTER${config.password}`);

    // Override dispatch method
    this.originalDispatch = this.store.dispatch;
    this.store.dispatch = this.dispatch.bind(this) as any;

    // Add client role
    if (!this.store.role.includes("client")) {
      this.store.role.push("client");
    } else {
      throw new Error(
        "One storage cannot be connected to two servers at the same time."
      );
    }

    this.store.connected = false;
    this.reconnect();
  }

  public reconnect = (): void => {
    try {
      const url = this.buildWebSocketURL();
      this.ws = new WebSocketClass(url);

      if (this.ws) {
        this.ws.onopen = () => {
          this.sendMessage({
            _msg: "REDUX_CLUSTER_SOCKET_AUTH",
            _hash: this.store.RCHash,
            _login: this.login,
            _password: this.password,
          });
        };

        this.ws.onmessage = (event: any) => {
          try {
            const data =
              typeof event.data === "string"
                ? event.data
                : event.data.toString();
            const message: ReduxClusterMessage = JSON.parse(data);
            this.handleMessage(message);
          } catch (error) {
            this.store.stderr(
              `ReduxCluster.createWSClient message parse error: ${error}`
            );
          }
        };

        this.ws.onclose = () => {
          this.authenticated = false;
          this.store.connected = false;
          this.scheduleReconnect();
        };

        this.ws.onerror = (error: any) => {
          this.store.stderr(
            `ReduxCluster.createWSClient connection error: ${error}`
          );
          this.authenticated = false;
          this.store.connected = false;
        };
      }
    } catch (error) {
      this.store.stderr(`ReduxCluster.createWSClient client error: ${error}`);
      this.store.connected = false;
      this.scheduleReconnect();
    }
  };

  private buildWebSocketURL(): string {
    const protocol = this.config.host.toLowerCase().includes("https://")
      ? "wss:"
      : "ws:";
    const host = this.config.host.replace(/^https?:\/\//, "");
    const path = `/redux-cluster-${this.store.RCHash}`;

    return `${protocol}//${host}:${this.config.port}${path}`;
  }

  private handleMessage = (message: ReduxClusterMessage): void => {
    if (message._hash !== this.store.RCHash) {
      return;
    }

    switch (message._msg) {
      case "REDUX_CLUSTER_MSGTOWORKER":
        if (message._action) {
          this.originalDispatch(message._action);
        }
        break;

      case "REDUX_CLUSTER_SOCKET_AUTHSTATE":
        if (message._value === true) {
          this.authenticated = true;
          this.store.connected = true;
          this.sendMessage({
            _msg: "REDUX_CLUSTER_START",
            _hash: this.store.RCHash,
          });
        } else {
          this.authenticated = false;
          this.store.connected = false;
          if (message._banned) {
            this.store.stderr("Your IP is locked for 3 hours");
          } else {
            this.store.stderr("Authorization failed");
          }
          this.ws?.close();
        }
        break;
    }
  };

  private dispatch = (action: AnyAction): AnyAction => {
    try {
      if (this.ws && this.ws.readyState === 1 && this.authenticated) {
        // WebSocket.OPEN = 1
        this.sendMessage({
          _msg: "REDUX_CLUSTER_MSGTOMASTER",
          _hash: this.store.RCHash,
          _action: action,
        });
      } else {
        this.store.stderr("WebSocket is not connected or not authenticated");
      }
    } catch (error) {
      this.store.stderr(`ReduxCluster.createWSClient write error: ${error}`);
    }
    return action;
  };

  private sendMessage = (message: ReduxClusterMessage): void => {
    if (this.ws && this.ws.readyState === 1) {
      // WebSocket.OPEN = 1
      this.ws.send(JSON.stringify(message));
    }
  };

  private scheduleReconnect = (): void => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, this.config.reconnectInterval);
  };

  public destroy = (): void => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
    }

    // Restore original dispatch
    this.store.dispatch = this.originalDispatch;
  };
}

export function createStore<S = any, A extends AnyAction = AnyAction>(
  reducer: Reducer<S, A>
): ReduxClusterStore<S, A> {
  const reduxCluster = new ReduxCluster(reducer);

  reduxCluster.createWSClient = (config: WSClientConfig) => {
    return new ReduxClusterWSClientWrapper(reduxCluster, config);
  };

  return reduxCluster;
}

export function client<S = any>(
  store: ReduxClusterStore<S>
): ReduxClusterStore<S> {
  // Add createWSClient method to existing redux-cluster store
  if (!store.createWSClient) {
    store.createWSClient = (config: WSClientConfig) => {
      return new ReduxClusterWSClientWrapper(store, config);
    };
  }
  return store;
}
