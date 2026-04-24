/**
 * Derived-stat helpers for the bsky-cards lab. Pure functions — kept
 * separate from the component so the rarity thresholds + archetype rules
 * are testable in isolation and not buried in JSX.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type Archetype = {
  key: string;
  label: string;
  glyph: string;
  description: string;
};

/** Inputs archetypeFor needs. Mirrors the subset of a Profile that matters. */
export type ArchetypeInput = {
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  createdAt?: string;
};

export function rarityFor(followers: number): Rarity {
  if (followers >= 100_000) return 'legendary';
  if (followers >= 10_000) return 'epic';
  if (followers >= 1_000) return 'rare';
  if (followers >= 100) return 'uncommon';
  return 'common';
}

export function archetypeFor(p: ArchetypeInput): Archetype {
  const followers = p.followersCount ?? 0;
  const follows = p.followsCount ?? 0;
  const posts = p.postsCount ?? 0;
  const ageDays = ageInDays(p.createdAt);
  const ppd = ageDays > 0 ? posts / ageDays : 0;
  const ratio = follows > 0 ? followers / follows : followers;

  if (posts === 0) return { key: 'ghost', label: 'ghost', glyph: '◌', description: 'signed up, never posted' };
  if (ppd >= 20) return { key: 'shitposter', label: 'shitposter', glyph: '⚡', description: 'posts faster than you can read' };
  if (ppd >= 5) return { key: 'poster', label: 'poster', glyph: '◆', description: 'the timeline\'s daily bread' };
  if (ppd < 0.1 && followers >= 500) return { key: 'lurker', label: 'lurker', glyph: '◐', description: 'watches everything, says nothing' };
  if (ratio >= 50) return { key: 'celebrity', label: 'celebrity', glyph: '★', description: 'followed by many, follows few' };
  if (ratio <= 0.2 && follows >= 500) return { key: 'seeker', label: 'seeker', glyph: '◈', description: 'follows the whole timeline' };
  if (ppd >= 1) return { key: 'regular', label: 'regular', glyph: '●', description: 'shows up, says things, leaves' };
  return { key: 'quiet', label: 'quiet', glyph: '○', description: 'a few posts here and there' };
}

export function ageInDays(iso?: string, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}
