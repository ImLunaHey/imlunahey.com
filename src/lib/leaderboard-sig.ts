/**
 * HMAC-SHA256 signing for leaderboard scores. Isolated from the server
 * module (`src/server/leaderboard.ts`) so the crypto round-trip is
 * testable in plain vitest without pulling in `createServerFn` or the
 * cloudflare:workers runtime.
 *
 * The canonical format is a pipe-joined deterministic string. Changing
 * any separator or key order invalidates every signed record on the
 * network, so don't touch it without a migration plan.
 */

export type GameId = 'snake' | 'wordle' | 'typing-15' | 'typing-30' | 'typing-60';

export type ScorePayload = {
  game: GameId;
  score: number;
  did: string;
  achievedAt: string;
};

export function canonical(payload: ScorePayload): string {
  return `${payload.achievedAt}|${payload.did}|${payload.game}|${payload.score}`;
}

function toBase64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toBase64url(sig);
}

export async function hmacVerify(secret: string, message: string, expected: string): Promise<boolean> {
  const actual = await hmacSign(secret, message);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function validateScore(game: GameId, score: number): string | null {
  if (!Number.isInteger(score) || score < 0) return 'score must be a non-negative integer';
  switch (game) {
    case 'snake':
      if (score > 400) return 'snake score exceeds plausible max (400)';
      return null;
    case 'wordle':
      if (score > 6) return 'wordle score must be 1..6';
      if (score < 1) return 'wordle score must be at least 1';
      return null;
    case 'typing-15':
    case 'typing-30':
    case 'typing-60':
      if (score > 250) return 'typing wpm exceeds plausible max (250)';
      return null;
    default:
      return `unknown game: ${String(game)}`;
  }
}
