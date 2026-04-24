import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// a pool of ordinary sentences so runs feel different. no weird quotes,
// no code — just english readable at speed.
const SENTENCE_POOL = [
  'the quiet hum of a well-built system is the most reliable music in the building.',
  'every sufficiently small tool eventually grows a plugin api and someone writes a plugin for it.',
  'reading the source is faster than reading the docs when the docs have not been updated in two years.',
  'the best piece of advice i ever ignored was that the first draft should always be terrible.',
  'a green screen at three in the morning is the loneliest kind of progress.',
  'naming things is the second hardest problem; deleting things you once named is the first.',
  'the api feels right when the wrong call is harder to write than the right one.',
  'caching is what you do when you have lost the argument with latency.',
  'a good error message points at the code that will fix it, not the one that raised it.',
  'systems that let you inspect their state always win against systems that ask you to trust them.',
  'the best time to write the test was before writing the bug; the second best is now.',
  'the deployment pipeline is where software quality and organisational politics collide in public.',
  'most of the web was built by people solving one problem and accidentally shipping the whole solution.',
  'a tidy file tree and a tidy schema are often the same instinct expressed in different places.',
];

type Choice = 15 | 30 | 60;

function pickText(seed: number, minWords: number): string {
  // shuffle sentences and pick enough to fill the requested duration
  const pool = [...SENTENCE_POOL];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: string[] = [];
  let words = 0;
  for (const sentence of pool) {
    out.push(sentence);
    words += sentence.split(/\s+/).length;
    if (words >= minWords) break;
  }
  return out.join(' ');
}

type Status = 'idle' | 'running' | 'done';

export default function TypingPage() {
  const [duration, setDuration] = useState<Choice>(30);
  const [text, setText] = useState(() => pickText(Date.now(), 120));
  const [typed, setTyped] = useState('');
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [best, setBest] = useState<Record<Choice, number>>({ 15: 0, 30: 0, 60: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('lab:typing:best');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<Choice, number>;
        setBest({ 15: parsed[15] ?? 0, 30: parsed[30] ?? 0, 60: parsed[60] ?? 0 });
      } catch {
        /* ignore */
      }
    }
  }, []);

  // tick while running
  useEffect(() => {
    if (status !== 'running' || startAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [status, startAt]);

  const elapsed = startAt === null ? 0 : (now - startAt) / 1000;
  const remaining = Math.max(0, duration - elapsed);

  // auto-end when time runs out
  useEffect(() => {
    if (status === 'running' && remaining <= 0) {
      setStatus('done');
    }
  }, [status, remaining]);

  const reset = useCallback((d: Choice = duration) => {
    setDuration(d);
    setText(pickText(Date.now(), d === 60 ? 220 : d === 30 ? 120 : 70));
    setTyped('');
    setStartAt(null);
    setNow(0);
    setStatus('idle');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [duration]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (status === 'done') return;
    if (status === 'idle' && v.length > 0) {
      setStartAt(Date.now());
      setNow(Date.now());
      setStatus('running');
    }
    setTyped(v);
    if (v.length >= text.length) {
      setStatus('done');
    }
  }

  // metrics
  const stats = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === text[i]) correct += 1;
    const mistakes = typed.length - correct;
    const minutes = elapsed / 60;
    // standard wpm convention: 5 chars = 1 word, count only correctly typed chars
    const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
    const acc = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
    return { correct, mistakes, wpm, acc };
  }, [typed, text, elapsed]);

  // persist best on finish
  useEffect(() => {
    if (status !== 'done') return;
    if (stats.wpm <= (best[duration] ?? 0)) return;
    const next = { ...best, [duration]: stats.wpm };
    setBest(next);
    localStorage.setItem('lab:typing:best', JSON.stringify(next));
  }, [status, stats.wpm, duration, best]);

  // render the prompt with per-char state
  const charClass = (i: number): string => {
    if (i >= typed.length) return i === typed.length && status === 'running' ? 'cursor' : 'pending';
    return typed[i] === text[i] ? 'ok' : 'err';
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-typing">
        <header className="page-hd">
          <div className="label">~/labs/typing</div>
          <h1>typing<span className="dot">.</span></h1>
          <p className="sub">
            a short timed run. start typing to begin — the clock doesn&apos;t start until you do.
            wpm counts correct characters only; accuracy is mistakes vs total keystrokes.
          </p>
          <div className="meta">
            <span>wpm <b className="t-accent">{stats.wpm}</b></span>
            <span>accuracy <b>{stats.acc}%</b></span>
            <span>time <b>{Math.max(0, remaining).toFixed(1)}s</b></span>
            <span>best <b>{best[duration]} wpm</b></span>
          </div>
        </header>

        <section className="choices">
          <span className="t-faint">duration</span>
          {[15, 30, 60].map((n) => (
            <button
              key={n}
              className={'chip' + (duration === n ? ' on' : '')}
              onClick={() => reset(n as Choice)}
              type="button"
            >
              {n}s
            </button>
          ))}
          <button className="chip" onClick={() => reset()} type="button">
            ↻ new text
          </button>
        </section>

        <section
          className={`prompt ${status}`}
          onClick={() => inputRef.current?.focus()}
          role="textbox"
          aria-label="typing prompt"
          tabIndex={0}
        >
          {text.split('').map((c, i) => (
            <span key={i} className={charClass(i)}>{c}</span>
          ))}
          <input
            ref={inputRef}
            className="hidden-input"
            type="text"
            value={typed}
            onChange={handleChange}
            aria-label="typing input"
            autoFocus
            disabled={status === 'done'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </section>

        {status === 'done' ? (
          <section className="result">
            <div className="r-head">done.</div>
            <dl className="r-dl">
              <dt>wpm</dt><dd><b className="t-accent">{stats.wpm}</b></dd>
              <dt>accuracy</dt><dd>{stats.acc}%</dd>
              <dt>correct</dt><dd>{stats.correct}</dd>
              <dt>mistakes</dt><dd>{stats.mistakes}</dd>
              <dt>duration</dt><dd>{duration}s</dd>
            </dl>
            <button className="btn-primary" onClick={() => reset()} type="button">
              go again
            </button>
          </section>
        ) : null}

        <footer className="typing-footer">
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
  .shell-typing { max-width: 860px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; line-height: 0.9; color: var(--color-fg); }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 60ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); font-size: 18px; }

  .choices {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
    margin: var(--sp-5) 0 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .choices .t-faint { margin-right: var(--sp-2); }
  .chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .chip:hover { border-color: var(--color-accent-dim); color: var(--color-fg); }
  .chip.on { background: color-mix(in oklch, var(--color-accent) 10%, transparent); border-color: var(--color-accent); color: var(--color-accent); }

  .prompt {
    margin-top: var(--sp-4);
    padding: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: clamp(18px, 2.6vw, 24px);
    line-height: 1.6;
    color: var(--color-fg-faint);
    cursor: text;
    position: relative;
    user-select: none;
    text-wrap: pretty;
  }
  .prompt .pending { color: var(--color-fg-faint); }
  .prompt .ok { color: var(--color-fg); }
  .prompt .err {
    color: var(--color-alert);
    background: color-mix(in oklch, var(--color-alert) 18%, transparent);
    text-decoration: underline wavy;
    text-underline-offset: 3px;
  }
  .prompt .cursor {
    color: var(--color-fg-faint);
    background: color-mix(in oklch, var(--color-accent) 25%, transparent);
    animation: type-blink 0.9s ease-in-out infinite;
  }
  @keyframes type-blink { 0%, 100% { background: color-mix(in oklch, var(--color-accent) 30%, transparent); } 50% { background: color-mix(in oklch, var(--color-accent) 5%, transparent); } }
  .hidden-input {
    position: absolute; opacity: 0; pointer-events: none;
    left: -9999px; top: -9999px;
    width: 1px; height: 1px;
  }

  .result {
    margin-top: var(--sp-5);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel));
  }
  .r-head {
    font-family: var(--font-display); font-size: 28px;
    color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow);
    margin-bottom: var(--sp-3);
  }
  .r-dl {
    display: grid; grid-template-columns: auto 1fr;
    gap: 6px var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    margin: 0 0 var(--sp-4);
  }
  .r-dl dt { color: var(--color-fg-faint); }
  .r-dl dd { color: var(--color-fg); margin: 0; }
  .r-dl dd b { color: var(--color-accent); font-weight: 400; font-size: 22px; }
  .btn-primary {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 16px;
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }

  .typing-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
`;
