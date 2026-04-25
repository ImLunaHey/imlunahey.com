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

declare module 'cloudflare:workers' {
  export class DurableObject {
    /** Cloudflare's runtime exposes the state as `ctx` on the instance. */
    protected readonly ctx: DurableObjectState;
    constructor(state: DurableObjectState, env: unknown);
    /** Hibernation lifecycle hooks — implement on subclasses that use
     *  `state.acceptWebSocket()`. */
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
  }
  export const env: {
    PRESENCE_DO: DurableObjectNamespace;
    ATRIUM_DO: DurableObjectNamespace;
    [key: string]: unknown;
  };
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
