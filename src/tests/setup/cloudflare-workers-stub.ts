// Vitest doesn't load @cloudflare/vite-plugin (only the dev/build vite
// config does), so the `cloudflare:workers` virtual module that plugin
// provides isn't resolvable during tests. This file is aliased in
// vitest.config.ts as a stand-in so client code that transitively imports
// server functions (e.g. via PresencePulse → server/presence.ts) can
// resolve at test time. None of this stub's surface is intended to be
// called — the server fns aren't invoked by any test today.

export class DurableObject {
  constructor(_state?: unknown, _env?: unknown) {}
}

export const env = new Proxy({} as Record<string, unknown>, {
  get(_target, prop) {
    throw new Error(
      `cloudflare:workers env.${String(prop)} accessed from test code. ` +
      `tests shouldn't execute server functions — mock them at the call site.`,
    );
  },
});
