import { Link } from '@tanstack/react-router';
import { ScreenshotTool } from './screenshot-maker/components/screenshot-tool';

export default function ScreenshotMakerPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="shell-sm">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">screenshot-maker</span>
        </div>

        <header className="sm-hd">
          <h1>
            screenshot maker<span className="dot">.</span>
          </h1>
          <p className="sub">
            drop an image, wrap it in a background, shadow, frame, and optional pattern overlays; download the result at
            16:9 / 9:16 / 1:1. all canvas2d, all client-side.
          </p>
        </header>

        <section className="sm-stage">
          <ScreenshotTool />
        </section>

        <footer className="sm-footer">
          <span>
            src: <span className="t-accent">canvas2d · gif-frames · hand-rolled render pipeline</span>
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
  .shell-sm { max-width: 1400px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .sm-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .sm-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .sm-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .sm-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }

  /* isolate the legacy tool's internal styling so its tailwind bits don't fight site tokens */
  .sm-stage {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    min-height: 600px;
    position: relative;
    overflow: hidden;
  }

  .sm-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
