import { cached, TTL } from './cache';

type ResolveResp = { did: string };

type PlcDoc = {
  service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
};

export async function resolveIdentity(handle: string): Promise<{ did: string; pds: string } | null> {
  return cached(`atproto:identity:${handle}`, TTL.long, async () => {
    const r1 = await fetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
    );
    if (!r1.ok) return null;
    const { did } = (await r1.json()) as ResolveResp;

    const r2 = await fetch(`https://plc.directory/${did}`);
    if (!r2.ok) return null;
    const doc = (await r2.json()) as PlcDoc;
    const pds = doc.service?.find(
      (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer',
    )?.serviceEndpoint;
    if (!pds) return null;

    return { did, pds };
  });
}
