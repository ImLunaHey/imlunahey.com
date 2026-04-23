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
}

declare module 'cloudflare:workers' {
  export class DurableObject {
    constructor(state: DurableObjectState, env: unknown);
  }
  export const env: {
    PRESENCE_DO: DurableObjectNamespace;
    [key: string]: unknown;
  };
}
