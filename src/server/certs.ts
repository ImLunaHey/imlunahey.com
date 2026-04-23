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
      const url = `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`crt.sh ${res.status}`);
      const rows = (await res.json()) as CrtShRow[];
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

function simplifyIssuer(raw: string): string {
  // crt.sh returns X.500 DN; pull the O= if present, else CN=
  const o = /O=([^,]+)/.exec(raw);
  if (o) return o[1].trim();
  const cn = /CN=([^,]+)/.exec(raw);
  return cn ? cn[1].trim() : raw.slice(0, 80);
}
