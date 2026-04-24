import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import {
  ensureOAuthConfigured,
  LEADERBOARD_SCOPE,
  LEADERBOARD_WRITE_SCOPE,
  sessionHasScope,
} from '../../lib/oauth';
import {
  getLeaderboard,
  LEADERBOARD_MARKER_URI,
  LEADERBOARD_SCORE_COLLECTION,
  signScore,
  type GameId,
  type LeaderboardRow,
} from '../../server/leaderboard';

type Cell = number; // 0 = empty
type Grid = Cell[]; // 81 cells, row-major
type NotesGrid = Array<Set<number>>; // 81 candidate sets

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

const HOLES_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 38,
  medium: 46,
  hard: 52,
  expert: 56,
};

const STORAGE_KEY = 'lab:sudoku:state';

const idx = (r: number, c: number) => r * 9 + c;

function rngFromSeed(seed: number): () => number {
  // small lcg — deterministic given a seed, fine for shuffle.
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(g: Grid, r: number, c: number, v: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (g[idx(r, i)] === v) return false;
    if (g[idx(i, c)] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (g[idx(br + dr, bc + dc)] === v) return false;
    }
  }
  return true;
}

// fill an empty grid with a random valid solution. backtracking, randomised
// candidates per cell so different seeds give different boards.
function fillRandom(g: Grid, rand: () => number): boolean {
  for (let i = 0; i < 81; i++) {
    if (g[i] !== 0) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const candidates = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
    for (const v of candidates) {
      if (canPlace(g, r, c, v)) {
        g[i] = v;
        if (fillRandom(g, rand)) return true;
        g[i] = 0;
      }
    }
    return false;
  }
  return true;
}

// count solutions, capped at `limit` (we only ever care about "is it 1?").
function countSolutions(g: Grid, limit = 2): number {
  let found = 0;
  const grid = g.slice();
  function rec(): void {
    if (found >= limit) return;
    let pos = -1;
    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) {
        pos = i;
        break;
      }
    }
    if (pos === -1) {
      found++;
      return;
    }
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    for (let v = 1; v <= 9; v++) {
      if (canPlace(grid, r, c, v)) {
        grid[pos] = v;
        rec();
        grid[pos] = 0;
        if (found >= limit) return;
      }
    }
  }
  rec();
  return found;
}

// dig holes from a solved grid while keeping the puzzle uniquely solvable.
// returns the puzzle (with holes) and the solution.
function makePuzzle(seed: number, holes: number): { puzzle: Grid; solution: Grid } {
  const rand = rngFromSeed(seed);
  const solution: Grid = new Array(81).fill(0);
  fillRandom(solution, rand);

  const puzzle = solution.slice();
  // try positions in random order; only remove if puzzle stays unique.
  const order = shuffled(
    Array.from({ length: 81 }, (_, i) => i),
    rand,
  );
  let removed = 0;
  for (const i of order) {
    if (removed >= holes) break;
    const saved = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      removed++;
    } else {
      puzzle[i] = saved;
    }
  }
  return { puzzle, solution };
}

function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function emptyNotes(): NotesGrid {
  return Array.from({ length: 81 }, () => new Set<number>());
}

function isComplete(grid: Grid, solution: Grid): boolean {
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== solution[i]) return false;
  }
  return true;
}

// the cell pairs that conflict with `i` for being equal — same row, col, box.
function peers(i: number): number[] {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const set = new Set<number>();
  for (let k = 0; k < 9; k++) {
    set.add(idx(r, k));
    set.add(idx(k, c));
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      set.add(idx(br + dr, bc + dc));
    }
  }
  set.delete(i);
  return Array.from(set);
}

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => peers(i));

function findMistakes(grid: Grid, given: boolean[]): boolean[] {
  const bad = new Array(81).fill(false);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v === 0 || given[i]) continue;
    for (const p of PEERS[i]) {
      if (grid[p] === v) {
        bad[i] = true;
        break;
      }
    }
  }
  return bad;
}

type Persisted = {
  seed: number;
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  current: Grid;
  notes: Array<number[]>;
  startedAt: number;
  elapsed: number;
};

function loadPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (
      Array.isArray(parsed.puzzle) && parsed.puzzle.length === 81 &&
      Array.isArray(parsed.solution) && parsed.solution.length === 81 &&
      Array.isArray(parsed.current) && parsed.current.length === 81
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function savePersisted(p: Persisted) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SudokuPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [seed, setSeed] = useState<number>(() => newSeed());
  const [puzzle, setPuzzle] = useState<Grid>(() => new Array(81).fill(0));
  const [solution, setSolution] = useState<Grid>(() => new Array(81).fill(0));
  const [grid, setGrid] = useState<Grid>(() => new Array(81).fill(0));
  const [notes, setNotes] = useState<NotesGrid>(emptyNotes);
  const [selected, setSelected] = useState<number>(40); // centre
  const [notesMode, setNotesMode] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [won, setWon] = useState(false);
  // captured at the exact moment the puzzle is solved (or restored from a
  // saved-won state) so the published score doesn't drift forward by ~1s.
  const [winElapsed, setWinElapsed] = useState<number | null>(null);
  const [publishState, setPublishState] = useState<'idle' | 'signing' | 'publishing' | 'published' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');

  const { session } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const queryClient = useQueryClient();
  const gameId: GameId = `sudoku-${difficulty}`;
  const { data: leaderboardRows } = useQuery({
    queryKey: ['leaderboard', gameId],
    queryFn: () => getLeaderboard({ data: { game: gameId } }),
  });
  const canPublishScore = sessionHasScope(session, LEADERBOARD_WRITE_SCOPE);

  const given = useMemo(() => puzzle.map((v) => v !== 0), [puzzle]);
  const mistakes = useMemo(() => findMistakes(grid, given), [grid, given]);

  // restore from localStorage on first mount; otherwise generate fresh.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setDifficulty(persisted.difficulty);
      setSeed(persisted.seed);
      setPuzzle(persisted.puzzle);
      setSolution(persisted.solution);
      setGrid(persisted.current);
      setNotes(persisted.notes.map((arr) => new Set(arr)));
      setBaseElapsed(persisted.elapsed);
      setStartedAt(Date.now());
      setGenerating(false);
      const restoredWon = isComplete(persisted.current, persisted.solution);
      setWon(restoredWon);
      setWinElapsed(restoredWon ? persisted.elapsed : null);
    } else {
      regenerate(seed, difficulty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist on any change.
  useEffect(() => {
    if (generating) return;
    const elapsed = baseElapsed + (Date.now() - startedAt) / 1000;
    const payload: Persisted = {
      seed,
      difficulty,
      puzzle,
      solution,
      current: grid,
      notes: notes.map((s) => Array.from(s).sort()),
      startedAt,
      elapsed,
    };
    savePersisted(payload);
  }, [generating, seed, difficulty, puzzle, solution, grid, notes, startedAt, baseElapsed]);

  // tick the clock while playing.
  useEffect(() => {
    if (won || generating) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [won, generating]);

  // detect win — only when grid matches solution and the user filled the last
  // cell themselves (puzzle still has zeros where they did).
  useEffect(() => {
    if (generating) return;
    if (!won && isComplete(grid, solution)) {
      setWon(true);
      setWinElapsed(baseElapsed + (Date.now() - startedAt) / 1000);
    }
  }, [grid, solution, won, generating, baseElapsed, startedAt]);

  // while playing, the timer ticks live; once won, freeze on the captured
  // win time so the displayed value matches the score we'd publish.
  const elapsed = generating
    ? 0
    : won && winElapsed !== null
      ? winElapsed
      : baseElapsed + (now - startedAt) / 1000;

  const regenerate = useCallback((s: number, d: Difficulty) => {
    setGenerating(true);
    setWon(false);
    setWinElapsed(null);
    setPublishState('idle');
    setPublishError(null);
    // defer so the "generating..." state actually paints. expert can take
    // a few hundred ms because the unique-solution check is the slow part.
    window.setTimeout(() => {
      const { puzzle: p, solution: sol } = makePuzzle(s, HOLES_BY_DIFFICULTY[d]);
      setPuzzle(p);
      setSolution(sol);
      setGrid(p.slice());
      setNotes(emptyNotes());
      setBaseElapsed(0);
      setStartedAt(Date.now());
      setGenerating(false);
    }, 0);
  }, []);

  const newGame = useCallback(
    (d: Difficulty = difficulty) => {
      const s = newSeed();
      setSeed(s);
      setDifficulty(d);
      regenerate(s, d);
    },
    [difficulty, regenerate],
  );

  const restart = useCallback(() => {
    setGrid(puzzle.slice());
    setNotes(emptyNotes());
    setBaseElapsed(0);
    setStartedAt(Date.now());
    setWon(false);
    setWinElapsed(null);
    setPublishState('idle');
    setPublishError(null);
  }, [puzzle]);

  async function startSignIn(handle: string) {
    setPublishError(null);
    try {
      ensureOAuthConfigured();
      const url = await createAuthorizationUrl({
        target: { type: 'account', identifier: handle.trim() as ActorIdentifier },
        scope: LEADERBOARD_SCOPE,
        state: { returnTo: window.location.pathname },
      });
      window.location.assign(url.toString());
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    }
  }

  async function publish() {
    if (!session || winElapsed === null) return;
    if (publishState === 'signing' || publishState === 'publishing') return;
    setPublishError(null);
    setPublishState('signing');
    try {
      const did = session.info.sub;
      const score = Math.round(winElapsed);
      const signed = await signScore({ data: { game: gameId, score, did } });
      setPublishState('publishing');
      const agent = new OAuthUserAgent(session);
      const xrpc = new XRPC({ handler: agent });
      await xrpc.call('com.atproto.repo.createRecord', {
        data: {
          repo: did,
          collection: LEADERBOARD_SCORE_COLLECTION,
          record: {
            $type: LEADERBOARD_SCORE_COLLECTION,
            game: signed.game,
            score: signed.score,
            subject: LEADERBOARD_MARKER_URI,
            did: signed.did,
            achievedAt: signed.achievedAt,
            sig: signed.sig,
          },
        },
      });
      setPublishState('published');
      window.setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['leaderboard', gameId] }),
        2000,
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
      setPublishState('error');
    }
  }

  const clearCell = useCallback(
    (i: number) => {
      if (given[i]) return;
      setGrid((g) => {
        if (g[i] === 0) return g;
        const next = g.slice();
        next[i] = 0;
        return next;
      });
      setNotes((n) => {
        if (n[i].size === 0) return n;
        const next = n.slice();
        next[i] = new Set();
        return next;
      });
    },
    [given],
  );

  // place a digit at the selected cell, or toggle a note if notesMode.
  // typing a number removes that digit from the notes of all peers — so
  // pencil marks behave the way every digital sudoku has trained users to
  // expect, instead of leaving stale candidates around the board.
  const place = useCallback(
    (i: number, v: number) => {
      if (given[i] || won) return;
      if (notesMode) {
        setNotes((n) => {
          const next = n.slice();
          const s = new Set(next[i]);
          if (s.has(v)) s.delete(v);
          else s.add(v);
          next[i] = s;
          return next;
        });
        return;
      }
      setGrid((g) => {
        if (g[i] === v) {
          const next = g.slice();
          next[i] = 0;
          return next;
        }
        const next = g.slice();
        next[i] = v;
        return next;
      });
      setNotes((n) => {
        const next = n.slice();
        // wipe notes on the cell itself
        if (next[i].size > 0) next[i] = new Set();
        // remove `v` from peers' notes
        for (const p of PEERS[i]) {
          if (next[p].has(v)) {
            const s = new Set(next[p]);
            s.delete(v);
            next[p] = s;
          }
        }
        return next;
      });
    },
    [given, notesMode, won],
  );

  // keyboard handling — arrow keys to move, 1-9 to fill, 0/backspace/delete
  // to clear, n to toggle notes, h for a one-off hint.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField =
        t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable === true;
      if (inField) return;
      const k = e.key;

      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        setSelected((cur) => {
          const r = Math.floor(cur / 9);
          const c = cur % 9;
          if (k === 'ArrowLeft') return idx(r, (c + 8) % 9);
          if (k === 'ArrowRight') return idx(r, (c + 1) % 9);
          if (k === 'ArrowUp') return idx((r + 8) % 9, c);
          return idx((r + 1) % 9, c);
        });
        return;
      }
      if (/^[1-9]$/.test(k)) {
        e.preventDefault();
        place(selected, parseInt(k, 10));
        return;
      }
      if (k === '0' || k === 'Backspace' || k === 'Delete') {
        e.preventDefault();
        clearCell(selected);
        return;
      }
      if (k === 'n' || k === 'N') {
        e.preventDefault();
        setNotesMode((n) => !n);
        return;
      }
      if (k === 'h' || k === 'H') {
        e.preventDefault();
        // fill the selected cell with the correct value, only if currently empty.
        if (!given[selected] && grid[selected] === 0) {
          place(selected, solution[selected]);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, place, clearCell, given, grid, solution]);

  const selR = Math.floor(selected / 9);
  const selC = selected % 9;
  const selBR = Math.floor(selR / 3);
  const selBC = Math.floor(selC / 3);
  const selVal = grid[selected];

  // count remaining for each digit so the number pad can hint progress.
  const remaining = useMemo(() => {
    const counts = new Array(10).fill(9);
    counts[0] = 0;
    for (const v of grid) if (v !== 0) counts[v]--;
    return counts;
  }, [grid]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-sudoku">
        <header className="page-hd">
          <div className="label">~/labs/sudoku</div>
          <h1>sudoku<span className="dot">.</span></h1>
          <p className="sub">
            classic 9×9, four difficulties, generated client-side and guaranteed unique. arrow
            keys to move, <kbd>1</kbd>–<kbd>9</kbd> to fill, <kbd>n</kbd> for notes,{' '}
            <kbd>h</kbd> for a single-cell hint. progress autosaves locally.
          </p>
          <div className="meta">
            <span>diff <b className="t-accent">{difficulty}</b></span>
            <span>holes <b>{HOLES_BY_DIFFICULTY[difficulty]}</b></span>
            <span>time <b>{formatTime(elapsed)}</b></span>
            <span>status <b className={won ? 't-accent' : ''}>{generating ? 'generating…' : won ? 'solved' : 'in progress'}</b></span>
          </div>
        </header>

        <section className="controls">
          <div className="diff-row">
            {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-btn${d === difficulty ? ' on' : ''}`}
                onClick={() => newGame(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="action-row">
            <button type="button" className="ghost-btn" onClick={() => newGame()}>new puzzle</button>
            <button type="button" className="ghost-btn" onClick={restart}>restart</button>
            <button
              type="button"
              className={`ghost-btn${notesMode ? ' on' : ''}`}
              onClick={() => setNotesMode((n) => !n)}
              title="press n"
            >
              notes {notesMode ? 'on' : 'off'}
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                if (!given[selected] && grid[selected] === 0) place(selected, solution[selected]);
              }}
              disabled={given[selected] || grid[selected] !== 0 || won}
              title="press h"
            >
              hint
            </button>
          </div>
        </section>

        <section className="stage-wrap" ref={containerRef}>
          <div className="board" role="grid" aria-label="sudoku board">
            {grid.map((v, i) => {
              const r = Math.floor(i / 9);
              const c = i % 9;
              const br = Math.floor(r / 3);
              const bc = Math.floor(c / 3);
              const isGiven = given[i];
              const isSelected = i === selected;
              const sameRow = r === selR;
              const sameCol = c === selC;
              const sameBox = br === selBR && bc === selBC;
              const sameVal = v !== 0 && v === selVal;
              const bad = mistakes[i];
              const cls = [
                'cell',
                isGiven ? 'given' : 'user',
                isSelected ? 'selected' : '',
                !isSelected && (sameRow || sameCol || sameBox) ? 'related' : '',
                !isSelected && sameVal ? 'samenum' : '',
                bad ? 'bad' : '',
                c % 3 === 2 && c < 8 ? 'border-r' : '',
                r % 3 === 2 && r < 8 ? 'border-b' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => setSelected(i)}
                  aria-label={`row ${r + 1} column ${c + 1}${v ? `, value ${v}` : ', empty'}`}
                >
                  {v !== 0 ? (
                    <span className="val">{v}</span>
                  ) : notes[i].size > 0 ? (
                    <span className="notes">
                      {Array.from({ length: 9 }, (_, k) => (
                        <span key={k} className={`n${notes[i].has(k + 1) ? ' on' : ''}`}>
                          {notes[i].has(k + 1) ? k + 1 : ''}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {generating ? (
            <div className="overlay">
              <div className="ov-title">generating…</div>
              <div className="ov-sub">backtracking with unique-solution check.</div>
            </div>
          ) : won ? (
            <div className="overlay">
              <div className="ov-title">solved.</div>
              <div className="ov-score">
                <span className="ov-score-val">{formatTime(elapsed)}</span>
                <span className="ov-score-lbl">{difficulty}</span>
              </div>

              {session && canPublishScore ? (
                publishState === 'published' ? (
                  <div className="ov-sub">
                    ✓ published as <b className="t-accent">@{profile?.handle ?? session.info.sub}</b>
                  </div>
                ) : (
                  <button
                    className="ov-btn"
                    type="button"
                    onClick={() => void publish()}
                    disabled={publishState === 'signing' || publishState === 'publishing'}
                  >
                    {publishState === 'signing'
                      ? 'signing…'
                      : publishState === 'publishing'
                        ? 'publishing…'
                        : 'publish to leaderboard'}
                  </button>
                )
              ) : session ? (
                <div className="ov-sub t-faint">
                  signed in, but session is missing leaderboard scope. sign in again below to publish.
                </div>
              ) : (
                <form
                  className="lock-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (handleInput.trim()) void startSignIn(handleInput);
                  }}
                >
                  <input
                    className="lock-input"
                    placeholder="your.handle.bsky.social"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <button className="ov-btn" type="submit" disabled={!handleInput.trim()}>
                    sign in to publish
                  </button>
                </form>
              )}
              {publishError ? <div className="ov-err">{publishError}</div> : null}

              <button className="ov-btn-ghost" type="button" onClick={() => newGame()}>
                new puzzle
              </button>
            </div>
          ) : null}
        </section>

        <section className="numpad">
          {Array.from({ length: 9 }, (_, k) => {
            const v = k + 1;
            const left = remaining[v];
            return (
              <button
                key={v}
                type="button"
                className={`np${left === 0 ? ' done' : ''}`}
                onClick={() => place(selected, v)}
                disabled={won}
              >
                <span className="np-v">{v}</span>
                <span className="np-left">{left}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="np np-clear"
            onClick={() => clearCell(selected)}
            disabled={won || given[selected]}
          >
            <span className="np-v">×</span>
            <span className="np-left">clear</span>
          </button>
        </section>

        <Leaderboard
          rows={leaderboardRows ?? null}
          myDid={session?.info.sub ?? null}
          difficulty={difficulty}
        />

        <footer className="sudoku-footer">
          <span>src: <span className="t-accent">hand-written · ~450 lines</span></span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">labs</Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-sudoku { max-width: 720px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 58ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub kbd {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg);
    border-radius: 2px;
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .controls {
    display: flex; flex-wrap: wrap; gap: var(--sp-3);
    margin-top: var(--sp-5);
    align-items: center; justify-content: space-between;
  }
  .diff-row, .action-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .diff-btn, .ghost-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .diff-btn:hover, .ghost-btn:hover:not(:disabled) {
    color: var(--color-fg);
    border-color: var(--color-accent-dim);
  }
  .diff-btn.on, .ghost-btn.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
  }
  .ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .stage-wrap { position: relative; margin-top: var(--sp-5); }
  .board {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    aspect-ratio: 1 / 1;
    border: 2px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    width: 100%;
  }
  .cell {
    position: relative;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: clamp(16px, 4vw, 28px);
    cursor: pointer;
    padding: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.05s linear;
  }
  .cell:focus { outline: none; }
  .cell.border-r { border-right: 2px solid var(--color-border-bright); }
  .cell.border-b { border-bottom: 2px solid var(--color-border-bright); }
  .cell.related { background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .cell.samenum {
    background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel));
  }
  .cell.selected {
    background: color-mix(in oklch, var(--color-accent) 28%, var(--color-bg-panel));
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }
  .cell .val { line-height: 1; }
  .cell.user .val { color: var(--color-accent); }
  .cell.given .val { color: var(--color-fg); font-weight: 500; }
  .cell.bad .val { color: var(--color-alert); }
  .cell .notes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 100%; height: 100%;
    font-size: clamp(8px, 1.4vw, 11px);
    color: var(--color-fg-faint);
    line-height: 1;
  }
  .cell .notes .n {
    display: flex; align-items: center; justify-content: center;
  }
  .cell .notes .n.on { color: var(--color-fg-dim); }

  .overlay {
    position: absolute; inset: 0;
    background: color-mix(in oklch, var(--color-bg) 80%, transparent);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
  }
  .ov-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 6vw, 56px);
    color: var(--color-accent);
    text-shadow: 0 0 16px var(--accent-glow);
  }
  .ov-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    max-width: 48ch; text-align: center; line-height: 1.55;
  }
  .ov-score { display: flex; align-items: baseline; gap: 6px; }
  .ov-score-val {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 64px);
    color: var(--color-accent);
    text-shadow: 0 0 14px var(--accent-glow);
  }
  .ov-score-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .ov-btn {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 20px;
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
    box-shadow: 0 0 12px var(--accent-glow);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ov-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white); }

  .numpad {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
    margin-top: var(--sp-4);
  }
  .np {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    cursor: pointer;
    font-family: var(--font-mono);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0;
  }
  .np:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  .np:disabled { opacity: 0.4; cursor: not-allowed; }
  .np-v { font-size: clamp(14px, 3vw, 22px); line-height: 1; }
  .np-left { font-size: 9px; color: var(--color-fg-faint); margin-top: 2px; }
  .np.done { opacity: 0.35; }
  .np-clear .np-v { font-size: clamp(16px, 3vw, 24px); color: var(--color-fg-faint); }

  .lock-form {
    display: flex; gap: 6px;
    width: 100%; max-width: 360px;
  }
  .lock-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .lock-input:focus { outline: none; border-color: var(--color-accent); }
  .ov-sub.t-faint { color: var(--color-fg-faint); }
  .ov-err {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-alert);
    max-width: 48ch; text-align: center;
  }
  .ov-btn-ghost {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 20px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ov-btn-ghost:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }

  .lb {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .lb-head {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .lb-head .t-accent { color: var(--color-accent); }
  .lb-empty { padding: var(--sp-5) var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-align: center; }
  .lb-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: var(--sp-3);
    padding: 8px var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .lb-row:last-child { border-bottom: 0; }
  .lb-row.me { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .lb-who-link, .lb-record-link {
    display: flex; align-items: center; gap: var(--sp-2);
    color: inherit; text-decoration: none;
    min-width: 0;
  }
  .lb-who-link:hover .lb-name { color: var(--color-accent); }
  .lb-record-link { gap: var(--sp-3); }
  .lb-record-link:hover .lb-score { color: color-mix(in oklch, var(--color-accent) 85%, white); text-shadow: 0 0 8px var(--accent-glow); }
  .lb-record-link:hover .lb-when { color: var(--color-fg-dim); }
  .lb-rank { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .lb-rank.top1 { color: var(--color-accent); }
  .lb-avatar {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    object-fit: cover;
    display: block;
  }
  .lb-who { min-width: 0; display: flex; flex-direction: column; }
  .lb-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-handle { color: var(--color-fg-faint); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-score { color: var(--color-accent); font-weight: 500; }
  .lb-when { color: var(--color-fg-faint); font-size: 10px; }

  .sudoku-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

// ─── leaderboard panel ──────────────────────────────────────────────────────

function Leaderboard({
  rows,
  myDid,
  difficulty,
}: {
  rows: LeaderboardRow[] | null;
  myDid: string | null;
  difficulty: Difficulty;
}) {
  return (
    <div className="lb">
      <div className="lb-head">
        <span className="t-accent">./leaderboard --sudoku-{difficulty}</span>
        <span>constellation · sig-verified</span>
      </div>
      {rows === null ? (
        <div className="lb-empty">loading scores…</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">no scores yet. be the first.</div>
      ) : (
        rows.map((r, i) => (
          <div key={r.uri} className={`lb-row${r.did === myDid ? ' me' : ''}`}>
            <span className={`lb-rank ${i === 0 ? 'top1' : ''}`}>#{i + 1}</span>
            <a
              className="lb-who-link"
              href={`https://bsky.app/profile/${r.handle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.avatar ? (
                <img src={r.avatar} alt="" className="lb-avatar" loading="lazy" />
              ) : (
                <span className="lb-avatar" />
              )}
              <span className="lb-who">
                <span className="lb-name">{r.displayName}</span>
                <span className="lb-handle">@{r.handle}</span>
              </span>
            </a>
            <Link
              className="lb-record-link"
              to={`/labs/at-uri/${r.uri.replace('at://', '')}` as never}
            >
              <span className="lb-score">{formatTime(r.score)}</span>
              <span className="lb-when">{relative(r.achievedAt)}</span>
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}
