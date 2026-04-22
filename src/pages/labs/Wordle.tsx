import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import { ensureOAuthConfigured, LEADERBOARD_SCOPE, LEADERBOARD_WRITE_SCOPE, sessionHasScope } from '../../lib/oauth';
import { dailyWordleAnswer } from '../../lib/wordle-answers';
import { isWordleWord } from '../../lib/wordle-dictionary';
import {
  getLeaderboard,
  LEADERBOARD_MARKER_URI,
  LEADERBOARD_SCORE_COLLECTION,
  signScore,
  type LeaderboardRow,
} from '../../server/leaderboard';

const GAME_ID = 'wordle' as const;

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

function judge(guess: string, answer: string): LetterState[] {
  // two-pass: first mark greens, then yellows using a letter-frequency map
  // so double letters don't over-credit.
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

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export default function WordlePage() {
  const today = useMemo(() => new Date(), []);
  const todayIso = today.toISOString().slice(0, 10);
  const { answer, puzzleIdx } = useMemo(() => dailyWordleAnswer(todayIso), [todayIso]);

  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(false);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);

  const { session } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const queryClient = useQueryClient();
  const { data: board } = useQuery({
    queryKey: ['leaderboard', GAME_ID],
    queryFn: () => getLeaderboard({ data: { game: GAME_ID } }),
  });
  const [handleInput, setHandleInput] = useState('');
  const [publishState, setPublishState] = useState<'idle' | 'signing' | 'publishing' | 'published' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  // start locked until the player picks guest vs signed-in. if they're
  // already signed in OR already mid-puzzle (from an earlier session in
  // the same tab), skip straight to playing.
  const [mode, setMode] = useState<'locked' | 'guest' | 'signed'>('locked');

  // restore from localStorage so a tab refresh doesn't wipe progress
  useEffect(() => {
    const key = `lab:wordle:${todayIso}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { guesses: string[]; mode?: 'guest' | 'signed' };
        setGuesses(saved.guesses ?? []);
        if ((saved.guesses ?? []).length > 0 && saved.mode) {
          // already committed to a mode this run — skip the lock.
          setMode(saved.mode);
        }
      } catch {
        /* ignore */
      }
    }
  }, [todayIso]);

  // auto-unlock once we see a signed-in session WITH the leaderboard
  // scope — a guestbook-only token can't publish scores, so we keep the
  // gate up to prompt for a sign-in that grants the right permission.
  const canPublishScore = sessionHasScope(session, LEADERBOARD_WRITE_SCOPE);
  useEffect(() => {
    if (session && canPublishScore && mode === 'locked') setMode('signed');
  }, [session, canPublishScore, mode]);
  useEffect(() => {
    const key = `lab:wordle:${todayIso}`;
    const persistMode: 'guest' | 'signed' | undefined = mode === 'locked' ? undefined : mode;
    localStorage.setItem(key, JSON.stringify({ guesses, mode: persistMode }));
  }, [guesses, todayIso, mode]);

  const solved = guesses.length > 0 && guesses[guesses.length - 1] === answer;
  const finished = solved || guesses.length >= 6;

  const submit = useCallback(() => {
    if (current.length !== 5 || finished) return;
    // reject non-words so the grid isn't a brute-force target. shake the
    // active row + surface a small hint instead of submitting.
    if (!isWordleWord(current)) {
      setShake(true);
      setInvalidMsg('not in word list');
      window.setTimeout(() => setShake(false), 320);
      window.setTimeout(() => setInvalidMsg(null), 1600);
      return;
    }
    setGuesses((g) => [...g, current]);
    setCurrent('');
    setInvalidMsg(null);
  }, [current, finished]);

  async function startSignIn(handle: string) {
    setPublishError(null);
    setSigningIn(true);
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
      setSigningIn(false);
    }
  }

  async function publish() {
    if (!session || !solved || publishState === 'signing' || publishState === 'publishing') return;
    setPublishError(null);
    setPublishState('signing');
    try {
      const did = session.info.sub;
      const signed = await signScore({
        data: { game: GAME_ID, score: guesses.length, did, guesses },
      });
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
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['leaderboard', GAME_ID] }), 2000);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
      setPublishState('error');
    }
  }

  // keyboard input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // don't capture input while the sign-in gate is up — otherwise the
      // user's handle gets typed into the puzzle in the background.
      if (finished || mode === 'locked') return;
      const k = e.key;
      if (k === 'Enter') {
        submit();
      } else if (k === 'Backspace') {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(k) && current.length < 5) {
        setCurrent((c) => (c + k.toLowerCase()).slice(0, 5));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current.length, finished, submit]);

  // compose all 6 rows (previous guesses + current + empty slots)
  const rows: { letters: string[]; states: LetterState[] }[] = [];
  for (const g of guesses) rows.push({ letters: g.split(''), states: judge(g, answer) });
  if (!finished) {
    const cur = current.padEnd(5, ' ').split('').map((c) => (c === ' ' ? '' : c));
    rows.push({ letters: cur, states: Array(5).fill('empty') });
  }
  while (rows.length < 6) rows.push({ letters: Array(5).fill(''), states: Array(5).fill('empty') });

  // per-key state for the virtual keyboard: strongest signal wins
  // (correct > present > absent).
  const keyState: Record<string, LetterState> = {};
  for (const g of guesses) {
    const states = judge(g, answer);
    for (let i = 0; i < 5; i++) {
      const k = g[i];
      const s = states[i];
      const cur = keyState[k];
      if (cur === 'correct') continue;
      if (cur === 'present' && s === 'absent') continue;
      keyState[k] = s;
    }
  }

  function tap(k: string) {
    if (finished || mode === 'locked') return;
    if (k === 'enter') submit();
    else if (k === 'back') setCurrent((c) => c.slice(0, -1));
    else if (current.length < 5) setCurrent((c) => c + k);
  }

  function shareGrid(): string {
    const emojiFor = (s: LetterState) =>
      s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛';
    const lines = guesses.map((g) => judge(g, answer).map(emojiFor).join(''));
    const attempts = solved ? guesses.length : 'X';
    return `imlunahey.com wordle #${puzzleIdx} ${attempts}/6\n\n${lines.join('\n')}`;
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(shareGrid());
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-wordle">
        <header className="page-hd">
          <div className="label">~/labs/wordle</div>
          <h1>wordle<span className="dot">.</span></h1>
          <p className="sub">
            one five-letter word, six guesses. the answer is the same everywhere today — seeded
            from the date. come back tomorrow for a new one.
          </p>
          <div className="meta">
            <span>puzzle <b className="t-accent">#{puzzleIdx}</b></span>
            <span>date <b>{today.toISOString().slice(0, 10)}</b></span>
            <span>guesses <b>{guesses.length}/6</b></span>
            <span>
              status{' '}
              <b className={solved ? 't-accent' : finished ? 't-alert' : undefined}>
                {solved ? 'solved' : finished ? 'out of guesses' : 'in progress'}
              </b>
            </span>
          </div>
        </header>

        {mode === 'locked' ? (
          <section className="gate">
            <div className="gate-title">today&apos;s puzzle.</div>
            <div className="gate-sub">
              scores post to an atproto leaderboard — sign in to claim yours, or play as guest
              and your result stays on this device.
            </div>
            <form
              className="gate-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (handleInput.trim()) void startSignIn(handleInput);
              }}
            >
              <input
                className="gate-input"
                placeholder="your.handle.bsky.social"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                disabled={signingIn}
              />
              <button
                className="gate-btn primary"
                type="submit"
                disabled={!handleInput.trim() || signingIn}
              >
                {signingIn ? 'redirecting…' : 'sign in'}
              </button>
            </form>
            <button
              className="gate-btn"
              type="button"
              onClick={() => setMode('guest')}
              disabled={signingIn}
            >
              play as guest
            </button>
            {publishError ? <div className="publish-err">{publishError}</div> : null}
          </section>
        ) : (
          <section className="board">
            {rows.map((row, i) => {
              const isActive = !finished && i === guesses.length;
              return (
                <div key={i} className={`row${isActive && shake ? ' shake' : ''}`}>
                  {row.letters.map((l, j) => (
                    <div key={j} className={`tile ${row.states[j]}`}>{l}</div>
                  ))}
                </div>
              );
            })}
            {invalidMsg ? <div className="invalid-msg">{invalidMsg}</div> : null}
          </section>
        )}

        {mode !== 'locked' ? (
          <section className="keyboard">
            {KEYBOARD_ROWS.map((r, i) => (
              <div key={i} className="kbrow">
                {i === 2 ? <button className="key wide" onClick={() => tap('enter')} type="button">enter</button> : null}
                {r.split('').map((k) => (
                  <button
                    key={k}
                    className={`key ${keyState[k] ?? ''}`}
                    onClick={() => tap(k)}
                    type="button"
                  >
                    {k}
                  </button>
                ))}
                {i === 2 ? <button className="key wide" onClick={() => tap('back')} type="button">⌫</button> : null}
              </div>
            ))}
          </section>
        ) : null}

        {finished ? (
          <section className="result">
            <div className="r-head">
              {solved ? '✓ solved' : `the word was ${answer}`}
            </div>
            <pre className="r-grid">{shareGrid()}</pre>
            <div className="r-actions">
              <button className="copy" onClick={() => void copyResult()} type="button">
                copy result
              </button>
              {solved && session && canPublishScore ? (
                publishState === 'published' ? (
                  <span className="r-published">
                    ✓ published as <b className="t-accent">@{profile?.handle ?? session.info.sub}</b>
                  </span>
                ) : (
                  <button
                    className="copy primary"
                    onClick={() => void publish()}
                    disabled={publishState === 'signing' || publishState === 'publishing'}
                    type="button"
                  >
                    {publishState === 'signing'
                      ? 'signing…'
                      : publishState === 'publishing'
                        ? 'publishing…'
                        : 'publish score'}
                  </button>
                )
              ) : solved ? (
                <span className="r-published t-faint">
                  playing as guest — score not on leaderboard. sign in next time.
                </span>
              ) : null}
            </div>
            {publishError ? <div className="publish-err">{publishError}</div> : null}
          </section>
        ) : null}

        <WordleBoard rows={board ?? null} myDid={session?.info.sub ?? null} />

        <footer className="wordle-footer">
          <span>src: <span className="t-accent">hand-written · ~200 lines</span></span>
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
  .shell-wordle { max-width: 560px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; line-height: 0.9; color: var(--color-fg); }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 58ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .meta {
    display: flex; gap: var(--sp-4); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }
  .page-hd .meta b.t-alert { color: var(--color-alert); }

  .board {
    display: flex; flex-direction: column; gap: 6px;
    margin: var(--sp-6) auto 0;
    max-width: 360px;
  }
  .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .tile {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: clamp(24px, 6vw, 36px);
    text-transform: uppercase;
    font-weight: 500;
    color: var(--color-fg);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border-bright);
    user-select: none;
  }
  .tile.correct { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-bg); }
  .tile.present { background: oklch(0.78 0.14 85); border-color: oklch(0.78 0.14 85); color: var(--color-bg); }
  .tile.absent { background: var(--color-bg-raised); border-color: var(--color-border); color: var(--color-fg-faint); }

  .keyboard {
    display: flex; flex-direction: column; gap: 4px;
    margin: var(--sp-6) 0 0;
  }
  .kbrow { display: flex; gap: 4px; justify-content: center; }
  .key {
    font-family: var(--font-mono); font-size: var(--fs-md);
    padding: 10px 0;
    min-width: 30px; flex: 1 1 30px;
    max-width: 40px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .key.wide { flex: 1.8 1 0; max-width: 64px; font-size: 11px; letter-spacing: 0.1em; text-transform: lowercase; }
  .key.correct { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-bg); }
  .key.present { background: oklch(0.78 0.14 85); border-color: oklch(0.78 0.14 85); color: var(--color-bg); }
  .key.absent { background: var(--color-bg-raised); border-color: var(--color-border); color: var(--color-fg-ghost); }
  .key:hover:not(.correct):not(.present):not(.absent) { border-color: var(--color-accent-dim); color: var(--color-accent); }

  .result {
    margin-top: var(--sp-6);
    padding: var(--sp-4);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel));
    text-align: center;
  }
  .r-head {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--color-accent);
    text-shadow: 0 0 12px var(--accent-glow);
    margin-bottom: var(--sp-3);
  }
  .r-grid {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-fg);
    line-height: 1.4;
    margin: 0 0 var(--sp-3);
    white-space: pre-wrap;
  }
  .copy {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 14px;
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
    cursor: pointer;
    text-transform: lowercase;
  }

  .gate {
    margin: var(--sp-6) auto 0;
    max-width: 400px;
    display: flex; flex-direction: column; align-items: stretch;
    gap: var(--sp-3);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel));
    text-align: center;
  }
  .gate-title {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--color-accent);
    letter-spacing: -0.01em;
    text-shadow: 0 0 12px var(--accent-glow);
  }
  .gate-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    line-height: 1.55;
  }
  .gate-form { display: flex; gap: 6px; }
  .gate-input {
    flex: 1; min-width: 0;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .gate-input:focus { outline: none; border-color: var(--color-accent); }
  .gate-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .gate-btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .gate-btn.primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-bg);
  }
  .gate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .row.shake { animation: wordle-shake 0.3s ease-in-out; }
  @keyframes wordle-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  .invalid-msg {
    margin-top: 8px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-alert);
  }

  .r-actions {
    display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
    margin-top: var(--sp-3);
  }
  .copy.primary {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
  }
  .copy:disabled { opacity: 0.5; cursor: not-allowed; }
  .r-published {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    align-self: center;
  }
  .r-published b.t-accent { color: var(--color-accent); font-weight: 400; }
  .inline-signin { display: flex; gap: 4px; flex: 1 1 240px; }
  .handle-in {
    flex: 1; min-width: 0;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 8px;
  }
  .handle-in:focus { outline: none; border-color: var(--color-accent); }
  .publish-err {
    margin-top: var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-alert);
    text-align: center;
  }

  /* leaderboard panel */
  .wl {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .wl-head {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .wl-head .t-accent { color: var(--color-accent); }
  .wl-empty { padding: var(--sp-5) var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-align: center; }
  .wl-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    gap: var(--sp-2);
    padding: 6px var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .wl-row:last-child { border-bottom: 0; }
  .wl-row.me { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .wl-who-link, .wl-record-link {
    display: flex; align-items: center; gap: 6px;
    color: inherit; text-decoration: none;
    min-width: 0;
  }
  .wl-who-link:hover .wl-name { color: var(--color-accent); }
  .wl-record-link:hover .wl-score { color: color-mix(in oklch, var(--color-accent) 85%, white); text-shadow: 0 0 8px var(--accent-glow); }
  .wl-record-link:hover .wl-when { color: var(--color-fg-dim); }
  .wl-rank { color: var(--color-fg-faint); }
  .wl-rank.top1 { color: var(--color-accent); }
  .wl-avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--color-bg-raised); border: 1px solid var(--color-border); object-fit: cover; }
  .wl-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wl-score { color: var(--color-accent); font-weight: 500; }
  .wl-when { color: var(--color-fg-faint); font-size: 10px; }

  .wordle-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
`;

function WordleBoard({ rows, myDid }: { rows: LeaderboardRow[] | null; myDid: string | null }) {
  return (
    <div className="wl">
      <div className="wl-head">
        <span className="t-accent">./today --leaderboard</span>
        <span>lower is better · sig-verified</span>
      </div>
      {rows === null ? (
        <div className="wl-empty">loading scores…</div>
      ) : rows.length === 0 ? (
        <div className="wl-empty">no one&apos;s solved today yet.</div>
      ) : (
        rows.map((r, i) => (
          <div key={r.uri} className={`wl-row${r.did === myDid ? ' me' : ''}`}>
            <span className={`wl-rank ${i === 0 ? 'top1' : ''}`}>#{i + 1}</span>
            <a
              className="wl-who-link"
              href={`https://bsky.app/profile/${r.handle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.avatar ? <img src={r.avatar} alt="" className="wl-avatar" loading="lazy" /> : <span className="wl-avatar" />}
              <span className="wl-name">@{r.handle}</span>
            </a>
            <Link
              className="wl-record-link"
              to={`/labs/at-uri/${r.uri.replace('at://', '')}` as never}
            >
              <span className="wl-score">{r.score}/6</span>
              <span className="wl-when">{relative(r.achievedAt)}</span>
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
  return iso.slice(11, 16);
}
