import { describe, it, expect } from 'vitest';
import {
  decodeSeed,
  encodeSeed,
  facesMatch,
  generateDeal,
  isFree,
  type LayoutId,
  type Slot,
} from './Mahjong';

// simulate greedy random play: at each step, list every pair of currently-
// free tiles whose faces match, pick one at random, remove both. repeat
// until either the board is empty (win) or no matches are available (loss).
// returns the count of pairs the simulated player removed.
function simulateGreedyPlay(
  slots: Slot[],
  faces: Map<number, ReturnType<typeof generateDeal>['faces'] extends Map<number, infer F> ? F : never>,
  rand: () => number,
): { pairs: number; won: boolean } {
  const removed = new Set<number>();
  const present = new Map<number, Slot>();
  for (const s of slots) present.set(s.id, s);

  let pairs = 0;
  while (present.size > 0) {
    const free: Slot[] = [];
    for (const s of present.values()) if (isFree(s, present)) free.push(s);

    const matches: Array<[Slot, Slot]> = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const fa = faces.get(free[i].id)!;
        const fb = faces.get(free[j].id)!;
        if (facesMatch(fa, fb)) matches.push([free[i], free[j]]);
      }
    }
    if (matches.length === 0) break;

    const pick = matches[Math.floor(rand() * matches.length)];
    present.delete(pick[0].id);
    present.delete(pick[1].id);
    removed.add(pick[0].id);
    removed.add(pick[1].id);
    pairs++;
  }
  return { pairs, won: present.size === 0 };
}

function simRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('mahjong deal generator — winnability via greedy play', () => {
  // each layout, 30 random seeds, 5 greedy attempts each. count the share
  // that reach 72 pairs. the spread-distance assignment is deliberately
  // designed so almost every greedy attempt completes — anything below
  // ~80% means the generator regressed.
  const LAYOUTS: LayoutId[] = ['pyramid', 'wide', 'tower'];

  for (const layoutId of LAYOUTS) {
    it(`${layoutId} — ≥ 80% of greedy random plays win`, () => {
      const seedRng = simRng(0xc0ffee + layoutId.charCodeAt(0));
      let totalAttempts = 0;
      let wins = 0;
      let totalPairsAtLoss = 0;
      let lossCount = 0;

      for (let s = 0; s < 20; s++) {
        const dealSeed = encodeSeed(layoutId, (seedRng() * 0x40000000) >>> 0);
        const { slots, faces } = generateDeal(dealSeed);
        expect(decodeSeed(dealSeed)).toBe(layoutId);
        expect(slots.length).toBe(144);
        expect(faces.size).toBe(144);

        for (let attempt = 0; attempt < 8; attempt++) {
          const playRng = simRng(dealSeed ^ ((attempt + 17) * 0x9e3779b1));
          const { pairs, won } = simulateGreedyPlay(slots, faces, playRng);
          totalAttempts++;
          if (won) wins++;
          else {
            lossCount++;
            totalPairsAtLoss += pairs;
          }
        }
      }

      const rate = wins / totalAttempts;
      const avgPairsAtLoss = lossCount > 0 ? totalPairsAtLoss / lossCount : 72;
      // eslint-disable-next-line no-console
      console.log(
        `${layoutId}: ${(rate * 100).toFixed(1)}% greedy win rate (${wins}/${totalAttempts}); ` +
          `avg ${avgPairsAtLoss.toFixed(1)}/72 pairs when losing`,
      );
      expect(rate).toBeGreaterThanOrEqual(0.8);
    });
  }
});
