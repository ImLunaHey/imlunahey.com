#!/usr/bin/env node
/**
 * Diagnose why a specific conceptId on /playstation has no trophies.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/playstation-debug.ts <conceptId>
 *
 * Prints:
 *   1. Every played-games entry that shares the conceptId (titleId, name,
 *      category, normalised name)
 *   2. Every trophy title in your account whose normalised name overlaps
 *      with the played title's first significant word, plus the
 *      normalised form so we can eyeball exactly where the join fails.
 */

// psn-api ships its main entry as CJS; named ESM imports fail under
// tsx, so destructure the default. Vite handles this for the worker
// build, but standalone scripts go through plain Node ESM.
import psnApi from 'psn-api';
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserPlayedGames,
  getUserTitles,
} = psnApi;

const CONCEPT_ID = Number(process.argv[2]);
if (!Number.isFinite(CONCEPT_ID) || CONCEPT_ID <= 0) {
  console.error('usage: pnpm tsx scripts/playstation-debug.ts <conceptId>');
  process.exit(1);
}

const NPSSO = process.env.PSN_NPSSO;
if (!NPSSO) {
  console.error('PSN_NPSSO not set — add it to .env.local first');
  process.exit(1);
}

// same normaliser the production join uses, copied here so this script
// is self-contained and any tweaks compare apples-to-apples.
function normaliseTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[:\-_–—,.!?'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('authenticating…');
  const code = await exchangeNpssoForAccessCode(NPSSO!);
  const tokens = await exchangeAccessCodeForAuthTokens(code);
  const auth = { accessToken: tokens.accessToken };

  console.log('fetching played games (paginating)…');
  const played: Awaited<ReturnType<typeof getUserPlayedGames>>['titles'] = [];
  let offset = 0;
  for (let i = 0; i < 20; i++) {
    const r = await getUserPlayedGames(auth, 'me', { limit: 200, offset });
    played.push(...r.titles);
    if (r.titles.length < 200 || r.nextOffset == null || r.nextOffset <= offset) break;
    offset = r.nextOffset;
  }
  console.log(`  ${played.length} total titles`);

  const matches = played.filter((p) => p.concept?.id === CONCEPT_ID);
  if (matches.length === 0) {
    console.error(`no played-games entry has concept.id=${CONCEPT_ID}`);
    process.exit(1);
  }

  console.log('');
  console.log(`=== played-games entries for concept ${CONCEPT_ID} ===`);
  for (const m of matches) {
    console.log(`  [${m.category}]`);
    console.log(`    titleId:        ${m.titleId}`);
    console.log(`    name:           ${m.name}`);
    console.log(`    normalised:     "${normaliseTitle(m.name)}"`);
    console.log(`    concept.name:   ${m.concept?.name}`);
  }

  console.log('');
  console.log('fetching trophy titles (paginating)…');
  const trophies: Awaited<ReturnType<typeof getUserTitles>>['trophyTitles'] = [];
  let toff = 0;
  for (let i = 0; i < 20; i++) {
    const r = await getUserTitles(auth, 'me', { limit: 800, offset: toff });
    trophies.push(...r.trophyTitles);
    if (r.trophyTitles.length < 800 || r.nextOffset == null || r.nextOffset <= toff) break;
    toff = r.nextOffset;
  }
  console.log(`  ${trophies.length} trophy titles`);

  // search by first significant word of the played title (drop short
  // function-words). that's a much wider net than the production join
  // — the goal is to surface near-matches the strict join misses.
  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or']);
  const firstWord = (() => {
    const norm = normaliseTitle(matches[0].name);
    for (const w of norm.split(' ')) {
      if (w.length >= 3 && !STOP.has(w)) return w;
    }
    return norm.split(' ')[0] ?? '';
  })();

  console.log('');
  console.log(`=== trophy titles whose normalised name contains "${firstWord}" ===`);
  const candidates = trophies.filter((t) =>
    normaliseTitle(t.trophyTitleName).includes(firstWord),
  );
  if (candidates.length === 0) {
    console.log('  (none — your account has no trophy titles matching that word)');
  } else {
    for (const c of candidates) {
      console.log(`  [${c.trophyTitlePlatform}]`);
      console.log(`    name:           ${c.trophyTitleName}`);
      console.log(`    normalised:     "${normaliseTitle(c.trophyTitleName)}"`);
      console.log(`    npComm:         ${c.npCommunicationId}`);
      console.log(`    progress:       ${c.progress}%`);
    }
  }

  console.log('');
  console.log('=== exact-normalised join result (production behaviour) ===');
  const playedNorms = new Set(matches.map((m) => normaliseTitle(m.name)));
  const exact = trophies.filter((t) => playedNorms.has(normaliseTitle(t.trophyTitleName)));
  if (exact.length === 0) {
    console.log('  no exact-normalised match — production page would show no trophies.');
  } else {
    for (const e of exact) {
      console.log(`  matched: ${e.trophyTitleName} (${e.trophyTitlePlatform})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
