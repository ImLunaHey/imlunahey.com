#!/usr/bin/env node
/**
 * Publish every lexicon under /lexicons as a `com.atproto.lexicon.schema`
 * record on the operator's PDS. rkey = the NSID, so clients can fetch
 * <NSID>.json via the standard lexicon-resolution DNS → DID → PDS path.
 *
 * Idempotent: compares the desired record against whatever's already
 * stored and only calls putRecord when the canonical JSON differs.
 *
 * Put these in .env.local (already gitignored):
 *   BSKY_HANDLE=imlunahey.com
 *   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *
 * Then run:
 *   npm run lexicons:publish
 *
 * Don't forget the matching DNS TXT records under _lexicon.<nsid-branch>.
 * <authority> pointing at your DID, otherwise clients can't resolve.
 */

import { AtpAgent } from '@atproto/api';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HANDLE = process.env.BSKY_HANDLE;
const PASSWORD = process.env.BSKY_APP_PASSWORD;
const SERVICE = process.env.BSKY_SERVICE ?? 'https://bsky.social';

if (!HANDLE || !PASSWORD) {
  console.error('error: set BSKY_HANDLE and BSKY_APP_PASSWORD in .env.local');
  process.exit(1);
}

const LEXICONS_DIR = 'lexicons';
const SCHEMA_COLLECTION = 'com.atproto.lexicon.schema';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// canonical json: sort object keys recursively so a server-reordered
// response doesn't register as "changed".
function canonical(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonical);
  const rec = v as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(rec).sort()) sorted[k] = canonical(rec[k]);
  return sorted;
}

function sameShape(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

const agent = new AtpAgent({ service: SERVICE });
console.log(`→ logging in as ${HANDLE} (${SERVICE})`);
await agent.login({ identifier: HANDLE, password: PASSWORD });
const did = agent.session?.did;
if (!did) {
  console.error('error: no did on session after login');
  process.exit(1);
}
console.log(`  did: ${did}`);
console.log('');

const files = walk(LEXICONS_DIR).sort();
if (files.length === 0) {
  console.log(`no lexicon files found under ./${LEXICONS_DIR}`);
  process.exit(0);
}

let created = 0;
let updated = 0;
let unchanged = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  let schema: { id?: unknown; lexicon?: unknown };
  try {
    schema = JSON.parse(raw) as typeof schema;
  } catch (err) {
    console.error(`✗ ${file}: invalid json — ${err instanceof Error ? err.message : err}`);
    continue;
  }
  const nsid = schema.id;
  if (!nsid || typeof nsid !== 'string') {
    console.error(`✗ ${file}: missing top-level \`id\` field`);
    continue;
  }

  const desired = { $type: SCHEMA_COLLECTION, ...(schema as Record<string, unknown>) };

  let existing: unknown = null;
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: SCHEMA_COLLECTION,
      rkey: nsid,
    });
    existing = res.data.value;
  } catch (err) {
    // typical: record doesn't exist yet — fine, we'll create. log anything
    // that doesn't smell like a 404.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/record not found|could not locate record/i.test(msg)) {
      console.warn(`  ! getRecord(${nsid}): ${msg}`);
    }
  }

  if (existing && sameShape(existing, desired)) {
    console.log(`✓ ${nsid} — unchanged`);
    unchanged++;
    continue;
  }

  const verb = existing ? 'updating' : 'creating';
  console.log(`→ ${verb} ${nsid}`);
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: SCHEMA_COLLECTION,
    rkey: nsid,
    record: desired,
  });
  if (existing) updated++;
  else created++;
}

console.log('');
console.log(`done. created: ${created}, updated: ${updated}, unchanged: ${unchanged}`);
