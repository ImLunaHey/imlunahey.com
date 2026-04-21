#!/usr/bin/env node
/**
 * One-time bootstrap: write a `com.imlunahey.guestbook.marker/self` record
 * to the site operator's PDS. The record identifies this site as a
 * guestbook surface; visitors' entries reference it by AT-URI and the
 * site queries constellation for all records pointing at it.
 *
 * Put these in .env.local (already gitignored):
 *   BSKY_HANDLE=imlunahey.com
 *   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *
 * Then run:
 *   npm run guestbook:marker
 *
 * Generate an app password at https://bsky.app/settings/app-passwords
 * — they're revocable and scoped. The script prints the resulting AT-URI;
 * paste it into GUESTBOOK_MARKER_URI in src/server/guestbook.ts if it
 * doesn't already match.
 */

import { AtpAgent } from '@atproto/api';

const HANDLE = process.env.BSKY_HANDLE;
const PASSWORD = process.env.BSKY_APP_PASSWORD;
const SERVICE = process.env.BSKY_SERVICE ?? 'https://bsky.social';

if (!HANDLE || !PASSWORD) {
  console.error('error: set BSKY_HANDLE and BSKY_APP_PASSWORD environment variables');
  console.error('');
  console.error('  BSKY_HANDLE=you.bsky.social \\');
  console.error('  BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \\');
  console.error('    npx tsx scripts/guestbook-marker.ts');
  process.exit(1);
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

const collection = 'com.imlunahey.guestbook.marker';
const rkey = 'self';
const record = {
  $type: collection,
  title: 'imlunahey.com guestbook',
  url: 'https://imlunahey.com/guestbook',
  description: 'leave a trace on the open protocol. entries live on your own pds.',
  acceptsRepliesFrom: 'anyone',
  createdAt: new Date().toISOString(),
};

console.log(`→ writing ${collection}/${rkey}`);
const res = await agent.com.atproto.repo.putRecord({
  repo: did,
  collection,
  rkey,
  record,
});

console.log('');
console.log(`✓ wrote: ${res.data.uri}`);
console.log('');
console.log('next: paste the at:// uri above into GUESTBOOK_MARKER_URI in');
console.log('      src/server/guestbook.ts, then restart dev.');
