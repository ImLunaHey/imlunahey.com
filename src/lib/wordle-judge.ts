/**
 * Per-letter feedback for a wordle guess. Two-pass algorithm so double
 * letters don't over-credit: first mark greens, then yellows against a
 * frequency map of remaining letters. Used by the lab UI for display and
 * by the server leaderboard (via the full guesses check) to verify that
 * a claimed solve actually solved today's puzzle.
 */

export type LetterState = 'correct' | 'present' | 'absent' | 'empty';

export function judge(guess: string, answer: string): LetterState[] {
  const res: LetterState[] = Array.from({ length: 5 }, () => 'absent');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
    } else {
      remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'correct') continue;
    const c = guess[i];
    if ((remaining[c] ?? 0) > 0) {
      res[i] = 'present';
      remaining[c] -= 1;
    }
  }
  return res;
}
