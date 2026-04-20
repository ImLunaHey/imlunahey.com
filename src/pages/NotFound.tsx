import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const SUGGESTIONS: { to: string; label: string; desc: string; tag: string }[] = [
  { to: '/', label: '~/', desc: 'the home page', tag: 'home' },
  { to: '/blog', label: './writing', desc: 'essays + devlogs', tag: 'writing' },
  { to: '/projects', label: './projects', desc: '220 repos, filterable', tag: 'projects' },
  { to: '/gallery', label: './gallery', desc: '20k generated + photos', tag: 'gallery' },
  { to: '/uses', label: './uses', desc: 'the full rig', tag: 'uses' },
  { to: '/design-system', label: './design.sys', desc: 'tokens + primitives', tag: 'system' },
];

export default function NotFoundPage() {
  const [referrer, setReferrer] = useState('direct');

  useEffect(() => {
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        setReferrer(new URL(document.referrer).host || 'direct');
      } catch {
        setReferrer('direct');
      }
    }
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-404">
        <div className="term">
          <div className="cmd">find . -name "that-page"</div>
          <div className="out">
            <span className="err">find: './that-page'</span> —{' '}
            <span className="err">no such file or directory</span>
          </div>

          <div className="big404">404.</div>

          <div className="cmd">whoami</div>
          <div className="out">
            luna · visitor · referred from <span className="t-faint">{referrer}</span>
          </div>

          <div className="cmd">ls ~/suggest</div>
        </div>

        <div className="suggest">
          <div className="suggest-head">did you mean one of these?</div>
          {SUGGESTIONS.map((s) => (
            <Link key={s.tag} to={s.to as never}>
              <span>
                {s.label} <span className="t-faint">— {s.desc}</span>
              </span>
              <span className="k">{s.tag}</span>
            </Link>
          ))}
        </div>

        <div className="term" style={{ marginTop: 'var(--sp-6)' }}>
          <div className="cmd">
            _<span className="cursor" />
          </div>
        </div>
      </main>

      <footer className="footer-404">
        exit code · <span className="t-alert">404</span> ·{' '}
        <Link to="/" className="t-accent">
          ← back home
        </Link>
      </footer>
    </>
  );
}

const CSS = `
  .shell-404 {
    max-width: 760px; margin: 0 auto;
    padding: var(--sp-8) var(--sp-6);
    width: 100%;
    display: flex; flex-direction: column;
    min-height: calc(100dvh - 160px);
    justify-content: center;
  }
  .term {
    padding: var(--sp-8) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    line-height: 1.8;
    color: var(--color-fg-dim);
  }
  .term .cmd { color: var(--color-fg); }
  .term .cmd::before { content: "$ "; color: var(--color-accent); }
  .term .err { color: var(--color-alert); }
  .term .out { color: var(--color-fg-dim); margin-bottom: var(--sp-4); }
  .big404 {
    font-family: var(--font-display);
    font-size: clamp(120px, 20vw, 280px);
    color: var(--color-accent);
    line-height: 0.85;
    letter-spacing: -0.04em;
    text-shadow: 0 0 24px var(--accent-glow);
    margin: var(--sp-6) 0 var(--sp-4);
  }
  .suggest {
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .suggest-head {
    padding: 8px 14px;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .suggest a {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 10px 14px;
    border-bottom: 1px dashed var(--color-border);
    color: var(--color-fg);
    font-size: var(--fs-sm);
    text-decoration: none;
  }
  .suggest a:last-child { border-bottom: 0; }
  .suggest a:hover { background: var(--color-bg-raised); color: var(--color-accent); text-decoration: none; }
  .suggest a .k { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .footer-404 {
    text-align: center;
    padding: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
