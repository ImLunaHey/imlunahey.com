import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';
import { isWordleWord } from '../lib/wordle-dictionary';
import { dailyWordleAnswer } from '../lib/wordle-answers';
import {
  canonical,
  hmacSign,
  hmacVerify,
  validateScore,
  type GameId as SigGameId,
} from '../lib/leaderboard-sig';

/**
 * AT-URI of the marker record written by `npm run leaderboard:marker`.
 * Every score references this via its `subject` field.
 */
export const LEADERBOARD_MARKER_URI =
  'at://did:plc:k6acu4chiwkixvdedcmdgmal/com.imlunahey.leaderboard.marker/self';
export const LEADERBOARD_SCORE_COLLECTION = 'com.imlunahey.leaderboard.score';

export type GameId = SigGameId;

export type LeaderboardRow = {
  uri: string;
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  score: number;
  achievedAt: string;
};

export type SignedScore = {
  game: GameId;
  score: number;
  did: string;
  achievedAt: string;
  sig: string;
};

type ScoreRecordValue = {
  $type?: string;
  game: string;
  score: number;
  subject: string;
  did: string;
  achievedAt: string;
  sig: string;
  replay?: string;
};

type ConstellationLinks = {
  total: number;
  linking_records: Array<{ did: string; collection: string; rkey: string }>;
  cursor: string | null;
};

type BskyProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
};

function getSecret(): string {
  const s = process.env.LEADERBOARD_HMAC_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'LEADERBOARD_HMAC_SECRET missing or too short — set a 32+ char secret in .env.local (or wrangler secret for prod)',
    );
  }
  return s;
}

function trySecret(): string | null {
  const s = process.env.LEADERBOARD_HMAC_SECRET;
  return s && s.length >= 32 ? s : null;
}

// ─── sign endpoint ────────────────────────────────────────────────────────

export type SignScoreInput = {
  game: GameId;
  score: number;
  did: string;
  /**
   * Per-game proof-of-play. For wordle we expect the sequence of guesses
   * so the server can verify they actually solved today's puzzle — this
   * is what stops someone from posting `score: 1` without playing.
   */
  guesses?: string[];
};

export const signScore = createServerFn({ method: 'POST' })
  .inputValidator((input: SignScoreInput) => input)
  .handler(async ({ data }): Promise<SignedScore> => {
    const { game, score, did, guesses } = data;
    if (!did.startsWith('did:')) throw new Error('invalid did');
    const err = validateScore(game, score);
    if (err) throw new Error(err);

    if (game === 'wordle') {
      const g = guesses ?? [];
      if (g.length !== score) throw new Error('guesses length must match score');
      if (g.length < 1 || g.length > 6) throw new Error('wordle guesses must be 1..6');
      for (const guess of g) {
        if (!/^[a-z]{5}$/.test(guess)) throw new Error(`invalid guess: ${guess}`);
        if (!isWordleWord(guess)) throw new Error(`not a valid word: ${guess}`);
      }
      // verify the last guess solves today's puzzle
      const achievedAtIso = new Date().toISOString().slice(0, 10);
      const { answer } = dailyWordleAnswer(achievedAtIso);
      if (g[g.length - 1] !== answer) {
        throw new Error('final guess does not solve today\'s puzzle');
      }
    }

    const achievedAt = new Date().toISOString();
    const sig = await hmacSign(getSecret(), canonical({ achievedAt, did, game, score }));
    return { game, score, did, achievedAt, sig };
  });

// ─── leaderboard listing ──────────────────────────────────────────────────

export type LeaderboardScope = 'today' | 'all-time';

export const getLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator((input: { game: GameId; scope?: LeaderboardScope }) => input)
  .handler(async ({ data }): Promise<LeaderboardRow[]> => {
    // wordle defaults to today (it resets daily); other games default to
    // all-time (they don't have a meaningful daily reset).
    const scope: LeaderboardScope = data.scope ?? (data.game === 'wordle' ? 'today' : 'all-time');
    return cached(`leaderboard:${data.game}:${scope}`, TTL.short, async () => {
      const secret = trySecret();
      if (!secret) return [];

      const links = await fetchLinks();
      if (links.length === 0) return [];

      const dids = [...new Set(links.map((l) => l.did))];
      const profiles = await fetchProfiles(dids);

      // Today = scores stamped on today's UTC date. Relevant for games like
      // wordle where yesterday's puzzle is a different thing entirely.
      const todayIso = new Date().toISOString().slice(0, 10);

      const rows = await Promise.all(
        links.map(async (l) => {
          const rec = await fetchRecord(l.did, l.collection, l.rkey);
          if (!rec) return null;
          const v = rec.value;
          if (v.subject !== LEADERBOARD_MARKER_URI) return null;
          if (v.game !== data.game) return null;
          if (v.did !== l.did) return null;
          if (scope === 'today' && v.achievedAt.slice(0, 10) !== todayIso) return null;
          const ok = await hmacVerify(
            secret,
            canonical({
              achievedAt: v.achievedAt,
              did: v.did,
              game: v.game as GameId,
              score: v.score,
            }),
            v.sig,
          );
          if (!ok) return null;
          const profile = profiles.get(l.did);
          return {
            uri: `at://${l.did}/${l.collection}/${l.rkey}`,
            did: l.did,
            handle: profile?.handle ?? l.did,
            displayName: profile?.displayName ?? profile?.handle ?? l.did,
            avatar: profile?.avatar ?? null,
            score: v.score,
            achievedAt: v.achievedAt,
          } satisfies LeaderboardRow;
        }),
      );

      // dedupe by (did, achievedAt) — replay-publish attempts collapse to
      // one row. keep the highest score per did overall.
      const byDid = new Map<string, LeaderboardRow>();
      for (const r of rows) {
        if (!r) continue;
        const cur = byDid.get(r.did);
        // wordle: lower is better; everything else: higher is better.
        const better = data.game === 'wordle' ? (!cur || r.score < cur.score) : (!cur || r.score > cur.score);
        if (better) byDid.set(r.did, r);
      }

      const sorted = [...byDid.values()].sort((a, b) =>
        data.game === 'wordle' ? a.score - b.score : b.score - a.score,
      );
      return sorted.slice(0, 50);
    });
  });

// ─── atproto helpers (same shape as guestbook.ts; duplicated so each
//     feature can evolve independently without coupling) ────────────────

async function fetchLinks(): Promise<ConstellationLinks['linking_records']> {
  const url = new URL('https://constellation.microcosm.blue/links');
  url.searchParams.set('target', LEADERBOARD_MARKER_URI);
  url.searchParams.set('collection', LEADERBOARD_SCORE_COLLECTION);
  url.searchParams.set('path', '.subject');
  url.searchParams.set('limit', '200');
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = (await res.json()) as ConstellationLinks;
  return body.linking_records;
}

async function fetchRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<{ uri: string; cid: string; value: ScoreRecordValue } | null> {
  const pds = await resolvePds(did);
  if (!pds) return null;
  const u = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  u.searchParams.set('repo', did);
  u.searchParams.set('collection', collection);
  u.searchParams.set('rkey', rkey);
  const res = await fetch(u);
  if (!res.ok) return null;
  return (await res.json()) as { uri: string; cid: string; value: ScoreRecordValue };
}

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
