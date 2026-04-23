import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

/**
 * RDAP-based domain lookup (modern replacement for port-43 WHOIS).
 * Flow:
 *   1. fetch IANA bootstrap to resolve which RDAP base URL owns a TLD
 *   2. GET {base}/domain/{name}, follow redirects (registrar-authoritative)
 *   3. extract registrar / dates / nameservers / status from response
 *
 * References: RFC 7480, RFC 9082, RFC 9083.
 */

const UA = 'imlunahey.com/1.0 (+https://imlunahey.com/labs/whois) rdap-client';

type BootstrapRow = [string[], string[]];
type Bootstrap = {
  version: string;
  publication: string;
  description: string;
  services: BootstrapRow[];
};

async function getBootstrap(): Promise<Bootstrap> {
  return cached('rdap:bootstrap', TTL.long, async () => {
    const res = await fetch('https://data.iana.org/rdap/dns.json', {
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`bootstrap fetch failed: ${res.status}`);
    return (await res.json()) as Bootstrap;
  });
}

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  return d;
}

function tldOf(domain: string): string | null {
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

function findBase(bs: Bootstrap, tld: string): string | null {
  for (const [tlds, bases] of bs.services) {
    if (tlds.includes(tld) && bases.length > 0) {
      return bases[0].endsWith('/') ? bases[0] : bases[0] + '/';
    }
  }
  return null;
}

type RdapEvent = { eventAction: string; eventDate?: string; eventActor?: string };
type RdapNameserver = { ldhName?: string };
type RdapVcardProp = [string, Record<string, unknown>, string, unknown];
type RdapEntity = {
  roles?: string[];
  handle?: string;
  vcardArray?: [string, RdapVcardProp[]];
  publicIds?: Array<{ type: string; identifier: string }>;
};
type RdapDomain = {
  objectClassName?: string;
  ldhName?: string;
  handle?: string;
  status?: string[];
  events?: RdapEvent[];
  nameservers?: RdapNameserver[];
  entities?: RdapEntity[];
  secureDNS?: { delegationSigned?: boolean; zoneSigned?: boolean };
  notices?: Array<{ title?: string; description?: string[] }>;
};

function vcardField(vcard: RdapVcardProp[] | undefined, name: string): string | null {
  if (!vcard) return null;
  for (const p of vcard) {
    if (p?.[0] === name && typeof p[3] === 'string') return p[3];
  }
  return null;
}

function findEntity(entities: RdapEntity[] | undefined, role: string): RdapEntity | undefined {
  return entities?.find((e) => e.roles?.includes(role));
}

export type WhoisResult = {
  domain: string;
  source: string;
  status: string[];
  registrar: string | null;
  registrarIanaId: string | null;
  registrarEmail: string | null;
  registrantCountry: string | null;
  registered: string | null;
  updated: string | null;
  expires: string | null;
  nameservers: string[];
  dnssec: boolean | null;
  rawJson: string;
};

/**
 * rdap.org is a community RDAP redirector that covers more TLDs than IANA's
 * bootstrap, including ccTLDs that joined RDAP late (.ws, .me, .co, etc.).
 * We fall through to it when the official bootstrap doesn't know a TLD.
 */
const RDAP_ORG_BASE = 'https://rdap.org/';

export const whoisLookup = createServerFn({ method: 'GET' })
  .inputValidator((data: { domain: string }) => data)
  .handler(async ({ data }): Promise<WhoisResult> => {
    const domain = normalizeDomain(data.domain);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
      throw new Error('invalid domain');
    }
    const tld = tldOf(domain);
    if (!tld) throw new Error('no tld');

    // Try IANA bootstrap first (fast, authoritative for gTLDs)
    let base: string | null = null;
    try {
      const bootstrap = await getBootstrap();
      base = findBase(bootstrap, tld);
    } catch { /* fall through to rdap.org */ }

    return cached(`rdap:domain:${domain}`, TTL.medium, async () => {
      const attempts = base ? [base, RDAP_ORG_BASE] : [RDAP_ORG_BASE];
      let lastErr: Error | null = null;
      let raw: RdapDomain | null = null;
      let sourceUrl = '';

      for (const attemptBase of attempts) {
        const url = `${attemptBase}domain/${encodeURIComponent(domain)}`;
        try {
          const res = await fetch(url, {
            headers: { accept: 'application/rdap+json', 'user-agent': UA },
            redirect: 'follow',
          });
          if (res.status === 404) { lastErr = new Error('domain not found'); continue; }
          if (!res.ok) { lastErr = new Error(`rdap ${res.status}`); continue; }
          raw = (await res.json()) as RdapDomain;
          sourceUrl = res.url || url;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error('fetch failed');
        }
      }
      if (!raw) throw lastErr ?? new Error(`no rdap server for .${tld}`);

      const reg = findEntity(raw.entities, 'registrar');
      const vcard = reg?.vcardArray?.[1];
      const registrar = vcardField(vcard, 'fn');
      const registrarEmail = vcardField(vcard, 'email');
      const registrarIanaId =
        reg?.publicIds?.find((p) => /iana/i.test(p.type))?.identifier ?? null;

      const registrant = findEntity(raw.entities, 'registrant');
      const registrantAdr = registrant?.vcardArray?.[1]?.find((p) => p[0] === 'adr');
      const registrantCountry =
        registrantAdr && Array.isArray(registrantAdr[3])
          ? (registrantAdr[3] as string[]).filter(Boolean).slice(-1)[0] ?? null
          : null;

      const findEvent = (action: string) =>
        raw.events?.find((e) => e.eventAction?.toLowerCase() === action)?.eventDate ?? null;

      return {
        domain: raw.ldhName?.toLowerCase() ?? domain,
        source: sourceUrl,
        status: raw.status ?? [],
        registrar,
        registrarIanaId,
        registrarEmail,
        registrantCountry,
        registered: findEvent('registration'),
        updated: findEvent('last changed'),
        expires: findEvent('expiration'),
        nameservers:
          raw.nameservers?.map((n) => n.ldhName?.toLowerCase() ?? '').filter(Boolean) ?? [],
        dnssec: raw.secureDNS?.delegationSigned ?? null,
        rawJson: JSON.stringify(raw),
      };
    });
  });
