import { Link } from '@tanstack/react-router';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import { useState } from 'react';

const PRESETS: { label: string; expr: string }[] = [
  { label: 'every minute', expr: '* * * * *' },
  { label: 'every 5 minutes', expr: '*/5 * * * *' },
  { label: 'hourly', expr: '0 * * * *' },
  { label: 'daily @ 02:30', expr: '30 2 * * *' },
  { label: 'weekdays @ 09:00', expr: '0 9 * * 1-5' },
  { label: 'first of the month', expr: '0 0 1 * *' },
  { label: 'every sunday', expr: '0 12 * * 0' },
];

type Fire = { iso: string; delta: string };

function fmtDelta(ms: number): string {
  if (ms < 60_000) return `in ${Math.max(0, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `in ${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `in ${(ms / 3_600_000).toFixed(1)}h`;
  return `in ${Math.round(ms / 86_400_000)}d`;
}

function fmtIso(d: Date): string {
  return (
    d.toISOString().slice(0, 10) +
    ' ' +
    d.toISOString().slice(11, 19) +
    'z'
  );
}

export default function CronPage() {
  const [expr, setExpr] = useState('*/5 * * * *');

  const trimmed = expr.trim();
  let human = '';
  let humanErr: string | null = null;
  try {
    human = trimmed ? cronstrue.toString(trimmed, { verbose: false }) : '';
  } catch (err) {
    humanErr = err instanceof Error ? err.message : String(err);
  }

  let fires: Fire[] = [];
  let parseErr: string | null = null;
  try {
    if (trimmed) {
      const parser = CronExpressionParser.parse(trimmed, { currentDate: new Date() });
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        const next = parser.next().toDate();
        fires.push({ iso: fmtIso(next), delta: fmtDelta(next.getTime() - now) });
      }
    }
  } catch (err) {
    parseErr = err instanceof Error ? err.message : String(err);
    fires = [];
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cron">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">cron</span>
        </div>

        <header className="c-hd">
          <h1>
            cron<span className="dot">.</span>
          </h1>
          <p className="sub">
            paste any 5-field cron expression to see it translated into english and get a preview of the next
            10 fire times in your local timezone. no server round-trip — everything runs in-browser.
          </p>
        </header>

        <section className="input-pane">
          <input
            className="inp"
            type="text"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="* * * * *"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="fields-rail">
            {['minute', 'hour', 'day', 'month', 'weekday'].map((f, i) => (
              <div key={f} className="field-chip">
                <span className="field-pos">{i + 1}</span>
                <span className="field-name">{f}</span>
              </div>
            ))}
          </div>
          <div className="presets">
            <span className="t-faint">try</span>
            {PRESETS.map((p) => (
              <button key={p.expr} type="button" className="preset" onClick={() => setExpr(p.expr)}>
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {humanErr || parseErr ? (
          <section className="err">
            <div className="err-hd">// error</div>
            <div className="err-body">{humanErr ?? parseErr}</div>
          </section>
        ) : null}

        {trimmed && human ? (
          <section className="human">
            <div className="human-kind">// english</div>
            <div className="human-body">{human.toLowerCase()}</div>
          </section>
        ) : null}

        {fires.length > 0 ? (
          <section className="fires">
            <div className="fires-hd">
              <span>// next fires</span>
              <span className="t-faint">browser tz · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <ol className="fires-list">
              {fires.map((f, i) => (
                <li key={i} className="fire-row">
                  <span className="fire-idx">#{i + 1}</span>
                  <span className="fire-iso">{f.iso}</span>
                  <span className="fire-delta">{f.delta}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="cheat">
          <div className="cheat-hd">// syntax cheatsheet</div>
          <pre className="cheat-body">{`┌─────── minute        (0–59)
│ ┌───── hour          (0–23)
│ │ ┌─── day of month  (1–31)
│ │ │ ┌─ month         (1–12)  jan feb … dec
│ │ │ │ ┌ day of week  (0–6)   sun mon … sat
│ │ │ │ │
* * * * *

operators:
  *          any value
  5          exact value
  1,3,5      list
  1-5        range
  */15       step (every 15)
  @hourly    shortcut — also @daily @weekly @monthly @yearly`}</pre>
        </section>

        <footer className="c-footer">
          <span>
            src: <span className="t-accent">cronstrue · cron-parser · client-side</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">
              all labs
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-cron { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-6);
    margin-bottom: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .crumbs .last { color: var(--color-accent); }

  .c-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .c-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .c-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .c-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }

  .input-pane {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
    display: flex; flex-direction: column; gap: var(--sp-4);
  }
  .inp {
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-accent);
    font: inherit;
    font-family: var(--font-mono);
    font-size: 22px;
    letter-spacing: 0.12em;
    text-align: center;
  }
  .inp:focus { outline: none; border-color: var(--color-accent); }
  .inp::placeholder { color: var(--color-fg-ghost); letter-spacing: 0.12em; }

  .fields-rail {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .field-chip {
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    display: flex; gap: 6px; align-items: baseline;
    justify-content: center;
  }
  .field-pos {
    color: var(--color-accent-dim);
    font-size: 10px;
  }
  .field-name { color: var(--color-fg-dim); text-transform: lowercase; }

  .presets {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .preset {
    padding: 3px 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase;
  }
  .preset:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .human {
    margin-top: var(--sp-4);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
  }
  .human-kind {
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-2);
  }
  .human-body {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.55;
  }

  .fires {
    margin-top: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .fires-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .fires-list {
    list-style: none;
    margin: 0;
    padding: var(--sp-2) 0;
  }
  .fire-row {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: var(--sp-3);
    padding: 6px var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    align-items: baseline;
    border-bottom: 1px dashed var(--color-border);
  }
  .fire-row:last-child { border-bottom: 0; }
  .fire-idx { color: var(--color-fg-faint); }
  .fire-iso { color: var(--color-fg); }
  .fire-delta { color: var(--color-accent); }

  .err {
    margin-top: var(--sp-4);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .err-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-alert) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-alert);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .err-body { padding: var(--sp-3) var(--sp-4); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .cheat {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .cheat-hd {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-3);
  }
  .cheat-body {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    line-height: 1.6;
    white-space: pre;
    overflow-x: auto;
  }

  .c-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
