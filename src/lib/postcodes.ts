// Thin wrapper around postcodes.io — no auth, generous rate limits, fully
// CORS-enabled. Returns undefined on failure so callers can degrade to an
// "unknown postcode" state instead of throwing.

export type PostcodeResult = {
  postcode: string;
  latitude: number;
  longitude: number;
  admin_district: string | null;
  parliamentary_constituency: string | null;
  region: string | null;
  country: string | null;
};

export async function lookupPostcode(raw: string): Promise<PostcodeResult | null> {
  const pc = raw.replace(/\s+/g, '').toUpperCase();
  if (!pc) return null;
  const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { result?: PostcodeResult };
  return j.result ?? null;
}

/** Best-effort normalisation so "sw1a1aa" → "SW1A 1AA". */
export function formatPostcode(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length < 5) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}
