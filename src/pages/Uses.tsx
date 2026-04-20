import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { USES_META, USES_SECTIONS } from '../data';

export default function UsesPage() {
  const totalItems = useMemo(() => USES_SECTIONS.reduce((sum, s) => sum + s.items.length, 0), []);
  const [activeId, setActiveId] = useState<string>(USES_SECTIONS[0]?.id ?? '');
  const sectionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = sectionsRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section.sec'));
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: '-40% 0% -55% 0%' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-uses">
        <div className="layout">
          <aside className="side">
            <div className="grp-ttl">rig</div>
            {['hardware', 'editor', 'desk', 'keyboard', 'camera'].map((id) => (
              <a key={id} href={`#${id}`} className={activeId === id ? 'on' : ''}>
                {USES_SECTIONS.find((s) => s.id === id)?.title ?? id}
              </a>
            ))}
            <div className="grp-ttl">soft</div>
            {['software', 'runtime', 'services'].map((id) => (
              <a key={id} href={`#${id}`} className={activeId === id ? 'on' : ''}>
                {USES_SECTIONS.find((s) => s.id === id)?.title ?? id}
              </a>
            ))}
            <div className="grp-ttl">life</div>
            {['edc', 'boat'].map((id) => (
              <a key={id} href={`#${id}`} className={activeId === id ? 'on' : ''}>
                {USES_SECTIONS.find((s) => s.id === id)?.title ?? id}
              </a>
            ))}
          </aside>

          <div ref={sectionsRef}>
            <header className="page-hd">
              <div className="label" style={{ marginBottom: 8 }}>
                ~/uses
              </div>
              <h1>
                uses<span className="dot">.</span>
              </h1>
              <p className="sub">
                the full rig. updated when something changes, which is less often than you&rsquo;d think. inspired by{' '}
                <a href="https://uses.tech" target="_blank" rel="noopener noreferrer" className="glow-link">
                  uses.tech
                </a>
                . affiliate-free.
              </p>
              <div className="meta">
                <span>
                  version <b>{USES_META.version}</b>
                </span>
                <span>
                  items <b>{totalItems}</b>
                </span>
                <span>
                  last updated <b>{USES_META.lastUpdated}</b>
                </span>
              </div>
            </header>

            {USES_SECTIONS.map((sec) => (
              <section key={sec.id} className="sec" id={sec.id}>
                <div className="sec-hd">
                  <span className="num">{sec.num} //</span>
                  <h2>{sec.title}.</h2>
                </div>
                {sec.desc ? <p className="sec-desc">{sec.desc}</p> : null}
                <table className="uses-table">
                  {sec.id === 'hardware' ? (
                    <thead>
                      <tr>
                        <th>item</th>
                        <th>config</th>
                        <th>note</th>
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {sec.items.map((it) => (
                      <tr key={it.name}>
                        <td className="nm">{it.name}</td>
                        <td className="tg">{it.config}</td>
                        <td className="note">{it.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>

        <footer className="uses-footer">
          <span>
            last reviewed · {USES_META.lastUpdated} · next review · {USES_META.nextReview}
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

const CSS = `
  .shell-uses { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--sp-8);
    padding: var(--sp-6) 0;
  }
  .side { position: sticky; top: 72px; height: max-content; font-size: var(--fs-sm); }
  .side a {
    display: block; color: var(--color-fg-dim);
    padding: 3px 0 3px 12px;
    border-left: 1px solid var(--color-border);
    font-size: var(--fs-sm); text-decoration: none;
  }
  .side a:hover, .side a.on { color: var(--color-accent); border-left-color: var(--color-accent); text-decoration: none; }
  .side .grp-ttl {
    color: var(--color-fg-faint);
    text-transform: lowercase;
    font-size: var(--fs-xs);
    margin: var(--sp-4) 0 var(--sp-2);
    letter-spacing: 0.05em;
  }

  .page-hd {
    padding: 56px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--sp-6);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
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

  section.sec { margin-bottom: var(--sp-10); scroll-margin-top: 80px; }
  .sec-hd {
    display: flex; align-items: baseline; gap: var(--sp-3);
    margin-bottom: var(--sp-3);
  }
  .sec-hd h2 {
    font-family: var(--font-display);
    font-size: 28px; font-weight: 500;
    color: var(--color-fg); letter-spacing: -0.02em;
  }
  .sec-hd .num {
    color: var(--color-accent);
    font-size: var(--fs-sm); letter-spacing: 0.1em;
    font-family: var(--font-mono);
  }
  .sec-desc { font-size: var(--fs-md); color: var(--color-fg-dim); max-width: 60ch; margin-bottom: var(--sp-5); line-height: 1.6; }

  .uses-table {
    width: 100%; border-collapse: collapse; font-size: var(--fs-sm);
    border-top: 1px solid var(--color-border);
  }
  .uses-table th {
    text-align: left; padding: 6px 10px;
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-weight: 400;
    text-transform: lowercase; border-bottom: 1px solid var(--color-border-bright);
  }
  .uses-table td {
    padding: 10px; border-bottom: 1px dashed var(--color-border);
    color: var(--color-fg); vertical-align: top;
  }
  .uses-table tr:hover td { background: var(--color-bg-raised); }
  .uses-table .nm { font-family: var(--font-mono); color: var(--color-fg); }
  .uses-table .tg { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .uses-table .note { color: var(--color-fg-faint); font-size: var(--fs-xs); }

  .uses-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-8);
    padding: var(--sp-6) 0 var(--sp-10);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex; justify-content: space-between;
  }

  @media (max-width: 800px) {
    .layout { grid-template-columns: 1fr; }
    .side { position: static; display: flex; flex-wrap: wrap; gap: var(--sp-3); }
    .side .grp-ttl { width: 100%; }
    .side a { border-left: 0; padding: 0; }
  }
`;
