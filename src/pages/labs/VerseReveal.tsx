import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';
import { VerseTextReveal } from './verse-reveal/VerseTextReveal';
import source from './verse-reveal/VerseTextReveal.tsx?raw';

export default function VerseRevealPage() {
  const [runId, setRunId] = useState(0);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-verse">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">verse-reveal</span>
        </div>

        <header className="verse-hd">
          <h1>
            verse reveal<span className="dot">.</span>
          </h1>
          <p className="sub">
            a text effect that scrubs through the ascii character set until each position lands on the target letter.
            stagger is proportional to the index, so longer strings reveal like a wave.
          </p>
          <div className="meta">
            <span>technique <b>setInterval + character lookup</b></span>
            <button type="button" className="replay" onClick={() => setRunId((v) => v + 1)}>
              ↻ replay
            </button>
          </div>
        </header>

        <section className="stage">
          <div className="stage-inner">
            <VerseTextReveal key={runId} />
          </div>
        </section>

        <section className="code">
          <CodeBlock code={source} filename="src / verse-reveal / VerseTextReveal.tsx" />
        </section>

        <footer className="verse-footer">
          <span>
            src: <span className="t-accent">hand-authored · react + setInterval</span>
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
  .shell-verse { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .verse-hd { padding-bottom: var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .verse-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .verse-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .verse-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }
  .verse-hd .meta {
    display: flex; gap: var(--sp-6);
    margin-top: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    align-items: center;
  }
  .verse-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .replay {
    border: 1px solid var(--color-accent-dim);
    background: transparent;
    color: var(--color-accent);
    font: inherit;
    font-size: var(--fs-xs);
    padding: 4px 12px;
    cursor: pointer;
    font-family: var(--font-mono);
    margin-left: auto;
  }
  .replay:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .stage {
    padding: var(--sp-8) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .stage-inner {
    position: relative;
    min-height: 280px;
    padding: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    box-shadow: 0 0 32px color-mix(in oklch, var(--color-accent) 10%, transparent) inset;
  }

  .code { margin-top: var(--sp-6); }

  .verse-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
