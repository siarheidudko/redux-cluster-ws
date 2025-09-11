import type { Store, Reducer, Action, AnyAction, Dispatch } from "redux";

export interface WSServerConfig {
  host?: string;
  port?: number;
  server?: any; // HTTP/HTTPS server instance
  logins?: Record<string, string>;
  ssl?: {
    key: string;
    cert: string;
    ca?: string;
  };
}

export interface WSClientConfig {
  host: string;
  port?: number;
  login: string;
  password: string;
  reconnectInterval?: number;
  timeout?: number;
}

export interface ReduxClusterMessage {
  _msg: string;
  _hash: string;
  _action?: AnyAction;
  _login?: string;
  _password?: string;
  _value?: boolean;
  _banned?: boolean;
}

export interface ReduxClusterStore<S = any, A extends Action = AnyAction> {
  getState(): S;
  dispatch: Dispatch<A>;
  subscribe(listener: () => void): () => void;
  replaceReducer(nextReducer: Reducer<S, A>): void;
  [Symbol.observable](): any;
  createWSServer?: (config: WSServerConfig) => void;
  createWSClient?: (config: WSClientConfig) => void;
  RCHash: string;
  role: string[];
  mode: "action" | "snapshot";
  connected: boolean;
  stderr: (message: string) => void;
  version: string;
  homepage: string;
}

export interface WSConnection {
  id: string;
  ws: any; // WebSocket
  authenticated: boolean;
  ip: string;
}

export interface BanInfo {
  time: number;
  count: number;
}

export interface AuthDatabase {
  [hashedLogin: string]: string; // hashed password
}

export interface IPBanDatabase {
  [ip: string]: BanInfo;
}

export interface ReduxClusterWSServer {
  store: ReduxClusterStore;
  uid: string;
  connections: Map<string, WSConnection>;
  authDatabase: AuthDatabase;
  ipBanDatabase: IPBanDatabase;
  config: WSServerConfig;
  server?: any;
  wss?: any;
  sendToAll: (message?: ReduxClusterMessage) => void;
  unsubscribe?: () => void;
}

export interface ReduxClusterWSClient {
  store: ReduxClusterStore;
  config: WSClientConfig;
  ws?: any; // WebSocket
  reconnectTimer?: any; // NodeJS.Timeout
  authenticated: boolean;
  login: string;
  password: string;
  reconnect: () => void;
}
