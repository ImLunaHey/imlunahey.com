/**
 * Shared daily-answer logic for the wordle lab. The server uses this to
 * validate submitted solves before signing a leaderboard score; the page
 * uses it to know today's word. Both paths have to agree on what the day
 * is so the client can't smuggle yesterday's answer into today's board.
 *
 * Seeded by the yyyy-mm-dd (UTC) string so everyone worldwide plays the
 * same puzzle on the same date.
 */

// Curated answer pool — intentionally short so the puzzle feels tighter
// than the ~14k accepted-guess dictionary. If you want a longer run of
// unique daily puzzles, expand this list.
export const WORDLE_ANSWERS = [
  'phase', 'relay', 'cloud', 'frost', 'spine', 'token', 'cider', 'ember',
  'glide', 'hover', 'latch', 'month', 'orbit', 'piano', 'quilt', 'riven',
  'staff', 'trust', 'under', 'vivid', 'wrist', 'yacht', 'zebra', 'alter',
  'birch', 'clasp', 'drift', 'evade', 'flint', 'grasp', 'habit', 'index',
  'jolly', 'knock', 'latte', 'music', 'novel', 'ozone', 'plant', 'quiet',
  'rapid', 'swift', 'topaz', 'ultra', 'vapor', 'whisk', 'xenon', 'yield',
  'zesty', 'angle', 'banjo', 'crisp', 'diner', 'ether', 'final', 'giant',
  'haunt', 'ivory', 'joint', 'karma', 'lemon', 'medal', 'nerve', 'otter',
  'pivot', 'quota', 'rebus', 'sword', 'tiger', 'unwed', 'vocal', 'waltz',
  'yearn', 'zonal', 'ample', 'bliss', 'chase', 'dough', 'epoch', 'frame',
  'gloom', 'honey', 'input', 'jumbo', 'knelt', 'lunar', 'moral', 'nudge',
  'opera', 'panic', 'quake', 'rumor', 'sorry', 'tally', 'usher', 'viper',
  'wafer', 'zoned', 'aroma', 'basil', 'chord', 'diver', 'elbow', 'float',
  'grace', 'hotel', 'islet', 'juice', 'kneel', 'linen', 'merge', 'north',
  'opine', 'plush', 'quest', 'riser', 'sepia', 'trace', 'udder', 'valor',
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyWordleAnswer(iso: string): { answer: string; puzzleIdx: number } {
  // hash the yyyy-mm-dd string to a seed, pick from the answer list.
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) | 0;
  const rng = mulberry32(h);
  const puzzleIdx = Math.floor(rng() * WORDLE_ANSWERS.length);
  return { answer: WORDLE_ANSWERS[puzzleIdx], puzzleIdx };
}

/** YYYY-MM-DD of the current UTC day. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
