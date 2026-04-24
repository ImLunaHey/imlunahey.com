import { describe, it, expect } from 'vitest';
import {
  canonical,
  hmacSign,
  hmacVerify,
  validateScore,
} from './leaderboard-sig';

const SECRET = 'a-32-character-test-secret!!!!!!';
const payload = {
  game: 'wordle' as const,
  score: 3,
  did: 'did:plc:example',
  achievedAt: '2026-04-24T12:00:00.000Z',
};

describe('canonical', () => {
  it('is stable given stable input', () => {
    expect(canonical(payload)).toBe('2026-04-24T12:00:00.000Z|did:plc:example|wordle|3');
  });

  it('differs when any field differs', () => {
    const a = canonical(payload);
    expect(canonical({ ...payload, score: 4 })).not.toBe(a);
    expect(canonical({ ...payload, did: 'did:plc:other' })).not.toBe(a);
    expect(canonical({ ...payload, game: 'snake' })).not.toBe(a);
    expect(canonical({ ...payload, achievedAt: '2026-04-25T00:00:00.000Z' })).not.toBe(a);
  });
});

describe('hmacSign / hmacVerify round-trip', () => {
  it('verify returns true for a matching signature', async () => {
    const sig = await hmacSign(SECRET, canonical(payload));
    await expect(hmacVerify(SECRET, canonical(payload), sig)).resolves.toBe(true);
  });

  it('verify rejects a tampered message', async () => {
    const sig = await hmacSign(SECRET, canonical(payload));
    await expect(hmacVerify(SECRET, canonical({ ...payload, score: 99 }), sig)).resolves.toBe(false);
  });

  it('verify rejects a signature made with a different secret', async () => {
    const sig = await hmacSign('b-32-character-other-secret!!!!!', canonical(payload));
    await expect(hmacVerify(SECRET, canonical(payload), sig)).resolves.toBe(false);
  });

  it('verify rejects a garbage signature of the same length', async () => {
    const sig = await hmacSign(SECRET, canonical(payload));
    const tampered = sig.slice(0, -1) + (sig.at(-1) === 'a' ? 'b' : 'a');
    await expect(hmacVerify(SECRET, canonical(payload), tampered)).resolves.toBe(false);
  });

  it('signatures are url-safe base64 (no padding, no +/)', async () => {
    const sig = await hmacSign(SECRET, canonical(payload));
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('validateScore', () => {
  it('rejects non-integer and negative scores for any game', () => {
    expect(validateScore('wordle', -1)).toMatch(/non-negative/);
    expect(validateScore('wordle', 1.5)).toMatch(/non-negative/);
  });

  it('wordle range is 1..6', () => {
    expect(validateScore('wordle', 0)).toMatch(/at least 1/);
    expect(validateScore('wordle', 1)).toBeNull();
    expect(validateScore('wordle', 6)).toBeNull();
    expect(validateScore('wordle', 7)).toMatch(/must be 1..6/);
  });

  it('snake caps at 400', () => {
    expect(validateScore('snake', 400)).toBeNull();
    expect(validateScore('snake', 401)).toMatch(/plausible/);
  });

  it('typing caps at 250 wpm across every typing flavour', () => {
    for (const g of ['typing-15', 'typing-30', 'typing-60'] as const) {
      expect(validateScore(g, 250)).toBeNull();
      expect(validateScore(g, 251)).toMatch(/plausible/);
    }
  });
});
