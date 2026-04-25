import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { HostBlob, ServicesBlob } from '../../server/homelab-types';

/**
 * POST /api/homelab/ingest
 *
 * Accepts telemetry blobs from the homelab-agent NixOS module
 * (../../../../nixos-configs/modules/homelab-agent.nix) and writes them
 * to KV. Body is verified against `HOMELAB_AGENT_SECRET` via HMAC-SHA256;
 * the signature lives in `x-homelab-signature` (standard base64 — both
 * the bash and python paths in the agent emit standard base64). Read
 * the raw body BEFORE parsing — re-stringifying JSON changes whitespace
 * and breaks signature verification.
 *
 * The agent treats failure as best-effort, so this route can return an
 * error without consequences beyond a journalctl entry on the host.
 *
 * Verify + KV-write logic is inlined here rather than imported from
 * src/server/homelab.ts because route files are processed by the client
 * bundler too — only the POST handler itself is stripped — and importing
 * an env-touching helper would drag `cloudflare:workers` into the client
 * bundle. Keeping it here scopes that import to a file that only runs in
 * the worker.
 */

const HOST_ID_RE = /^[a-z0-9_.-]{1,64}$/;

function decodeBase64(b64: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function verifySignature(secret: string, body: string, sig: string): Promise<boolean> {
  const sigBytes = decodeBase64(sig);
  if (!sigBytes) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body));
}

export const Route = createFileRoute('/api/homelab/ingest')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.HOMELAB_AGENT_SECRET;
        if (!secret || secret.length < 32) {
          return new Response('ingest disabled — HOMELAB_AGENT_SECRET unset', { status: 503 });
        }

        const body = await request.text();
        const sig = request.headers.get('x-homelab-signature');
        if (!sig) return new Response('missing x-homelab-signature', { status: 401 });
        if (!(await verifySignature(secret, body, sig))) {
          return new Response('signature mismatch', { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response('invalid json', { status: 400 });
        }
        if (typeof payload !== 'object' || payload === null) {
          return new Response('payload must be an object', { status: 400 });
        }

        const kv = env.HOMELAB;
        if (!kv) return new Response('no kv binding', { status: 503 });

        const p = payload as { kind?: unknown };
        if (p.kind === 'host') {
          const blob = payload as HostBlob;
          if (typeof blob.host !== 'string' || !HOST_ID_RE.test(blob.host)) {
            return new Response('host must be a safe id (a-z0-9._-, ≤64)', { status: 400 });
          }
          if (typeof blob.data !== 'object' || blob.data === null) {
            return new Response('data must be an object', { status: 400 });
          }
          await kv.put(`homelab:host:${blob.host}`, JSON.stringify(blob));
          return Response.json({ ok: true, key: `homelab:host:${blob.host}` });
        }

        if (p.kind === 'services') {
          const blob = payload as ServicesBlob;
          if (!Array.isArray(blob.data)) {
            return new Response('data must be an array', { status: 400 });
          }
          await kv.put('homelab:services', JSON.stringify(blob));
          return Response.json({ ok: true, key: 'homelab:services' });
        }

        return new Response('unknown kind (expected "host" | "services")', { status: 400 });
      },
    },
  },
});
