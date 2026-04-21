import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { SITE } from '../data';

const TOC = {
  foundations: [
    { id: 'type', num: '01', label: 'typography' },
    { id: 'color', num: '02', label: 'color' },
    { id: 'space', num: '03', label: 'spacing' },
    { id: 'radius', num: '04', label: 'borders + radii' },
    { id: 'motion', num: '05', label: 'motion' },
    { id: 'icons', num: '06', label: 'iconography' },
  ],
  elements: [
    { id: 'buttons', num: '07', label: 'buttons' },
    { id: 'inputs', num: '08', label: 'inputs' },
    { id: 'links', num: '09', label: 'links' },
    { id: 'tables', num: '10', label: 'tables' },
    { id: 'lists', num: '11', label: 'lists' },
    { id: 'progress', num: '12', label: 'progress' },
  ],
  components: [
    { id: 'cards', num: '13', label: 'cards / panels' },
    { id: 'loading', num: '14', label: 'loading states' },
    { id: 'code', num: '15', label: 'code blocks' },
  ],
  patterns: [{ id: 'voice', num: '16', label: 'voice + tone' }],
};

const SWATCHES_SURFACES = [
  { name: 'bg', tok: '--color-bg', val: '#000000', color: '#000000' },
  { name: 'bg.panel', tok: '--color-bg-panel', val: '#070707', color: '#070707' },
  { name: 'bg.raised', tok: '--color-bg-raised', val: '#0a0a0a', color: '#0a0a0a' },
  { name: 'border', tok: '--color-border', val: '#1a1a1a', color: '#1a1a1a' },
];
const SWATCHES_FG = [
  { name: 'fg', tok: '--color-fg', val: '#e6e6e6', color: '#e6e6e6' },
  { name: 'fg.dim', tok: '--color-fg-dim', val: '#9a9a9a', color: '#9a9a9a' },
  { name: 'fg.faint', tok: '--color-fg-faint', val: '#555555', color: '#555555' },
  { name: 'fg.ghost', tok: '--color-fg-ghost', val: '#2a2a2a', color: '#2a2a2a' },
];
const SWATCHES_ACCENT = [
  { name: 'accent', tok: '--color-accent', val: 'oklch(0.86 0.19 145)', color: 'oklch(0.86 0.19 145)' },
  { name: 'accent.dim', tok: '--color-accent-dim', val: 'oklch(0.55 0.13 145)', color: 'oklch(0.55 0.13 145)' },
  { name: 'alert', tok: '--color-alert', val: 'oklch(0.72 0.19 25)', color: 'oklch(0.72 0.19 25)' },
  { name: 'warn', tok: '--color-warn', val: 'oklch(0.85 0.17 85)', color: 'oklch(0.85 0.17 85)' },
];

const SPACING = [
  { tok: 'sp-1', px: 4, rem: '0.25rem' },
  { tok: 'sp-2', px: 8, rem: '0.5rem' },
  { tok: 'sp-3', px: 12, rem: '0.75rem' },
  { tok: 'sp-4', px: 16, rem: '1rem' },
  { tok: 'sp-5', px: 20, rem: '1.25rem' },
  { tok: 'sp-6', px: 24, rem: '1.5rem' },
  { tok: 'sp-8', px: 32, rem: '2rem' },
  { tok: 'sp-10', px: 40, rem: '2.5rem' },
  { tok: 'sp-12', px: 48, rem: '3rem' },
];

const ICONS = [
  { g: '●', l: 'status.on' },
  { g: '○', l: 'status.off' },
  { g: '◉', l: 'pin' },
  { g: '▣', l: 'location' },
  { g: '◢', l: 'ascend' },
  { g: '◣', l: 'descend' },
  { g: '→', l: 'next' },
  { g: '←', l: 'prev' },
  { g: '↗', l: 'external' },
  { g: '▸', l: 'expand' },
  { g: '▾', l: 'collapse' },
  { g: '⌘', l: 'command' },
  { g: '⎋', l: 'escape' },
  { g: '⏎', l: 'return' },
  { g: '✕', l: 'close' },
  { g: '✓', l: 'done' },
  { g: '♪', l: 'music' },
  { g: '★', l: 'star' },
  { g: '⚑', l: 'flag' },
  { g: '⌂', l: 'home' },
];

export default function DesignSystemPage() {
  const sectionsRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string>('type');

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
      { rootMargin: '-30% 0% -55% 0%' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ds">
        <div className="layout">
          <aside className="side">
            {Object.entries(TOC).map(([group, items]) => (
              <div key={group} className="grp">
                <div className="grp-title">{group}</div>
                {items.map((it) => (
                  <a key={it.id} href={`#${it.id}`} className={activeId === it.id ? 'active' : ''}>
                    {it.num} · {it.label}
                  </a>
                ))}
              </div>
            ))}
          </aside>

          <div ref={sectionsRef}>
            <header className="doc-title">
              <pre>
                {`╔══════════════════════════════════════════════════╗
║  luna.sys // design system · phosphor v4.0.1    ║
╚══════════════════════════════════════════════════╝`}
              </pre>
              <h1>design system.</h1>
              <p>
                a small, opinionated set of tokens and primitives powering{' '}
                <Link to="/" className="t-accent">
                  imlunahey.com
                </Link>
                . mono-first, black-first, phosphor accent. every component is plain html + css. no framework required.
              </p>
              <div className="meta">
                <span>
                  version <b>{SITE.version}</b>
                </span>
                <span>
                  updated <b>apr 19, 2026</b>
                </span>
                <span>
                  primitives <b>18</b>
                </span>
                <span>
                  tokens <b>42</b>
                </span>
                <span>
                  status <b>● stable</b>
                </span>
              </div>
            </header>

            {/* 01 TYPE */}
            <Section id="type" num="01" title="typography">
              <p className="sec-desc">
                two faces. <span className="t-accent">jetbrains mono</span> does everything structural — body, ui,
                numbers, labels. <span className="t-accent">doto</span> is reserved for display: hero numerals, section
                titles, moments of character. nothing else. ever.
              </p>

              <SubSection title="faces" count="2 families">
                <Spec code="--font-display · --font-mono" tag="font-family">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
                    <div>
                      <div className="label">display</div>
                      <div
                        className="display"
                        style={{ fontSize: 64, color: 'var(--color-fg)', lineHeight: 0.95, margin: '6px 0' }}
                      >
                        Doto Aa
                      </div>
                      <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>
                        doto, weights 100–900 · variable
                      </div>
                    </div>
                    <div>
                      <div className="label">mono</div>
                      <div
                        style={{
                          fontSize: 56,
                          color: 'var(--color-fg)',
                          fontWeight: 500,
                          lineHeight: 0.95,
                          margin: '6px 0',
                        }}
                      >
                        Aa 0123
                      </div>
                      <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>
                        jetbrains mono, weights 100–800 · variable
                      </div>
                    </div>
                  </div>
                </Spec>
              </SubSection>

              <SubSection title="scale" count="10 steps">
                <Spec code="--fs-{micro,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl}" tag="scale">
                  {[
                    ['display.5xl', '--fs-5xl', 88, 'rewriting.', '88px / 0.95 / -0.03em', true],
                    ['display.4xl', '--fs-4xl', 56, 'design system.', '56px / 0.98 / -0.02em', true],
                    ['display.3xl', '--fs-3xl', 36, 'section headline', '36px / 1.05 / -0.02em', true],
                    ['text.2xl', '--fs-2xl', 24, 'large heading', '24px / 1.25', false],
                    ['text.xl', '--fs-xl', 18, 'subhead · 18px', '18px / 1.4', false],
                    ['text.lg', '--fs-lg', 15, 'large body text, used sparingly for emphasis.', '15px / 1.5', false],
                    [
                      'text.md',
                      '--fs-md',
                      13,
                      'the default body size — every paragraph, every ui label, every log line. if in doubt, use this.',
                      '13px / 1.5',
                      false,
                    ],
                    ['text.sm', '--fs-sm', 12, 'dense ui · inline controls · metadata', '12px / 1.5', false],
                    ['text.xs', '--fs-xs', 11, 'tiny labels, timestamps, chips', '11px / 1.4', false],
                    ['text.micro', '--fs-micro', 10, 'micro · legal · footer', '10px / 1.4', false],
                  ].map(([label, tok, size, example, spec, display]) => (
                    <div key={label as string} className="type-row">
                      <div className="lbl">
                        {label}
                        <span className="tok">{tok}</span>
                      </div>
                      <div className={'example' + (display ? ' display' : '')} style={{ fontSize: size as number }}>
                        {example}
                      </div>
                      <div className="spec-val">{spec}</div>
                    </div>
                  ))}
                </Spec>
              </SubSection>
            </Section>

            {/* 02 COLOR */}
            <Section id="color" num="02" title="color.">
              <p className="sec-desc">
                a near-monochrome palette. blacks and greys do 98% of the work. one phosphor-green accent provides life;
                one magenta-red alert hue handles errors. never introduce a third accent.
              </p>
              {[
                { title: 'surfaces', count: '4 steps', list: SWATCHES_SURFACES },
                { title: 'foreground', count: '4 steps', list: SWATCHES_FG },
                { title: 'accents', count: 'phosphor + alert', list: SWATCHES_ACCENT },
              ].map((grp) => (
                <SubSection key={grp.title} title={grp.title} count={grp.count}>
                  <div className="color-grid">
                    {grp.list.map((s) => (
                      <div key={s.tok} className="swatch">
                        <div className="swatch-chip" style={{ background: s.color }} />
                        <div className="swatch-info">
                          <span className="name">{s.name}</span>
                          <span className="tok">{s.tok}</span>
                          <span className="val">{s.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SubSection>
              ))}
            </Section>

            {/* 03 SPACING */}
            <Section id="space" num="03" title="spacing.">
              <p className="sec-desc">
                a 4-px base grid. all gaps, padding, and margins align to this scale. most ui lives between{' '}
                <span className="t-accent">sp-2</span> and <span className="t-accent">sp-6</span>. use larger steps only
                for page-level rhythm.
              </p>
              <Spec code="--sp-{1,2,3,4,5,6,8,10,12}" tag="scale">
                {SPACING.map((s) => (
                  <div key={s.tok} className="spacing-row">
                    <span className="tok">{s.tok}</span>
                    <span className="val">
                      {s.px}px · {s.rem}
                    </span>
                    <span className="bar-v" style={{ width: s.px }} />
                  </div>
                ))}
              </Spec>
            </Section>

            {/* 04 RADIUS */}
            <Section id="radius" num="04" title="borders + radii.">
              <p className="sec-desc">
                corners are sharp. radii exist only for the tiniest accents (kbd chips). everything else is{' '}
                <span className="t-accent">0px</span>. shadows are reserved for the phosphor glow — never soft drop
                shadows.
              </p>
              <div className="c-grid-3">
                <Spec code="1px solid --border" tag="border.default">
                  <div className="dotted-demo">
                    <div style={{ width: 80, height: 80, border: '1px solid var(--color-border)' }} />
                  </div>
                </Spec>
                <Spec code="1px solid --accent" tag="border.focus">
                  <div className="dotted-demo">
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        border: '1px solid var(--color-accent)',
                        boxShadow: 'inset 0 0 12px var(--accent-glow)',
                      }}
                    />
                  </div>
                </Spec>
                <Spec code="1px dashed --border-bright" tag="border.divider">
                  <div className="dotted-demo">
                    <div style={{ width: 80, height: 80, border: '1px dashed var(--color-border-bright)' }} />
                  </div>
                </Spec>
                <Spec code="radius: 2px" tag="radius.kbd">
                  <div className="dotted-demo">
                    <div
                      style={{
                        width: 60,
                        height: 30,
                        background: 'var(--color-bg-raised)',
                        border: '1px solid var(--color-border-bright)',
                        borderRadius: 2,
                        fontSize: 11,
                        color: 'var(--color-fg-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ⌘K
                    </div>
                  </div>
                </Spec>
                <Spec code="0 0 16px accent-glow" tag="shadow.glow">
                  <div className="dotted-demo">
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        background: 'var(--color-accent)',
                        boxShadow: '0 0 16px var(--accent-glow)',
                      }}
                    />
                  </div>
                </Spec>
                <Spec code="ascii::frame" tag="border.ascii">
                  <div className="dotted-demo">
                    <pre
                      style={{
                        color: 'var(--color-accent)',
                        fontSize: 10,
                        lineHeight: 1,
                        whiteSpace: 'pre',
                        textShadow: '0 0 6px var(--accent-glow)',
                        margin: 0,
                      }}
                    >
                      {`┌──────┐
│      │
│  ▣   │
│      │
└──────┘`}
                    </pre>
                  </div>
                </Spec>
              </div>
            </Section>

            {/* 05 MOTION */}
            <Section id="motion" num="05" title="motion.">
              <p className="sec-desc">
                motion is subtle and deterministic. four easings, short durations (120–400ms). the phosphor-blink and eq
                bars are the only perpetual animations allowed.
              </p>
              <div className="motion-grid">
                {[
                  ['linear', 'cubic-bezier(0,0,1,1)', 'timers, progress'],
                  ['ease', 'default · 240ms', 'hover, reveal'],
                  ['stepped', 'steps(8)', 'typewriter, boot'],
                  ['elastic', 'cubic-bezier(.68,-.6,.32,1.6)', 'sparingly, ever'],
                ].map(([name, val, use]) => (
                  <div key={name} className="motion-card">
                    <div className={`demo ${name}`} />
                    <div className="name">{name}</div>
                    <div className="val">{val}</div>
                    <div className="val">{use}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 06 ICONS */}
            <Section id="icons" num="06" title="iconography.">
              <p className="sec-desc">
                no illustrated icons. we use <span className="t-accent">box-drawing + geometric unicode</span>. they
                render in the mono face, scale with type, and disappear into the text when you want them to.
              </p>
              <div className="icon-grid">
                {ICONS.map((i) => (
                  <div key={i.l} className="icon-cell">
                    <span className="glyph">{i.g}</span>
                    {i.l}
                  </div>
                ))}
              </div>
            </Section>

            <div className="divider-ascii">─── ─ ─── · elements · ─── ─ ───</div>

            {/* 07 BUTTONS */}
            <Section id="buttons" num="07" title="buttons.">
              <p className="sec-desc">
                three variants. the primary button is reserved for the single most important action on a screen.
                everything else is default. ghost for dense toolbars.
              </p>
              <div className="c-grid-2">
                <Spec code=".btn · .btn.primary · .btn.ghost" tag="variants">
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                    <button className="btn primary" type="button">
                      send.mail
                    </button>
                    <button className="btn" type="button">
                      cancel
                    </button>
                    <button className="btn ghost" type="button">
                      more
                    </button>
                    <button className="btn" type="button" disabled>
                      disabled
                    </button>
                  </div>
                </Spec>
                <Spec code=":hover · :active · :focus" tag="states">
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn" type="button">
                      → default
                    </button>
                    <button
                      className="btn"
                      type="button"
                      style={{
                        borderColor: 'var(--color-accent)',
                        color: 'var(--color-accent)',
                        boxShadow: 'inset 0 0 0 1px var(--color-accent-dim)',
                      }}
                    >
                      → hover
                    </button>
                    <button
                      className="btn"
                      type="button"
                      style={{
                        background: 'var(--color-accent)',
                        color: '#000',
                        borderColor: 'var(--color-accent)',
                      }}
                    >
                      → active
                    </button>
                  </div>
                </Spec>
              </div>
            </Section>

            {/* 08 INPUTS */}
            <Section id="inputs" num="08" title="inputs.">
              <p className="sec-desc">
                no labels floating inside. always a small label above. the focus ring is a single-px accent border — no
                haloes.
              </p>
              <div className="c-grid-2">
                <Spec code=".input" tag="default">
                  <div className="label" style={{ marginBottom: 4 }}>
                    email
                  </div>
                  <input className="input" placeholder="you@somewhere.net" />
                </Spec>
                <Spec code=".input:focus" tag="focus">
                  <div className="label" style={{ marginBottom: 4 }}>
                    search
                  </div>
                  <input
                    className="input"
                    defaultValue="// accepting input…"
                    style={{ borderColor: 'var(--color-accent)' }}
                  />
                </Spec>
                <Spec code=".input.error" tag="error">
                  <div className="label" style={{ marginBottom: 4 }}>
                    domain
                  </div>
                  <input
                    className="input"
                    defaultValue="invalid@"
                    style={{ borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
                  />
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-alert)', marginTop: 4 }}>
                    ! must include a tld
                  </div>
                </Spec>
                <Spec code=".input[disabled]" tag="disabled">
                  <div className="label" style={{ marginBottom: 4 }}>
                    locked
                  </div>
                  <input className="input" defaultValue="read-only.txt" disabled style={{ opacity: 0.5 }} />
                </Spec>
              </div>
            </Section>

            {/* 09 LINKS */}
            <Section id="links" num="09" title="links.">
              <p className="sec-desc">
                two styles. inline links get a dashed underline that turns solid on hover. glow-links get the phosphor
                treatment for emphasis.
              </p>
              <Spec code="a · a.glow-link" tag="variants">
                <div style={{ fontSize: 'var(--fs-md)', lineHeight: 1.8 }}>
                  <p>
                    i wrote a <a href="#">small article</a> about building a <a href="#">dns server from scratch</a>,
                    and it became more popular than i expected.
                  </p>
                  <p style={{ marginTop: 12 }}>
                    come say hi on{' '}
                    <a href="#" className="glow-link">
                      bluesky
                    </a>
                    , read the{' '}
                    <a href="#" className="glow-link">
                      blog
                    </a>
                    , or check out{' '}
                    <a href="#" className="glow-link">
                      recent projects
                    </a>
                    .
                  </p>
                </div>
              </Spec>
            </Section>

            {/* 10 TABLES */}
            <Section id="tables" num="10" title="tables.">
              <p className="sec-desc">
                flat. rows are separated by a single border line. headers lowercase and muted. the row-hover is the only
                interactive affordance.
              </p>
              <Spec code=".tbl" tag="element" flush>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>repo</th>
                      <th>lang</th>
                      <th>★</th>
                      <th>updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['akari', 'typescript', 412, '2d ago'],
                      ['dns-server', 'rust', 89, '5d ago'],
                      ['ip2country', 'typescript', 154, '1w ago'],
                      ['xirelta', 'typescript', 67, '2w ago'],
                    ].map(([r, lang, stars, u]) => (
                      <tr key={r as string}>
                        <td>{r}</td>
                        <td>
                          <span className="t-accent">●</span> {lang}
                        </td>
                        <td>{stars}</td>
                        <td className="t-faint">{u}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Spec>
            </Section>

            {/* 11 LISTS */}
            <Section id="lists" num="11" title="lists.">
              <p className="sec-desc">
                bullets are replaced with mono glyphs: <span className="t-accent">·</span> for unordered, right-aligned
                digits for ordered, <span className="t-accent">✓</span> for checklists.
              </p>
              <div className="c-grid-3">
                <Spec code="ul" tag=".list">
                  <div className="label" style={{ marginBottom: 8 }}>
                    unordered
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.9 }}>
                    <div>
                      <span className="t-faint">·</span> build the dns server
                    </div>
                    <div>
                      <span className="t-faint">·</span> ship the blog rewrite
                    </div>
                    <div>
                      <span className="t-faint">·</span> fix the canal boat heater
                    </div>
                    <div>
                      <span className="t-faint">·</span> learn some rust, finally
                    </div>
                  </div>
                </Spec>
                <Spec code="ol" tag=".list.ordered">
                  <div className="label" style={{ marginBottom: 8 }}>
                    ordered
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.9 }}>
                    <div>
                      <span className="t-accent">01</span>&nbsp;&nbsp;parse the query
                    </div>
                    <div>
                      <span className="t-accent">02</span>&nbsp;&nbsp;check the cache
                    </div>
                    <div>
                      <span className="t-accent">03</span>&nbsp;&nbsp;recurse if miss
                    </div>
                    <div>
                      <span className="t-accent">04</span>&nbsp;&nbsp;respond + cache
                    </div>
                  </div>
                </Spec>
                <Spec code="ul.check" tag=".list.check">
                  <div className="label" style={{ marginBottom: 8 }}>
                    checklist
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.9 }}>
                    <div>
                      <span className="t-accent">✓</span>{' '}
                      <span style={{ color: 'var(--color-fg-faint)', textDecoration: 'line-through' }}>
                        wire up routing
                      </span>
                    </div>
                    <div>
                      <span className="t-accent">✓</span>{' '}
                      <span style={{ color: 'var(--color-fg-faint)', textDecoration: 'line-through' }}>
                        add mdx support
                      </span>
                    </div>
                    <div>
                      <span className="t-faint">▢</span> dark-mode auto
                    </div>
                    <div>
                      <span className="t-faint">▢</span> rss feed
                    </div>
                  </div>
                </Spec>
              </div>
            </Section>

            {/* 12 PROGRESS */}
            <Section id="progress" num="12" title="progress.">
              <p className="sec-desc">
                two flavours. the <span className="t-accent">bar</span> for ui; the{' '}
                <span className="t-accent">ascii-bar</span> for logs and terminal copy. never percentages without
                context.
              </p>
              <div className="c-grid-2">
                <Spec code=".bar" tag="ui">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      ['year.progress', '107/365', 29],
                      ['downloading', '72%', 72],
                      ['complete', '100%', 100],
                    ].map(([label, val, pct]) => (
                      <div key={label as string}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 'var(--fs-xs)',
                            color: 'var(--color-fg-faint)',
                            marginBottom: 4,
                          }}
                        >
                          <span>{label}</span>
                          <span>{val}</span>
                        </div>
                        <div className="bar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Spec>
                <Spec code=".bar-ascii" tag="terminal">
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', lineHeight: 1.9 }}>
                    <div>
                      <span className="t-faint">[29%]</span> <span className="bar-ascii">███████░░░░░░░░░░░░░░░░</span>
                    </div>
                    <div>
                      <span className="t-faint">[72%]</span> <span className="bar-ascii">██████████████████░░░░░</span>
                    </div>
                    <div>
                      <span className="t-faint">[100]</span> <span className="bar-ascii">███████████████████████</span>
                    </div>
                    <div>
                      <span className="t-faint">[err]</span>{' '}
                      <span style={{ color: 'var(--color-alert)', letterSpacing: 1 }}>
                        ███▓▒░░░░░░░░░░░░░░░░░░
                      </span>
                    </div>
                  </div>
                </Spec>
              </div>
            </Section>

            <div className="divider-ascii">─── ─ ─── · components · ─── ─ ───</div>

            {/* 13 CARDS */}
            <Section id="cards" num="13" title="cards + panels.">
              <p className="sec-desc">
                everything lives in a <span className="t-accent">.panel</span>. optional{' '}
                <span className="t-accent">.ticks</span> modifier adds corner accents for emphasis. panels never nest.
              </p>
              <div className="c-grid-2">
                <Spec code=".panel" tag="default">
                  <div style={{ background: 'var(--color-bg)' }}>
                    <div className="panel">
                      <div className="panel-head">
                        <span className="dot" />
                        <span className="ttl">./widget</span>
                        <span className="src-tag">active</span>
                      </div>
                      <div className="panel-body">
                        <div className="label">body copy</div>
                        <div style={{ color: 'var(--color-fg)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>
                          a standard panel has a titled header with a live dot, and body content with 16px padding.
                        </div>
                      </div>
                    </div>
                  </div>
                </Spec>
                <Spec code=".panel.ticks" tag="featured">
                  <div style={{ background: 'var(--color-bg)' }}>
                    <div className="panel ticks">
                      <div className="panel-head">
                        <span className="dot" />
                        <span className="ttl">./featured</span>
                        <span className="src-tag">pinned</span>
                      </div>
                      <div className="panel-body">
                        <div className="label">with corner ticks</div>
                        <div style={{ color: 'var(--color-fg)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>
                          the .ticks modifier adds phosphor corners — use once per screen, for the hero panel only.
                        </div>
                      </div>
                    </div>
                  </div>
                </Spec>
              </div>
            </Section>

            {/* 14 LOADING */}
            <Section id="loading" num="14" title="loading states.">
              <p className="sec-desc">
                three modes. the spinner is forbidden. use a <span className="t-accent">shimmer skeleton</span> when
                structure is known; a <span className="t-accent">boot log</span> when it isn't.
              </p>
              <div className="c-grid-3">
                <Spec code=".skel" tag="skeleton">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="skel" style={{ width: '60%' }} />
                    <div className="skel" style={{ width: '100%' }} />
                    <div className="skel" style={{ width: '85%' }} />
                    <div className="skel" style={{ width: '40%' }} />
                  </div>
                </Spec>
                <Spec code="boot.log" tag="terminal">
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-xs)',
                      lineHeight: 1.8,
                      color: 'var(--color-fg-dim)',
                    }}
                  >
                    <div>
                      <span className="t-accent">[ok]</span> init kernel
                    </div>
                    <div>
                      <span className="t-accent">[ok]</span> mount /home
                    </div>
                    <div>
                      <span className="t-accent">[ok]</span> connect pds
                    </div>
                    <div>
                      <span className="t-faint">[..]</span> fetching posts
                      <span className="cursor" style={{ height: '0.8em' }} />
                    </div>
                  </div>
                </Spec>
                <Spec code=".loading" tag="block">
                  <div
                    style={{
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 24,
                      color: 'var(--color-accent)',
                      letterSpacing: 3,
                    }}
                  >
                    <span style={{ animation: 'blink 0.8s steps(1) infinite' }}>▓▒░</span>
                    <div
                      style={{
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--color-fg-faint)',
                        marginTop: 12,
                        letterSpacing: 0,
                      }}
                    >
                      loading · do not close
                    </div>
                  </div>
                </Spec>
              </div>
            </Section>

            {/* 15 CODE BLOCKS */}
            <Section id="code" num="15" title="code blocks.">
              <p className="sec-desc">
                syntax-highlighted source via{' '}
                <a href="https://sugar-high.vercel.app" target="_blank" rel="noopener noreferrer" className="glow-link">
                  sugar-high
                </a>
                . token colours map to phosphor palette via{' '}
                <code className="inline">.sh__token--*</code> css vars; theme lives in{' '}
                <code className="inline">src/components/CodeBlock.tsx</code>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <SubSection title="with filename + copy" count="1">
                  <CodeBlock
                    filename="src / components / Greeting.tsx"
                    code={`import { SITE } from '../data';

// greet the visitor — defaults to the site handle
export function Greeting({ name = SITE.name }: { name?: string }) {
  return (
    <p className="t-accent">
      hi, i'm {name}. welcome to the design system.
    </p>
  );
}
`}
                  />
                </SubSection>
                <SubSection title="bare (no chrome)" count="1">
                  <CodeBlock
                    bare
                    code={`const greet = (name: string) => \`hello, \${name}!\`;
console.log(greet('world'));`}
                  />
                </SubSection>
                <SubSection title="tokens" count="8">
                  <div className="token-grid">
                    {[
                      { tok: 'keyword', color: 'oklch(0.78 0.16 315)', sample: 'const' },
                      { tok: 'string', color: 'oklch(0.82 0.13 85)', sample: '"hello"' },
                      { tok: 'class', color: 'oklch(0.85 0.14 65)', sample: 'Promise' },
                      { tok: 'entity', color: 'var(--color-accent)', sample: 'map' },
                      { tok: 'property', color: 'oklch(0.78 0.11 210)', sample: '.length' },
                      { tok: 'identifier', color: 'var(--color-fg)', sample: 'items' },
                      { tok: 'comment', color: 'var(--color-fg-faint)', sample: '// note' },
                      { tok: 'sign', color: 'var(--color-fg-faint)', sample: '=>' },
                    ].map((t) => (
                      <div key={t.tok} className="token-row">
                        <span style={{ fontFamily: 'var(--font-mono)', color: t.color }}>{t.sample}</span>
                        <span className="t-faint">{t.tok}</span>
                        <code className="inline" style={{ marginLeft: 'auto' }}>--sh-{t.tok}</code>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </div>
            </Section>

            {/* 16 VOICE */}
            <Section id="voice" num="16" title="voice + tone.">
              <p className="sec-desc">
                three rules. be precise. be lowercase. be slightly dry. no exclamation marks unless someone is actually
                on fire.
              </p>
              <div className="c-grid-2">
                <div className="panel">
                  <div className="panel-head">
                    <span className="dot" />
                    <span className="ttl">do</span>
                  </div>
                  <div className="panel-body" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
                    <p>"social media is doomed (and that's fine)"</p>
                    <p className="t-faint" style={{ marginTop: 8 }}>
                      "last commit · 37 minutes ago"
                    </p>
                    <p className="t-faint" style={{ marginTop: 8 }}>
                      "coffee low"
                    </p>
                    <p className="t-faint" style={{ marginTop: 8 }}>
                      "i write a blog, ship open source, and stream code when the lighting's kind."
                    </p>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <span className="dot" style={{ background: 'var(--color-alert)' }} />
                    <span className="ttl">don't</span>
                  </div>
                  <div
                    className="panel-body"
                    style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7, color: 'var(--color-fg-faint)' }}
                  >
                    <p style={{ textDecoration: 'line-through' }}>"Welcome to My Personal Blog!!! 🚀"</p>
                    <p style={{ textDecoration: 'line-through', marginTop: 8 }}>
                      "Leveraging synergies across the stack"
                    </p>
                    <p style={{ textDecoration: 'line-through', marginTop: 8 }}>"Click here to learn more →"</p>
                    <p style={{ textDecoration: 'line-through', marginTop: 8 }}>
                      "💻 Software Engineer | 🌍 London | ☕ Coffee Lover"
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            <footer className="ds-footer">
              <span>
                design.sys {SITE.version} · last updated apr 19, 2026
              </span>
              <span>
                ←{' '}
                <Link to="/" className="t-accent">
                  back to home
                </Link>
              </span>
            </footer>
          </div>
        </div>
      </main>
    </>
  );
}

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sec" id={id}>
      <div className="sec-hd">
        <span className="sec-num">{num} //</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className="sub">
      <div className="sub-hd">
        <h3>{title}</h3>
        <span className="count">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Spec({
  children,
  code,
  tag,
  flush,
}: {
  children: React.ReactNode;
  code: string;
  tag: string;
  flush?: boolean;
}) {
  return (
    <div className="spec">
      <div className={'spec-render' + (flush ? ' flush' : '')}>{children}</div>
      <div className="spec-code">
        <code>{code}</code>
        <span className="tag">{tag}</span>
      </div>
    </div>
  );
}

const CSS = `
  .shell-ds { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

  .layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--sp-8);
    padding: var(--sp-8) 0;
  }

  .side { position: sticky; top: 72px; height: max-content; font-size: var(--fs-sm); }
  .side .grp { margin-bottom: var(--sp-5); }
  .side .grp-title {
    color: var(--color-fg-faint);
    text-transform: lowercase;
    font-size: var(--fs-xs);
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  .side a {
    display: block;
    color: var(--color-fg-dim);
    padding: 3px 0 3px 12px;
    border-left: 1px solid var(--color-border);
    font-size: var(--fs-sm);
    text-decoration: none;
  }
  .side a:hover, .side a.active { color: var(--color-accent); border-left-color: var(--color-accent); text-decoration: none; }

  .doc-title {
    margin-bottom: var(--sp-8);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--sp-6);
  }
  .doc-title pre {
    color: var(--color-accent);
    font-size: 10px;
    line-height: 1.1;
    text-shadow: 0 0 6px var(--accent-glow);
    margin-bottom: var(--sp-4);
    white-space: pre;
  }
  .doc-title h1 {
    font-family: var(--font-display);
    font-size: var(--fs-4xl);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 1;
    margin-bottom: var(--sp-3);
  }
  .doc-title p {
    max-width: 56ch;
    color: var(--color-fg-dim);
    line-height: 1.6;
  }
  .doc-title .meta {
    display: flex;
    gap: var(--sp-5);
    margin-top: var(--sp-4);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-wrap: wrap;
  }
  .doc-title .meta b { color: var(--color-accent); font-weight: 400; }

  section.sec {
    margin-bottom: var(--sp-12);
    scroll-margin-top: 80px;
  }
  .sec-hd {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    margin-bottom: var(--sp-2);
  }
  .sec-num {
    font-family: var(--font-mono);
    color: var(--color-accent);
    font-size: var(--fs-sm);
    letter-spacing: 0.1em;
  }
  .sec-hd h2 {
    font-family: var(--font-display);
    font-size: var(--fs-3xl);
    font-weight: 500;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .sec-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-md);
    max-width: 64ch;
    margin-bottom: var(--sp-6);
    padding-bottom: var(--sp-6);
    border-bottom: 1px dashed var(--color-border);
  }

  .sub { margin-bottom: var(--sp-8); }
  .sub-hd {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--sp-3);
  }
  .sub-hd h3 {
    font-size: var(--fs-md);
    color: var(--color-fg);
    font-weight: 500;
  }
  .sub-hd .count {
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  .spec {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    position: relative;
  }
  .spec-render {
    padding: var(--sp-6);
    min-height: 80px;
    position: relative;
  }
  .spec-render.flush { padding: 0; }
  .spec-code {
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px dashed var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: var(--color-bg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-3);
  }
  .spec-code code { color: var(--color-fg-dim); font-family: var(--font-mono); }
  .spec-code .tag { color: var(--color-accent); }

  .type-row {
    display: grid;
    grid-template-columns: 140px 1fr auto;
    align-items: baseline;
    gap: var(--sp-4);
    padding: var(--sp-5) 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .type-row:last-child { border-bottom: 0; }
  .type-row .lbl { font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .type-row .lbl .tok { color: var(--color-accent); display: block; }
  .type-row .spec-val { color: var(--color-fg-dim); font-size: var(--fs-xs); text-align: right; }
  .type-row .example { color: var(--color-fg); line-height: 1.1; }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-3);
  }
  .swatch {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .swatch-chip {
    height: 80px;
  }
  .swatch-info {
    padding: var(--sp-3);
    font-size: var(--fs-xs);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .swatch-info .name { color: var(--color-fg); font-size: var(--fs-sm); }
  .swatch-info .tok { color: var(--color-accent); font-family: var(--font-mono); }
  .swatch-info .val { color: var(--color-fg-faint); font-family: var(--font-mono); }

  .spacing-row {
    display: grid;
    grid-template-columns: 80px 120px 1fr;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-2) 0;
    border-bottom: 1px dashed var(--color-border);
    font-size: var(--fs-sm);
  }
  .spacing-row:last-child { border-bottom: 0; }
  .spacing-row .tok { color: var(--color-accent); font-family: var(--font-mono); }
  .spacing-row .val { color: var(--color-fg-dim); font-size: var(--fs-xs); font-family: var(--font-mono); }
  .spacing-row .bar-v {
    height: 16px;
    background: var(--color-accent);
    box-shadow: 0 0 4px var(--accent-glow);
  }

  .c-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  .c-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); }
  @media (max-width: 900px) {
    .c-grid-2, .c-grid-3 { grid-template-columns: 1fr; }
    .layout { grid-template-columns: 1fr; }
    .side { position: static; }
    .type-row { grid-template-columns: 1fr; }
    .type-row .spec-val { text-align: left; }
  }

  .dotted-demo {
    display: flex; align-items: center; justify-content: center;
    min-height: 140px;
    background-image: radial-gradient(circle, #151515 1px, transparent 1px);
    background-size: 8px 8px;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
  }
  .icon-cell {
    background: var(--color-bg-panel);
    padding: var(--sp-3);
    text-align: center;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    transition: background 0.12s, color 0.12s;
  }
  .icon-cell:hover { background: var(--color-bg-raised); color: var(--color-accent); }
  .icon-cell .glyph {
    display: block;
    font-size: 22px;
    color: var(--color-fg);
    margin-bottom: 6px;
    line-height: 1;
  }
  .icon-cell:hover .glyph { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }

  .motion-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-3);
  }
  .motion-card {
    padding: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    text-align: center;
    font-size: var(--fs-xs);
  }
  .motion-card .demo {
    height: 40px;
    position: relative;
    margin-bottom: var(--sp-3);
  }
  .motion-card .demo::after {
    content: "";
    position: absolute;
    left: 0; top: 50%;
    width: 16px; height: 16px;
    background: var(--color-accent);
    box-shadow: 0 0 8px var(--accent-glow);
    transform: translateY(-50%);
  }
  .motion-card .demo.ease::after { animation: travel 2s ease-in-out infinite; }
  .motion-card .demo.linear::after { animation: travel 2s linear infinite; }
  .motion-card .demo.elastic::after { animation: travel 2s cubic-bezier(.68,-0.6,.32,1.6) infinite; }
  .motion-card .demo.stepped::after { animation: travel 2s steps(8) infinite; }
  @keyframes travel {
    0% { left: 0; } 50% { left: calc(100% - 16px); } 100% { left: 0; }
  }
  .motion-card .name { color: var(--color-fg); }
  .motion-card .val { color: var(--color-fg-faint); margin-top: 2px; }

  .skel {
    height: 14px;
    background: linear-gradient(90deg, var(--color-bg-raised) 0%, var(--color-border-bright) 50%, var(--color-bg-raised) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.8s infinite linear;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .bar {
    height: 8px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .bar > span {
    display: block; height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
  }
  .bar-ascii {
    font-family: var(--font-mono);
    color: var(--color-accent);
    letter-spacing: 1px;
    font-size: var(--fs-sm);
  }

  .divider-ascii {
    font-family: var(--font-mono);
    color: var(--color-border-bright);
    text-align: center;
    font-size: var(--fs-xs);
    margin: var(--sp-8) 0;
    user-select: none;
  }

  .ds-footer {
    border-top: 1px solid var(--color-border);
    padding: var(--sp-6) 0 var(--sp-10);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex;
    justify-content: space-between;
    margin-top: var(--sp-8);
  }

  .token-grid { display: flex; flex-direction: column; gap: 4px; }
  .token-row {
    display: flex; align-items: baseline; gap: var(--sp-4);
    padding: 6px 0;
    border-bottom: 1px dashed var(--color-border);
    font-size: var(--fs-sm);
  }
  .token-row:last-child { border-bottom: 0; }
`;
