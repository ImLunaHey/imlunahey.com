import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

/**
 * AT-URI of the marker record written by `npm run guestbook:marker`.
 * Every visitor's com.imlunahey.guestbook.entry references this via
 * its `subject` field. Constellation indexes those references so we
 * can list entries without running our own firehose subscriber.
 */
export const GUESTBOOK_MARKER_URI =
  'at://did:plc:k6acu4chiwkixvdedcmdgmal/com.imlunahey.guestbook.marker/self';
export const GUESTBOOK_ENTRY_COLLECTION = 'com.imlunahey.guestbook.entry';

export type GuestbookEntry = {
  uri: string;
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  text: string;
  createdAt: string;
};

type ConstellationLinks = {
  total: number;
  linking_records: Array<{ did: string; collection: string; rkey: string }>;
  cursor: string | null;
};

type AtprotoRecordRes = {
  uri: string;
  cid: string;
  value: {
    text: string;
    subject?: string;
    createdAt: string;
  };
};

type BskyProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
};

export const getGuestbookEntries = createServerFn({ method: 'GET' }).handler(
  (): Promise<GuestbookEntry[]> =>
    cached('guestbook:entries', TTL.short, async () => {
      const links = await fetchLinks();
      if (links.length === 0) return [];

      const dids = [...new Set(links.map((l) => l.did))];
      const profiles = await fetchProfiles(dids);

      const entries = await Promise.all(
        links.map(async (l) => {
          const rec = await fetchRecord(l.did, l.collection, l.rkey);
          if (!rec) return null;
          if (rec.value.subject !== GUESTBOOK_MARKER_URI) return null;
          const profile = profiles.get(l.did);
          return {
            uri: `at://${l.did}/${l.collection}/${l.rkey}`,
            did: l.did,
            handle: profile?.handle ?? l.did,
            displayName: profile?.displayName ?? profile?.handle ?? l.did,
            avatar: profile?.avatar ?? null,
            text: rec.value.text,
            createdAt: rec.value.createdAt,
          } satisfies GuestbookEntry;
        }),
      );

      return entries
        .filter((e): e is GuestbookEntry => e !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
);

async function fetchLinks(): Promise<ConstellationLinks['linking_records']> {
  const url = new URL('https://constellation.microcosm.blue/links');
  url.searchParams.set('target', GUESTBOOK_MARKER_URI);
  url.searchParams.set('collection', GUESTBOOK_ENTRY_COLLECTION);
  url.searchParams.set('path', '.subject');
  url.searchParams.set('limit', '100');
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = (await res.json()) as ConstellationLinks;
  return body.linking_records;
}

async function fetchRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<AtprotoRecordRes | null> {
  const pds = await resolvePds(did);
  if (!pds) return null;
  const u = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  u.searchParams.set('repo', did);
  u.searchParams.set('collection', collection);
  u.searchParams.set('rkey', rkey);
  const res = await fetch(u);
  if (!res.ok) return null;
  return (await res.json()) as AtprotoRecordRes;
}

/** plc.directory for did:plc, .well-known for did:web. */
async function resolvePds(did: string): Promise<string | null> {
  if (did.startsWith('did:plc:')) {
    const r = await fetch(`https://plc.directory/${did}`);
    if (!r.ok) return null;
    const body = (await r.json()) as {
      service?: Array<{ id: string; serviceEndpoint: string }>;
    };
    return body.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint ?? null;
  }
  if (did.startsWith('did:web:')) {
    const host = did.slice('did:web:'.length);
    const r = await fetch(`https://${host}/.well-known/did.json`);
    if (!r.ok) return null;
    const body = (await r.json()) as {
      service?: Array<{ id: string; serviceEndpoint: string }>;
    };
    return body.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint ?? null;
  }
  return null;
}

/** Batched via app.bsky.actor.getProfiles (max 25 per call). */
async function fetchProfiles(dids: string[]): Promise<Map<string, BskyProfile>> {
  const out = new Map<string, BskyProfile>();
  for (let i = 0; i < dids.length; i += 25) {
    const chunk = dids.slice(i, i + 25);
    const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles');
    for (const d of chunk) url.searchParams.append('actors', d);
    const res = await fetch(url);
    if (!res.ok) continue;
    const body = (await res.json()) as { profiles: BskyProfile[] };
    for (const p of body.profiles) out.set(p.did, p);
  }
  return out;
}
