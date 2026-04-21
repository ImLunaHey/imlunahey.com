import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { CodeBlock } from '../../components/CodeBlock';
import { buildDemoScene, InfiniteCanvas } from './infinite-canvas/InfiniteCanvas';
import source from './infinite-canvas/InfiniteCanvas.tsx?raw';

export default function InfiniteCanvasPage() {
  const nodes = useMemo(() => buildDemoScene(400), []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ic">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">infinite-canvas</span>
        </div>

        <header className="ic-hd">
          <h1>
            infinite canvas<span className="dot">.</span>
          </h1>
          <p className="sub">
            a canvas2d pan + zoom surface backed by a spatial-hash grid (for culling) and an offscreen canvas cache
            (for view memoization). scale clamps from 0.1× to 10×; nodes outside the view are skipped entirely.
          </p>
          <div className="controls">
            <span>
              <b>drag</b> pan
            </span>
            <span>
              <b>⌘ / ctrl + scroll</b> zoom
            </span>
            <span>
              <b>pinch</b> touch zoom
            </span>
            <span>
              nodes <b>{nodes.length}</b>
            </span>
          </div>
        </header>

        <section className="stage">
          <InfiniteCanvas nodes={nodes} />
          <div className="stage-corner tl">(0, 0) · origin top-left of viewport</div>
          <div className="stage-corner br">canvas2d · offscreen cache · spatial-hash</div>
        </section>

        <section className="code">
          <CodeBlock code={source} filename="src / labs / infinite-canvas / InfiniteCanvas.tsx" />
        </section>

        <footer className="ic-footer">
          <span>
            src: <span className="t-accent">hand-authored · canvas2d + spatial hash</span>
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
  .shell-ic { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .ic-hd { padding-bottom: var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .ic-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .ic-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ic-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); }
  .ic-hd .controls {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .ic-hd .controls b { color: var(--color-accent); font-weight: 400; margin-right: 6px; }

  .stage {
    position: relative;
    height: 600px;
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .stage::before,
  .stage::after {
    content: "";
    position: absolute; inset: 0;
    pointer-events: none;
  }
  /* faint grid pattern so the pan is always visible */
  .stage::before {
    background-image:
      linear-gradient(to right, color-mix(in oklch, var(--color-accent) 4%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklch, var(--color-accent) 4%, transparent) 1px, transparent 1px);
    background-size: 40px 40px;
    opacity: 0.6;
  }
  /* outer edge vignette */
  .stage::after {
    box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.9);
  }
  .stage-corner {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    padding: 4px 8px;
    border: 1px solid var(--color-border-bright);
    background: color-mix(in oklch, var(--color-bg) 70%, transparent);
    pointer-events: none;
  }
  .stage-corner.tl { top: 8px; left: 8px; }
  .stage-corner.br { bottom: 8px; right: 8px; color: var(--color-accent); border-color: var(--color-accent-dim); }

  .code { margin-top: var(--sp-6); }

  .ic-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 640px) {
    .stage { height: 460px; }
  }
`;
