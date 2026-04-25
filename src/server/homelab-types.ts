// Shared types for the homelab pipeline. Lives separately from
// `./homelab.ts` so the page can `import type` without dragging the
// `cloudflare:workers` env import (which only resolves in the worker
// environment) into the client bundle.

export type HostData = {
  role?: string;
  os?: string;
  cpu?: { model?: string; cores?: number };
  mem_kb?: { total: number; available: number };
  load1?: number;
  uptime_secs?: number;
  root_kb?: { total: number; used: number };
  zpools?: Array<{
    name: string;
    size_bytes: number;
    alloc_bytes: number;
    free_bytes: number;
    health: string;
  }>;
};

export type HostBlob = {
  kind: 'host';
  host: string;
  ts: number;
  data: HostData;
};

export type ServiceRow = {
  name: string;
  url?: string | null;
  status: 'up' | 'degraded' | 'down';
  latency_ms: number;
  uptime_pct: number;
};

export type ServicesBlob = {
  kind: 'services';
  source: string;
  ts: number;
  data: ServiceRow[];
};

export type HomelabState = {
  hosts: Record<string, { ts: number; data: HostData }>;
  services: { ts: number; source: string; data: ServiceRow[] } | null;
};
