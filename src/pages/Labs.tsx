import { Link } from '@tanstack/react-router';

type Lab = {
  slug: string;
  title: string;
  desc: string;
  tags: string[];
  year: string;
  count?: string;
  ready: boolean;
};

const LABS: Lab[] = [
  {
    slug: 'css-battles',
    title: 'css battles',
    desc: 'my solutions to daily css-battle prompts. pure css + divs, no assets.',
    tags: ['css'],
    year: '2023–2025',
    count: '11 entries',
    ready: true,
  },
];

export default function LabsPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="shell-labs">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/labs
          </div>
          <h1>
            labs<span className="dot">.</span>
          </h1>
          <p className="sub">
            experiments, demos, and tiny things that don&apos;t fit in /projects. some are toys; some are tools. all
            are missing polish on purpose.
          </p>
          <div className="meta">
            <span>
              entries <b>{LABS.length}</b>
            </span>
            <span>
              shipped <b>{LABS.filter((l) => l.ready).length}</b>
            </span>
          </div>
        </header>

        <section className="lab-grid">
          {LABS.map((l) =>
            l.ready ? (
              <Link key={l.slug} to={`/labs/${l.slug}` as never} className="lab-card">
                <LabCardContent lab={l} />
              </Link>
            ) : (
              <div key={l.slug} className="lab-card soon">
                <LabCardContent lab={l} />
              </div>
            ),
          )}
        </section>

        <footer className="labs-footer">
          <span>
            src: <span className="t-accent">static · hand-authored</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function LabCardContent({ lab }: { lab: Lab }) {
  return (
    <>
      <div className="lab-head">
        <span className="lab-tags">
          {lab.tags.map((t) => (
            <span key={t} className="lab-tag">
              {t}
            </span>
          ))}
        </span>
        <span className="lab-year">{lab.year}</span>
      </div>
      <div className="lab-name">{lab.title}</div>
      <div className="lab-desc">{lab.desc}</div>
      <div className="lab-ft">
        {lab.count ? <span>{lab.count}</span> : <span>—</span>}
        <span className="lab-go">{lab.ready ? 'open →' : 'coming soon'}</span>
      </div>
    </>
  );
}

const CSS = `
  .shell-labs { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }
  .page-hd .meta {
    display: flex; gap: var(--sp-6);
    margin-top: var(--sp-5);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-accent); font-weight: 400; }

  .lab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--sp-3);
    margin-top: var(--sp-6);
  }
  .lab-card {
    display: flex; flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: inherit;
    text-decoration: none;
    min-height: 180px;
  }
  .lab-card:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .lab-card:hover .lab-name { color: var(--color-accent); }
  .lab-card.soon { opacity: 0.55; cursor: default; }
  .lab-card.soon:hover { border-color: var(--color-border); }
  .lab-card.soon:hover .lab-name { color: var(--color-fg); }

  .lab-head {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .lab-tags { display: flex; gap: 4px; }
  .lab-tag {
    padding: 1px 6px;
    border: 1px solid var(--color-accent-dim);
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .lab-year { color: var(--color-fg-faint); }

  .lab-name {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1;
    margin-top: var(--sp-2);
  }
  .lab-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.5;
    flex: 1;
  }
  .lab-ft {
    display: flex; justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-2);
    border-top: 1px dashed var(--color-border);
    margin-top: var(--sp-2);
  }
  .lab-go { color: var(--color-accent); }
  .lab-card.soon .lab-go { color: var(--color-fg-faint); }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
