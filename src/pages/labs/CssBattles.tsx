import { Link } from '@tanstack/react-router';
import { BATTLES } from './css-battles/battles';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
}

export default function CssBattlesPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="shell-battles">
        <header className="page-hd">
          <div className="crumbs">
            <Link to="/labs">~ / labs</Link>
            <span className="sep">/</span>
            <span className="last">css-battles</span>
          </div>
          <h1>
            css battles<span className="dot">.</span>
          </h1>
          <p className="sub">
            daily prompts from{' '}
            <a href="https://cssbattle.dev" target="_blank" rel="noopener noreferrer" className="glow-link">
              cssbattle.dev
            </a>
            . the goal: recreate a reference image using the fewest bytes of html + css. no svgs, no images — just divs
            and background colours.
          </p>
          <div className="meta">
            <span>
              entries <b>{BATTLES.length}</b>
            </span>
            <span>
              canvas <b>400 × 300</b>
            </span>
          </div>
        </header>

        <section className="battle-grid">
          {BATTLES.map((b) => {
            const Art = b.component;
            return (
              <Link key={b.date} to={`/labs/css-battles/${b.date}` as never} className="battle-card">
                <div className="canvas-frame">
                  <div className="canvas">
                    <Art />
                  </div>
                </div>
                <div className="battle-meta">
                  <span className="battle-date">{fmtDate(b.date)}</span>
                  <span className="battle-go">open →</span>
                </div>
              </Link>
            );
          })}
        </section>

        <footer className="battles-footer">
          <span>
            src: <span className="t-accent">hand-authored · pure css</span>
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
  .shell-battles { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: var(--sp-6) 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .page-hd .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-4);
    padding-top: var(--sp-4);
  }
  .page-hd .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .page-hd .crumbs a:hover { color: var(--color-accent); }
  .page-hd .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .page-hd .crumbs .last { color: var(--color-accent); }

  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }
  .page-hd .meta {
    display: flex; gap: var(--sp-6);
    margin-top: var(--sp-5);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-accent); font-weight: 400; }

  .battle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--sp-4);
    margin-top: var(--sp-6);
  }

  .battle-card {
    display: flex; flex-direction: column;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
  }
  .battle-card:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .battle-card:hover .battle-go { color: var(--color-accent); }

  /* canvas is fixed 400x300 — scaled + centered inside the responsive frame */
  .canvas-frame {
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: var(--color-bg-raised);
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: inline-size;
  }
  .canvas {
    position: relative;
    width: 400px;
    height: 300px;
    flex-shrink: 0;
    transform: scale(min(100cqw / 400, 100cqh / 300));
  }

  .battle-meta {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .battle-date { color: var(--color-fg); }
  .battle-go { color: var(--color-fg-faint); }

  .battles-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
