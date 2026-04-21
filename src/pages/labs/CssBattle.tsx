import { Link, Navigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { BATTLES } from './css-battles/battles';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
}

export default function CssBattlePage() {
  const params = useParams({ strict: false }) as { date?: string };
  const battle = BATTLES.find((b) => b.date === params.date);
  const [copied, setCopied] = useState(false);

  if (!battle) return <Navigate to={'/not-found' as never} replace />;

  const Art = battle.component;
  const idx = BATTLES.findIndex((b) => b.date === battle.date);
  const prev = idx > 0 ? BATTLES[idx - 1] : undefined;
  const next = idx < BATTLES.length - 1 ? BATTLES[idx + 1] : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(battle.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-battle">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <Link to="/labs/css-battles">css-battles</Link>
          <span className="sep">/</span>
          <span className="last">{battle.date}</span>
        </div>

        <header className="battle-hd">
          <div>
            <h1>
              {fmtDate(battle.date)}
              <span className="dot">.</span>
            </h1>
            <div className="meta">
              <span>canvas <b>400 × 300</b></span>
              <a href={battle.href} target="_blank" rel="noopener noreferrer" className="t-accent">
                cssbattle.dev ↗
              </a>
            </div>
          </div>
        </header>

        <section className="preview">
          <div className="canvas">
            <Art />
          </div>
        </section>

        <section className="code">
          <div className="code-top">
            <span>
              <b>src</b> / daily-targets / {battle.date}.tsx
            </span>
            <button type="button" className={'copy' + (copied ? ' flash' : '')} onClick={copy}>
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <pre>
            <code>{battle.source}</code>
          </pre>
        </section>

        <nav className="pager">
          {prev ? (
            <Link to={`/labs/css-battles/${prev.date}` as never} className="pg prev">
              <span className="arr">←</span>
              <span className="side">
                <span className="side-lbl">older</span>
                <span className="side-d">{fmtDate(prev.date)}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={`/labs/css-battles/${next.date}` as never} className="pg next">
              <span className="side">
                <span className="side-lbl">newer</span>
                <span className="side-d">{fmtDate(next.date)}</span>
              </span>
              <span className="arr">→</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <footer className="battle-footer">
          <span>
            src: <span className="t-accent">hand-authored · pure css</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs/css-battles" className="t-accent">
              all battles
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-battle { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .battle-hd {
    padding-bottom: var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .battle-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .battle-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .battle-hd .meta {
    display: flex; gap: var(--sp-6);
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    align-items: center;
  }
  .battle-hd .meta b { color: var(--color-fg); font-weight: 400; }

  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-8) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .preview .canvas {
    position: relative;
    width: 400px;
    height: 300px;
    border: 1px solid var(--color-border);
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--color-bg), 0 0 32px color-mix(in oklch, var(--color-accent) 20%, transparent);
  }

  .code {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .code-top {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .code-top b { color: var(--color-accent-dim); font-weight: 400; }
  .copy {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-size: 10px;
    padding: 2px 10px;
    cursor: pointer;
    text-transform: lowercase;
    font-family: var(--font-mono);
  }
  .copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }
  .code pre {
    margin: 0;
    padding: var(--sp-4) var(--sp-5);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-fg);
  }
  .code code {
    font-family: inherit;
    background: transparent;
    border: 0;
    padding: 0;
    color: inherit;
    white-space: pre;
  }

  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin-top: var(--sp-8);
  }
  .pg {
    display: flex; align-items: center; gap: var(--sp-3);
    padding: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: inherit;
    text-decoration: none;
    font-family: var(--font-mono);
  }
  .pg:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .pg:hover .arr { color: var(--color-accent); }
  .pg.next { justify-content: flex-end; text-align: right; }
  .pg .arr { color: var(--color-fg-faint); font-size: 20px; line-height: 1; }
  .pg .side { display: flex; flex-direction: column; gap: 2px; }
  .pg .side-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--color-fg-faint); }
  .pg .side-d { color: var(--color-fg); font-size: var(--fs-sm); }
  .pg:hover .side-d { color: var(--color-accent); }

  .battle-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
