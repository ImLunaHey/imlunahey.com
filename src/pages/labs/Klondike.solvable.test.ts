import { describe, it, expect } from 'vitest';
import { dealSolvable, klondikeSolvable } from './Klondike';

// the underlying random shuffle used by the page is the same (seeded)
// fisher-yates the page exports indirectly via dealSolvable. for the
// "base rate" test we need to call deal() (not dealSolvable) — but
// deal() isn't exported. instead, compare a population of dealSolvable
// outputs against the solver: every one should solve.

describe('klondike solver', () => {
  it('reports a fresh-dealt board as solvable on most seeds', () => {
    // 20 random user-facing seeds → every dealSolvable result must
    // pass the solver. (this is the contract — the generator's whole
    // job is to never return a deal that fails the solver.)
    let solved = 0;
    for (let s = 0; s < 20; s++) {
      const seed = (s * 0x9e3779b1) >>> 0;
      const deal = dealSolvable(seed);
      if (klondikeSolvable(deal, 200_000)) solved++;
    }
    expect(solved).toBe(20);
  });

  it('is deterministic — same user-facing seed → same deal', () => {
    const seedA = 0xdeadbeef;
    const seedB = 0xdeadbeef;
    const a = dealSolvable(seedA);
    const b = dealSolvable(seedB);
    // tableau column lengths and id sequence should match exactly.
    for (let col = 0; col < 7; col++) {
      expect(a.tableau[col].length).toBe(b.tableau[col].length);
      for (let i = 0; i < a.tableau[col].length; i++) {
        expect(a.tableau[col][i].id).toBe(b.tableau[col][i].id);
      }
    }
    expect(a.stock.map((c) => c.id).join(',')).toBe(b.stock.map((c) => c.id).join(','));
  });
});
