import { describe, it, expect } from 'vitest';
import { dailyWordleAnswer, WORDLE_ANSWERS } from './wordle-answers';

describe('dailyWordleAnswer', () => {
  it('is deterministic for the same iso date', () => {
    const a = dailyWordleAnswer('2026-04-24');
    const b = dailyWordleAnswer('2026-04-24');
    expect(a.answer).toBe(b.answer);
    expect(a.puzzleIdx).toBe(b.puzzleIdx);
  });

  it('returns an answer from the curated pool', () => {
    const { answer, puzzleIdx } = dailyWordleAnswer('2026-04-24');
    expect(WORDLE_ANSWERS).toContain(answer);
    expect(puzzleIdx).toBeGreaterThanOrEqual(0);
    expect(puzzleIdx).toBeLessThan(WORDLE_ANSWERS.length);
    expect(WORDLE_ANSWERS[puzzleIdx]).toBe(answer);
  });

  it('produces different answers for consecutive days (usually)', () => {
    // If two adjacent days map to the same word, the seed is basically
    // broken — for a pool of 120 words the birthday-paradox collision
    // probability across a small sample is low enough that this is a
    // useful regression check.
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'];
    const answers = dates.map((d) => dailyWordleAnswer(d).answer);
    const unique = new Set(answers);
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });

  it('pins the seed → word mapping so accidental drift is caught', () => {
    // snapshot of a fixed sample. if you change the hash function or
    // answer-pool order, every date maps to a different word and
    // everyone playing on the same day would see different puzzles —
    // forcing a conscious migration decision via this snapshot.
    const sample = ['2026-01-01', '2026-04-24', '2030-12-31'].map((d) => ({
      date: d,
      ...dailyWordleAnswer(d),
    }));
    expect(sample).toMatchSnapshot();
  });
});
