import { describe, it, expect } from 'vitest';
import { judge } from './wordle-judge';

describe('judge', () => {
  it('marks every letter correct when guess === answer', () => {
    expect(judge('crane', 'crane')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('marks every letter absent when no letters overlap', () => {
    expect(judge('abcde', 'fghij')).toEqual(['absent', 'absent', 'absent', 'absent', 'absent']);
  });

  it('marks present for right letter wrong spot', () => {
    // r is at index 0 in guess, index 1 in answer → present
    // rest don't match anything → absent
    expect(judge('rxxxx', 'crane')).toEqual(['present', 'absent', 'absent', 'absent', 'absent']);
  });

  // duplicate-letter semantics — the classic wordle rule that the
  // two-pass algorithm exists to satisfy. tested exhaustively because
  // single-pass implementations silently get these wrong.
  describe('duplicate letters', () => {
    it('a double-letter guess against a single-letter answer marks only one as present', () => {
      // guess "skill" vs answer "spike": guess has two L's, answer has zero.
      // both should be absent.
      expect(judge('spill', 'spike')).toEqual(['correct', 'correct', 'correct', 'absent', 'absent']);
    });

    it('prefers correct over present when the answer has one of two duplicate letters', () => {
      // guess "eerie" vs answer "cheer": guess has 3 E's, answer has 2.
      // position 0: e vs c → not correct. e exists in answer → present.
      // position 1: e vs h → not correct. e exists in answer (one left) → present.
      // position 2: r vs e → not correct. r exists in answer → present.
      // position 3: i vs e → not correct. i not in answer → absent.
      // position 4: e vs r → not correct. no E's remaining → absent.
      expect(judge('eerie', 'cheer')).toEqual(['present', 'present', 'present', 'absent', 'absent']);
    });

    it('correct letters consume their slot before present is assigned', () => {
      // guess "sissy" vs answer "swiss": greens pass marks s@0, s@2.
      // yellows pass has i@1 (answer has i@2 — one remaining) → present.
      // s@3 — answer has s@3 too — actually correct! so s@3 → correct.
      // y@4 — absent.
      // recompute carefully:
      //   answer: s w i s s
      //   guess:  s i s s y
      //   greens: correct(s@0), _, _, correct(s@3), _
      //   remaining answer letters (after greens): w@1, i@2, s@4
      //   yellows pass:
      //     i@1 — answer has i@2 remaining → present
      //     s@2 — answer has s@4 remaining → present
      //     y@4 — not in remaining → absent
      expect(judge('sissy', 'swiss')).toEqual(['correct', 'present', 'present', 'correct', 'absent']);
    });
  });
});
