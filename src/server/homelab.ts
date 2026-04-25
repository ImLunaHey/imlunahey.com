import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import type { HostBlob, HomelabState, ServicesBlob } from './homelab-types';

// KV reader for the homelab page. Telemetry is written by
// /api/homelab/ingest (see src/routes/api/homelab.ingest.tsx) which is
// kept inline so this file — imported by the page — doesn't drag the
// ingest helpers (which use `env`) into the client bundle. createServerFn
// gets a proper client-side stub from the TanStack plugin, so the
// `env` import here only resolves on the worker side.
//
// KV layout:
//   homelab:host:<hostname>  → HostBlob
//   homelab:services         → ServicesBlob
//
// Empty/missing KV → empty snapshot, the page falls back to its
// editorial defaults rather than rendering blank.

export type {
  HostBlob,
  HostData,
  HomelabState,
  ServiceRow,
  ServicesBlob,
} from './homelab-types';

export const getHomelabState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HomelabState> => {
    const kv = env.HOMELAB;
    if (!kv) return { hosts: {}, services: null };

    const list = await kv.list({ prefix: 'homelab:host:', limit: 64 });
    const hostBlobs = await Promise.all(
      list.keys.map((k) => kv.get<HostBlob>(k.name, { type: 'json' })),
    );

    const hosts: HomelabState['hosts'] = {};
    for (const b of hostBlobs) {
      if (b && typeof b.host === 'string') {
        hosts[b.host] = { ts: b.ts, data: b.data };
      }
    }

    const services = await kv.get<ServicesBlob>('homelab:services', { type: 'json' });
    return {
      hosts,
      services: services
        ? { ts: services.ts, source: services.source, data: services.data }
        : null,
    };
  },
);
