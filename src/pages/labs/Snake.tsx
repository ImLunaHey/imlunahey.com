import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import { ensureOAuthConfigured, LEADERBOARD_SCOPE, LEADERBOARD_WRITE_SCOPE, sessionHasScope } from '../../lib/oauth';
import {
  getLeaderboard,
  LEADERBOARD_MARKER_URI,
  LEADERBOARD_SCORE_COLLECTION,
  signScore,
  type LeaderboardRow,
} from '../../server/leaderboard';

const COLS = 24;
const ROWS = 16;
const TICK_MS = 110;
const GAME_ID = 'snake' as const;

type Pt = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

function eq(a: Pt, b: Pt) {
  return a.x === b.x && a.y === b.y;
}

function spawnFood(snake: Pt[]): Pt {
  // pick a random empty cell. at worst (full grid) this loops forever,
  // but the game is over well before then.
  while (true) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => eq(s, p))) return p;
  }
}

function initialSnake(): Pt[] {
  const mid = Math.floor(ROWS / 2);
  return [
    { x: 6, y: mid },
    { x: 5, y: mid },
    { x: 4, y: mid },
  ];
}

export default function SnakePage() {
  const [snake, setSnake] = useState<Pt[]>(initialSnake);
  const [food, setFood] = useState<Pt>(() => spawnFood(initialSnake()));
  const [dir, setDir] = useState<Dir>('right');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  // 'locked' is a pre-game gate asking the player to pick guest vs sign-in.
  // once they pick we remember it and never lock again this tab.
  const [status, setStatus] = useState<'locked' | 'playing' | 'paused' | 'dead'>('locked');
  const [mode, setMode] = useState<'guest' | 'signed'>('guest');
  const [publishState, setPublishState] = useState<'idle' | 'signing' | 'publishing' | 'published' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');

  const { session } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const queryClient = useQueryClient();
  const { data: board } = useQuery({
    queryKey: ['leaderboard', GAME_ID],
    queryFn: () => getLeaderboard({ data: { game: GAME_ID } }),
  });

  // keep the latest direction in a ref so the keyboard handler reads
  // fresh values without re-registering.
  const dirRef = useRef<Dir>(dir);
  dirRef.current = dir;
  // same for snake, so keydown can reject a 180° turn.
  const snakeRef = useRef<Pt[]>(snake);
  snakeRef.current = snake;

  useEffect(() => {
    const raw = localStorage.getItem('lab:snake:best');
    if (raw) setBest(Math.max(0, parseInt(raw, 10) || 0));
  }, []);

  // if the user is already signed in when they land here, skip the
  // guest/sign-in gate and go straight to the normal "paused, press space"
  // state. only auto-unlock if the session actually has the leaderboard
  // scope — a guestbook-only session can't publish scores, so we leave
  // the gate up to prompt for a sign-in that grants the right permission.
  const canPublishScore = sessionHasScope(session, LEADERBOARD_WRITE_SCOPE);
  useEffect(() => {
    if (session && canPublishScore && status === 'locked') {
      setMode('signed');
      setStatus('paused');
    }
  }, [session, canPublishScore, status]);

  const reset = useCallback(() => {
    const s = initialSnake();
    setSnake(s);
    setFood(spawnFood(s));
    setDir('right');
    setScore(0);
    setPublishState('idle');
    setPublishError(null);
    setStatus('playing');
  }, []);

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
    if (!session || publishState === 'signing' || publishState === 'publishing') return;
    setPublishError(null);
    setPublishState('signing');
    try {
      const did = session.info.sub;
      const signed = await signScore({ data: { game: GAME_ID, score, did } });
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

  // keyboard: arrows / wasd to turn; space to pause; enter to restart on death.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack keys while the user is typing in a form field — otherwise
      // typing "wasd" in the alias input steered the snake + swallowed the chars.
      const t = e.target as HTMLElement | null;
      const inField =
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        t?.isContentEditable === true;
      if (inField) return;

      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase()) || ['w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
      }
      if (k === ' ') {
        setStatus((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
        return;
      }
      if (k === 'enter' && (status === 'dead' || status === 'paused')) {
        reset();
        return;
      }
      const next: Dir | null =
        k === 'arrowup' || k === 'w' ? 'up' :
        k === 'arrowdown' || k === 's' ? 'down' :
        k === 'arrowleft' || k === 'a' ? 'left' :
        k === 'arrowright' || k === 'd' ? 'right' :
        null;
      if (!next) return;
      // reject 180° turns — snake has length ≥ 2 so reversing would eat yourself.
      const opp: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (next === opp[dirRef.current] && snakeRef.current.length > 1) return;
      setDir(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset, status]);

  // game loop
  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => {
      setSnake((prev) => {
        const head = prev[0];
        const d = dirRef.current;
        const nextHead: Pt = {
          x: head.x + (d === 'left' ? -1 : d === 'right' ? 1 : 0),
          y: head.y + (d === 'up' ? -1 : d === 'down' ? 1 : 0),
        };

        const hitWall =
          nextHead.x < 0 || nextHead.x >= COLS || nextHead.y < 0 || nextHead.y >= ROWS;
        const hitSelf = prev.some((s, i) => i < prev.length - 1 && eq(s, nextHead));
        if (hitWall || hitSelf) {
          setStatus('dead');
          setBest((b) => {
            const next = Math.max(b, prev.length - 3);
            localStorage.setItem('lab:snake:best', String(next));
            return next;
          });
          return prev;
        }

        const ate = eq(nextHead, food);
        const newSnake = ate ? [nextHead, ...prev] : [nextHead, ...prev.slice(0, -1)];
        if (ate) {
          setFood(spawnFood(newSnake));
          setScore((s) => s + 1);
        }
        return newSnake;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, food]);

  // render as a single path in svg — one rect per cell is fine at this size.
  const cells: Array<{ x: number; y: number; kind: 'head' | 'body' | 'food' }> = [];
  snake.forEach((p, i) => cells.push({ x: p.x, y: p.y, kind: i === 0 ? 'head' : 'body' }));
  cells.push({ x: food.x, y: food.y, kind: 'food' });

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-snake">
        <header className="page-hd">
          <div className="label">~/labs/snake</div>
          <h1>snake<span className="dot">.</span></h1>
          <p className="sub">
            arrow keys or wasd. <kbd>space</kbd> to pause, <kbd>enter</kbd> to restart. no physics,
            no ads, no cloud sync — just a dot that grows.
          </p>
          <div className="meta">
            <span>score <b className="t-accent">{score}</b></span>
            <span>best <b>{best}</b></span>
            <span>speed <b>{Math.round(1000 / TICK_MS)} tps</b></span>
            <span>status <b className={status === 'dead' ? 't-alert' : 't-accent'}>{status}</b></span>
          </div>
        </header>

        <section className="stage-wrap">
          <svg viewBox={`0 0 ${COLS} ${ROWS}`} className="stage" role="img" aria-label="snake board">
            <rect x={0} y={0} width={COLS} height={ROWS} className="bg" />
            {Array.from({ length: COLS * ROWS }).map((_, i) => {
              const x = i % COLS;
              const y = Math.floor(i / COLS);
              return <rect key={i} x={x + 0.12} y={y + 0.12} width={0.18} height={0.18} className="grid-dot" />;
            })}
            {cells.map((c, i) => (
              <rect
                key={i}
                x={c.x + 0.08}
                y={c.y + 0.08}
                width={0.84}
                height={0.84}
                className={`cell ${c.kind}`}
              />
            ))}
          </svg>

          {status === 'locked' ? (
            <div className="overlay lock">
              <div className="ov-title">snake.</div>
              <div className="ov-sub">
                scores go to a leaderboard backed by atproto. sign in to claim them, or play as
                guest — guest scores stay on this device and can&apos;t be published later.
              </div>
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
                  sign in
                </button>
              </form>
              <button
                className="ov-btn-ghost"
                type="button"
                onClick={() => {
                  setMode('guest');
                  setStatus('paused');
                }}
              >
                play as guest
              </button>
              {publishError ? <div className="ov-err">{publishError}</div> : null}
            </div>
          ) : status === 'dead' ? (
            <div className="overlay">
              <div className="ov-title">dead.</div>
              <div className="ov-score">
                <span className="ov-score-val">{score}</span>
                <span className="ov-score-lbl">food</span>
              </div>
              {mode === 'signed' && session && canPublishScore ? (
                publishState === 'published' ? (
                  <div className="ov-sub">
                    ✓ published as <b className="t-accent">@{profile?.handle ?? session.info.sub}</b>
                  </div>
                ) : score === 0 ? (
                  <div className="ov-sub t-faint">no score to publish.</div>
                ) : (
                  <>
                    <button
                      className="ov-btn"
                      onClick={() => void publish()}
                      disabled={publishState === 'signing' || publishState === 'publishing'}
                      type="button"
                    >
                      {publishState === 'signing'
                        ? 'signing…'
                        : publishState === 'publishing'
                          ? 'publishing…'
                          : 'publish to leaderboard'}
                    </button>
                    {publishError ? <div className="ov-err">{publishError}</div> : null}
                  </>
                )
              ) : (
                <div className="ov-sub t-faint">
                  playing as guest — <b>sign in next time</b> to claim scores like this.
                </div>
              )}
              <button className="ov-btn-ghost" onClick={reset} type="button">play again</button>
            </div>
          ) : status === 'paused' ? (
            <div className="overlay">
              <div className="ov-title">{score === 0 ? 'ready.' : 'paused.'}</div>
              <div className="ov-hint"><kbd>space</kbd> to start</div>
              <button className="ov-btn" onClick={() => setStatus('playing')} type="button">
                start
              </button>
            </div>
          ) : null}
        </section>

        <Leaderboard rows={board ?? null} myDid={session?.info.sub ?? null} />

        <footer className="snake-footer">
          <span>src: <span className="t-accent">hand-written · ~150 lines</span></span>
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
  .shell-snake { max-width: 960px; margin: 0 auto; padding: 0 var(--sp-6); }

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
  .page-hd .meta b.t-alert { color: var(--color-alert); }

  .stage-wrap { position: relative; margin-top: var(--sp-5); }
  .stage {
    display: block;
    width: 100%;
    aspect-ratio: ${COLS} / ${ROWS};
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    shape-rendering: crispEdges;
  }
  .stage .bg { fill: var(--color-bg-panel); }
  .stage .grid-dot { fill: var(--color-border); }
  .stage .cell.body { fill: color-mix(in oklch, var(--color-accent) 70%, var(--color-bg)); }
  .stage .cell.head { fill: var(--color-accent); filter: drop-shadow(0 0 0.1px var(--color-accent)); }
  .stage .cell.food { fill: oklch(0.78 0.16 45); filter: drop-shadow(0 0 0.2px oklch(0.78 0.16 45)); }

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
  .ov-hint { font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .ov-hint kbd {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    font-size: 10px; color: var(--color-fg);
    border-radius: 2px;
  }
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

  .lock .ov-title { font-size: clamp(40px, 7vw, 64px); }
  .ov-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    max-width: 48ch;
    text-align: center;
    line-height: 1.55;
  }
  .ov-sub b.t-accent { color: var(--color-accent); font-weight: 400; }
  .ov-sub.t-faint { color: var(--color-fg-faint); }
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
  .ov-score {
    display: flex; align-items: baseline; gap: 6px;
  }
  .ov-score-val {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 64px);
    color: var(--color-accent);
    text-shadow: 0 0 14px var(--accent-glow);
  }
  .ov-score-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .ov-err {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-alert);
    max-width: 48ch; text-align: center;
  }

  /* leaderboard */
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

  .snake-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

// ─── leaderboard panel ────────────────────────────────────────────────────

function Leaderboard({ rows, myDid }: { rows: LeaderboardRow[] | null; myDid: string | null }) {
  return (
    <div className="lb">
      <div className="lb-head">
        <span className="t-accent">./leaderboard --snake</span>
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
            {/* profile half — avatar + name link to bsky */}
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
            {/* record half — score + when open the at-uri resolver lab */}
            <Link
              className="lb-record-link"
              to={`/labs/at-uri/${r.uri.replace('at://', '')}` as never}
            >
              <span className="lb-score">{r.score}</span>
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
