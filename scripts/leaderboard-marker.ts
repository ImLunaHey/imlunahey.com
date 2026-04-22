#!/usr/bin/env node
/**
 * One-time bootstrap: write a `com.imlunahey.leaderboard.marker/self`
 * record to the site operator's PDS. Score records reference this via
 * their `subject` field; constellation indexes the references.
 *
 * Put these in .env.local (already gitignored):
 *   BSKY_HANDLE=imlunahey.com
 *   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *
 * Then run:
 *   npm run leaderboard:marker
 */

import { AtpAgent } from '@atproto/api';

const HANDLE = process.env.BSKY_HANDLE;
const PASSWORD = process.env.BSKY_APP_PASSWORD;
const SERVICE = process.env.BSKY_SERVICE ?? 'https://bsky.social';

if (!HANDLE || !PASSWORD) {
  console.error('error: set BSKY_HANDLE and BSKY_APP_PASSWORD in .env.local');
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

const collection = 'com.imlunahey.leaderboard.marker';
const rkey = 'self';
const record = {
  $type: collection,
  title: 'imlunahey.com leaderboard',
  url: 'https://imlunahey.com/labs',
  description: 'signed scores for the labs games. records live on your pds.',
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
console.log('next: update LEADERBOARD_MARKER_URI in src/server/leaderboard.ts');
console.log('      if it doesn\'t already match, then restart dev.');
