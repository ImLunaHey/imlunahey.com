// Minimal Cloudflare Workers runtime types — only what the codebase uses.
// If we start leaning on more CF APIs, install @cloudflare/workers-types
// and drop this file.

interface DurableObjectId {}

type DurableObjectRpc<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

type DurableObjectStub<T = unknown> = DurableObjectRpc<T>;

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<T>;
}

interface DurableObjectState {
  readonly id: DurableObjectId;
  /** Hibernatable websocket API — see CF docs.
   *  Once accepted, the DO can suspend while the WS is open and is woken on
   *  incoming messages via the `webSocket*` lifecycle hooks. */
  acceptWebSocket(ws: WebSocket): void;
  /** Returns every WebSocket previously passed to `acceptWebSocket` that's
   *  still open. Survives DO hibernation. */
  getWebSockets(): WebSocket[];
}

interface WebSocket {
  /** Persists arbitrary JSON-serialisable state alongside this WS so it
   *  survives DO hibernation. Must be called after acceptWebSocket. */
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** Cloudflare extension: a paired client+server WebSocket created by
 *  `new WebSocketPair()`. The server half is `accept()`-ed (or, for
 *  hibernation, passed to `acceptWebSocket`); the client half is returned
 *  to the requester via `new Response(null, { status: 101, webSocket })`. */
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
  constructor();
}

interface ResponseInit {
  webSocket?: WebSocket;
}

/** Minimal D1 surface — only what `src/server/atrium-state.ts` calls. If
 *  another consumer wants more (`batch`, `dump`, `exec`, etc.), grow this
 *  interface in place. */
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/** Minimal KV surface — only what the homelab ingest + page loader use. */
interface KVNamespace {
  get(key: string, options?: { type: 'text' }): Promise<string | null>;
  get<T = unknown>(key: string, options: { type: 'json' }): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
  delete(key: string): Promise<void>;
}

type AtriumEnv = {
  PRESENCE_DO: DurableObjectNamespace;
  ATRIUM_DO: DurableObjectNamespace;
  ATRIUM_DB: D1Database;
  HOMELAB?: KVNamespace;
  [key: string]: unknown;
};

declare module 'cloudflare:workers' {
  export class DurableObject<E = AtriumEnv> {
    /** Cloudflare's runtime exposes the state as `ctx` and the env as
     *  `env` on the instance — both available in any method. */
    protected readonly ctx: DurableObjectState;
    protected readonly env: E;
    constructor(state: DurableObjectState, env: E);
    /** Hibernation lifecycle hooks — implement on subclasses that use
     *  `state.acceptWebSocket()`. */
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
  }
  export const env: AtriumEnv;
}

// Cloudflare exposes a non-standard `default` cache on `caches` that's used
// across the workers runtime — not present in the DOM `CacheStorage` lib.
interface CacheStorage {
  readonly default: Cache;
}

// Vite's `?module` query returns a compiled `WebAssembly.Module` — used by
// the OG renderer to initialise resvg in the worker.
declare module '*.wasm?module' {
  const module: WebAssembly.Module;
  export default module;
}
