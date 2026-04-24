import { describe, it, expect } from 'vitest';
import { ageInDays, archetypeFor, rarityFor } from './bsky-cards-stats';

describe('rarityFor', () => {
  it('boundary values map to the right tier', () => {
    // thresholds: <100 common, 100-999 uncommon, 1k-9999 rare, 10k-99999 epic, 100k+ legendary
    expect(rarityFor(0)).toBe('common');
    expect(rarityFor(99)).toBe('common');
    expect(rarityFor(100)).toBe('uncommon');
    expect(rarityFor(999)).toBe('uncommon');
    expect(rarityFor(1_000)).toBe('rare');
    expect(rarityFor(9_999)).toBe('rare');
    expect(rarityFor(10_000)).toBe('epic');
    expect(rarityFor(99_999)).toBe('epic');
    expect(rarityFor(100_000)).toBe('legendary');
    expect(rarityFor(5_000_000)).toBe('legendary');
  });
});

describe('ageInDays', () => {
  const NOW = Date.parse('2026-04-24T12:00:00Z');

  it('returns 0 for a missing or invalid iso', () => {
    expect(ageInDays(undefined, NOW)).toBe(0);
    expect(ageInDays('not-a-date', NOW)).toBe(0);
  });

  it('computes whole-day age between two ISOs', () => {
    expect(ageInDays('2026-04-14T12:00:00Z', NOW)).toBe(10);
    expect(ageInDays('2026-04-24T00:00:00Z', NOW)).toBe(0); // same day, earlier
  });

  it('clamps to zero for a future date', () => {
    expect(ageInDays('2099-01-01T00:00:00Z', NOW)).toBe(0);
  });
});

describe('archetypeFor', () => {
  const DAY = 86_400_000;
  // pin Date.now() indirectly by choosing createdAt such that ageInDays
  // gives a known quotient against the current time. We simulate old
  // accounts by using a createdAt well in the past.
  const OLD = new Date(Date.now() - 1000 * DAY).toISOString();

  it('ghost = zero posts regardless of other signals', () => {
    expect(archetypeFor({ postsCount: 0, followersCount: 50_000, followsCount: 1 })).toMatchObject({ key: 'ghost' });
  });

  it('shitposter = ≥20 posts per day', () => {
    // 20 per day × 1000 days = 20000 posts
    expect(archetypeFor({ postsCount: 20_000, followersCount: 100, followsCount: 100, createdAt: OLD }))
      .toMatchObject({ key: 'shitposter' });
  });

  it('poster = 5..20 posts per day', () => {
    expect(archetypeFor({ postsCount: 5_000, followersCount: 100, followsCount: 100, createdAt: OLD }))
      .toMatchObject({ key: 'poster' });
  });

  it('lurker = <0.1 ppd AND ≥500 followers', () => {
    // 50 posts / 1000 days = 0.05 ppd, 500 followers
    expect(archetypeFor({ postsCount: 50, followersCount: 500, followsCount: 10, createdAt: OLD }))
      .toMatchObject({ key: 'lurker' });
  });

  it('celebrity = ratio ≥50 (followers / following)', () => {
    expect(archetypeFor({ postsCount: 500, followersCount: 50_000, followsCount: 10, createdAt: OLD }))
      .toMatchObject({ key: 'celebrity' });
  });

  it('seeker = ratio ≤0.2 AND ≥500 follows', () => {
    // 100 followers / 1000 follows = 0.1 ratio, 1000 > 500 follows threshold.
    // posts=100 over 1000 days = 0.1 ppd → not poster/shitposter/regular.
    // followers=100 <500 so lurker doesn't match either.
    expect(archetypeFor({ postsCount: 100, followersCount: 100, followsCount: 1_000, createdAt: OLD }))
      .toMatchObject({ key: 'seeker' });
  });

  it('regular = 1..5 posts per day with no standout ratio', () => {
    // 2000 posts / 1000 days = 2 ppd, balanced ratio.
    expect(archetypeFor({ postsCount: 2_000, followersCount: 200, followsCount: 200, createdAt: OLD }))
      .toMatchObject({ key: 'regular' });
  });

  it('quiet = low ppd with no standout signal', () => {
    // 100 posts / 1000 days = 0.1 ppd, 100 followers (below lurker 500 cutoff)
    expect(archetypeFor({ postsCount: 100, followersCount: 100, followsCount: 100, createdAt: OLD }))
      .toMatchObject({ key: 'quiet' });
  });
});
