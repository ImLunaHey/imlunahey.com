import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

export type Cert = {
  id: number;
  issuerCaId: number;
  issuerName: string;
  commonName: string;
  nameValue: string[];
  notBefore: string;
  notAfter: string;
  serialNumber: string;
  expired: boolean;
  ageDays: number;
};

type CrtShRow = {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
};

export const listCerts = createServerFn({ method: 'GET' })
  .inputValidator((data: { domain: string }) => data)
  .handler(async ({ data }): Promise<Cert[]> => {
    const domain = data.domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!/^[a-z0-9.-]+$/.test(domain)) throw new Error('invalid domain');

    return cached(`crt-sh:${domain}`, TTL.medium, async () => {
      // crt.sh's JSON endpoint is notoriously flaky — it routinely
      // returns 502/504 while the underlying query is still running.
      // Retry with short backoff; usually the second attempt succeeds.
      const url = `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`;
      const rows = await fetchJsonWithRetry<CrtShRow[]>(url, 3, 1500);
      const now = Date.now();
      const certs: Cert[] = rows.slice(0, 30).map((r) => {
        const notAfter = r.not_after + 'Z';
        const notBefore = r.not_before + 'Z';
        return {
          id: r.id,
          issuerCaId: r.issuer_ca_id,
          issuerName: simplifyIssuer(r.issuer_name),
          commonName: r.common_name,
          nameValue: (r.name_value ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
          notBefore,
          notAfter,
          serialNumber: r.serial_number,
          expired: new Date(notAfter).getTime() < now,
          ageDays: Math.floor((now - new Date(notBefore).getTime()) / 86_400_000),
        };
      });
      // sort newest first by not_before
      certs.sort((a, b) => (a.notBefore < b.notBefore ? 1 : -1));
      return certs;
    });
  });

async function fetchJsonWithRetry<T>(url: string, attempts: number, baseDelayMs: number): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return (await res.json()) as T;
      // 5xx + 429: retry; 4xx (non-429): give up
      if (res.status < 500 && res.status !== 429) throw new Error(`crt.sh ${res.status}`);
      lastErr = new Error(`crt.sh ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('crt.sh request failed');
}

function simplifyIssuer(raw: string): string {
  // crt.sh returns X.500 DN; pull the O= if present, else CN=
  const o = /O=([^,]+)/.exec(raw);
  if (o) return o[1].trim();
  const cn = /CN=([^,]+)/.exec(raw);
  return cn ? cn[1].trim() : raw.slice(0, 80);
}
