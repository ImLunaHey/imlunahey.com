import { Link } from '@tanstack/react-router';

type Job = {
  when: string;
  title: React.ReactNode;
  company: React.ReactNode;
  meta: string;
  description?: React.ReactNode;
  bullets?: Array<React.ReactNode>;
};

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="ext" href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const EXPERIENCE: Array<Job> = [
  {
    when: '2025 → 2026',
    title: 'Software Engineer',
    company: <Ext href="https://axiom.co">Axiom.co</Ext>,
    meta: 'full-time · remote · london, uk',
    bullets: [
      <>
        <b>679 merged PRs</b> spanning a major Console re-architecture, a design-system migration, performance, and compliance.
      </>,
      <>
        Led a multi-quarter re-architecture of the <Ext href="https://app.axiom.co">Axiom Console</Ext> — migrated a single-package Vite SPA to a <b>TanStack Start</b> full-stack React app in a pnpm + Turborepo monorepo with cacheable build, test, and CI pipelines.
      </>,
      <>
        Replaced the data layer end-to-end — swapped tRPC and axios for server functions and native fetch, moved app state to TanStack Query, and helped migrate legacy modal/form flows to a unified &ldquo;panels &amp; actions&rdquo; pattern.
      </>,
      <>
        Drove a console-wide design-system migration — replaced core UI primitives (modals, dropdowns, selects), retired a legacy forms framework, and moved styling to Tailwind.
      </>,
      <>
        Improved query performance on large result sets — removed quadratic-time hot paths and added lazy rendering — and ran a cross-browser stability effort focused on Safari.
      </>,
      <>
        Raised engineering rigor — built tooling to incrementally remove untyped code across the codebase, and hardened the console to meet BAA/ePHI compliance requirements.
      </>,
    ],
  },
  {
    when: '2023 → 2025',
    title: 'Software Engineer',
    company: <Ext href="https://axiom.co">Axiom.co</Ext>,
    meta: 'full-time · remote · adelaide, au',
    bullets: [
      <>
        <b>225 merged PRs.</b> Joined as a frontend engineer focused on modernising the React codebase, charts, and product features.
      </>,
      <>
        Migrated a large surface of legacy class components to modern functional components and removed untyped code across the codebase, improving maintainability.
      </>,
      <>
        Built the annotations feature end-to-end — from initial implementation through the in-query annotations menu and tooltip interactions.
      </>,
      <>
        Delivered charting improvements — new chart types, a rewritten percentiles chart with annotation support, error resilience, and mobile-friendly layouts — alongside accessibility wins.
      </>,
    ],
  },
  {
    when: '2023',
    title: 'Frontend Engineer',
    company: <Ext href="https://www.canva.com">Canva</Ext>,
    meta: 'full-time · remote · adelaide, au',
  },
  {
    when: '2018 → 2022',
    title: 'Senior Software Engineer',
    company: <Ext href="https://unraid.net">Lime Technology Inc.</Ext>,
    meta: 'full-time · remote · adelaide, au · maker of Unraid OS',
    bullets: [
      <>
        One of the engineers who started <b>Unraid Connect</b> (
        <Ext href="https://connect.myunraid.net">
          <code>connect.myunraid.net</code>
        </Ext>
        ) — built the first version of its API and backend. Connect is the cloud companion for Unraid OS, providing secure remote management, monitoring, and flash backups for home and business servers.
      </>,
    ],
  },
  {
    when: '2017 → 2018',
    title: 'Senior Web Developer',
    company: 'NiftyLettuce LLC',
    meta: 'full-time · remote · adelaide, au',
    bullets: [
      <>
        Worked across the open-source{' '}
        <Ext href="https://lad.js.org">
          <b>Lad.js</b>
        </Ext>{' '}
        ecosystem — the Koa-based Node.js framework (web + API servers and a built-in job scheduler) and sibling projects spanning email infrastructure, logging, and developer tooling (<Ext href="https://forwardemail.net">Forward Email</Ext>,{' '}
        <Ext href="https://jobscheduler.net">Bree</Ext>, <Ext href="https://cabinjs.com">Cabin</Ext>).
      </>,
    ],
  },
  {
    when: '2014',
    title: 'CEO',
    company: 'Activity+',
    meta: 'full-time · remote · adelaide, au',
    description:
      'Founded a social-analytics company using proprietary algorithms to find optimal social posting times. Acquired by Bettr Inc., July 2014.',
  },
];

const OPEN_SOURCE: Array<Job> = [
  {
    when: 'active',
    title: <Ext href="https://github.com/ImLunaHey/akari">akari</Ext>,
    company: '~110★',
    meta: 'typescript · at protocol',
    description: 'A Bluesky client built on the AT Protocol — the most-starred project across the portfolio.',
  },
  {
    when: 'active',
    title: <Ext href="https://github.com/ImLunaHey/lunafications">lunafications</Ext>,
    company: '~300 users',
    meta: 'typescript · bluesky bot',
    description: "Bluesky bot that DMs you when you're blocked, added to a list, or when specific accounts post.",
  },
  {
    when: '2016 → 2021',
    title: 'Contributor',
    company: <Ext href="https://github.com/pymedusa/Medusa">PyMedusa</Ext>,
    meta: 'media-manager · open source',
    description:
      'Built the REST API powering third-party apps and the redesigned frontend, replacing a bespoke non-REST setup and adding substantial missing functionality.',
  },
  {
    when: '2015 → 2020',
    title: 'Contributor',
    company: <Ext href="https://github.com/SickRage/SickRage">SickRage</Ext>,
    meta: 'media-manager · open source',
    description:
      'Migrated the project to the Mako templating system and rebuilt the frontend with a cleaner, modern loading approach for faster page loads.',
  },
];

const SKILLS = {
  technical: ['JavaScript', 'Node.js', 'Front-End', 'Web Dev', 'REST'],
  security: ['Penetration Testing', 'Computer Security'],
  practice: ['Performance Testing', 'Test Coverage', 'Engineering'],
};

export default function CvPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cv">
        <div className="bar">
          <span className="dot d1" />
          <span className="dot d2" />
          <span className="dot d3" />
          <span className="path">~/luna/cv.sh</span>
        </div>

        <div className="pad">
          <div className="prompt">whoami</div>
          <h1>
            luna<span className="cur" />
          </h1>
          <div className="tag">software_engineer --remote --security</div>
          <div className="cv-meta">
            <span className="k">loc:</span> london, england, uk &nbsp;
            <span className="k">pronouns:</span> she/her · they/them
            <br />
            <span className="k">email:</span> <a href="mailto:xo@wvvw.me">xo@wvvw.me</a>
            <br />
            <span className="k">git:</span>{' '}
            <a href="https://github.com/ImLunaHey" target="_blank" rel="noopener noreferrer">
              github.com/ImLunaHey
            </a>
            &nbsp; <span className="k">bsky:</span>{' '}
            <a href="https://bsky.app/profile/imlunahey.com" target="_blank" rel="noopener noreferrer">
              @imlunahey.com
            </a>
            &nbsp; <span className="k">x:</span>{' '}
            <a href="https://x.com/ImLunaHey" target="_blank" rel="noopener noreferrer">
              @ImLunaHey
            </a>
          </div>

          <section>
            <h2>cat profile.md</h2>
            <p className="summary">
              Full-stack <b>software engineer</b> with ~10 years building web platforms, APIs and developer tooling — most recently at{' '}
              <Ext href="https://axiom.co">
                <b>Axiom.co</b>
              </Ext>
              . Front-end and <b>Node.js</b> foundations with a focus on <b>security and performance</b>, plus a long history of
              open-source maintenance. Remote-first throughout.
            </p>
          </section>

          <section>
            <h2>git log --experience</h2>
            {EXPERIENCE.map((job, i) => (
              <article key={i} className="job">
                <div className="when">{job.when}</div>
                <div>
                  <div className="jt">
                    {job.title} · <span className="co">{job.company}</span>
                  </div>
                  <div className="jm">{job.meta}</div>
                  {job.description ? <div className="jd">{job.description}</div> : null}
                  {job.bullets ? (
                    <ul className="bl">
                      {job.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2>git log --open-source</h2>
            <p className="summary os-intro">
              <b>186 repositories · ~460 stars.</b> Prolific maintainer of AT Protocol / Bluesky tooling and security-flavoured projects — CT-log
              certificate streaming, crypto-scam domain hunting, and ad-blocking DNS (UDP/TCP, DoH, DoT, DoQ). Profiles:{' '}
              <Ext href="https://github.com/ImLunaHey">
                <code>github.com/ImLunaHey</code>
              </Ext>{' '}
              · prev{' '}
              <Ext href="https://github.com/OmgImAlexis">
                <code>@OmgImAlexis</code>
              </Ext>
              .
            </p>
            {OPEN_SOURCE.map((proj, i) => (
              <article key={i} className="job">
                <div className="when">{proj.when}</div>
                <div>
                  <div className="jt">
                    {proj.title} · <span className="co">{proj.company}</span>
                  </div>
                  <div className="jm">{proj.meta}</div>
                  {proj.description ? <div className="jd">{proj.description}</div> : null}
                </div>
              </article>
            ))}
          </section>

          <div className="grid2">
            <section>
              <h2>ls education/</h2>
              <div className="kv">
                <b>Craigmore High School</b>
                <br />
                SACE — South Australian Certificate of Education
                <br />
                <span className="faint">2009 — 2012</span>
              </div>
              <h2 className="h2-second">ls languages/</h2>
              <div className="kv">
                <b>English</b> — native / bilingual
              </div>
            </section>
            <section>
              <h2>printenv skills</h2>
              <div className="skl">TECHNICAL</div>
              <div className="chips">
                {SKILLS.technical.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
              <div className="skl">SECURITY</div>
              <div className="chips">
                {SKILLS.security.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
              <div className="skl">PRACTICE</div>
              <div className="chips">
                {SKILLS.practice.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <footer className="cv-footer">
            <span className="dl">
              <span className="dl-label">download:</span>
              <a href="/luna-cv-light.pdf" download="luna-cv-light.pdf" className="dl-link">
                pdf --light
              </a>
              <span className="dl-sep">·</span>
              <a href="/luna-cv-dark.pdf" download="luna-cv-dark.pdf" className="dl-link">
                pdf --dark
              </a>
            </span>
            <span>print: ⌘P / Ctrl+P</span>
            <span>
              ←{' '}
              <Link to="/" className="t-accent">
                home
              </Link>
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-cv {
    max-width: 840px;
    margin: var(--sp-6) auto var(--sp-10);
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    font-size: var(--fs-md);
    line-height: 1.6;
  }

  .shell-cv .bar {
    background: var(--color-bg-panel);
    border-bottom: 1px solid var(--color-border);
    padding: 10px 16px;
    display: flex; align-items: center; gap: 8px;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: .05em;
  }
  .shell-cv .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
  .shell-cv .d1 { background: #ff5f56; }
  .shell-cv .d2 { background: #ffbd2e; }
  .shell-cv .d3 { background: #27c93f; }
  .shell-cv .path { margin-left: 10px; }

  .shell-cv .pad { padding: var(--sp-8) var(--sp-10) var(--sp-10); }

  .shell-cv .prompt { color: var(--color-accent); }
  .shell-cv .prompt::before { content: "$ "; color: var(--color-fg-faint); }

  .shell-cv h1 {
    font-family: var(--font-mono);
    font-size: clamp(40px, 7vw, 52px);
    font-weight: 700;
    letter-spacing: -.03em;
    line-height: 1;
    margin: 6px 0 4px;
    color: var(--color-fg);
  }
  .shell-cv h1 .cur {
    display: inline-block;
    width: .55ch; height: .9em;
    background: var(--color-accent);
    margin-left: 4px;
    transform: translateY(2px);
    animation: cv-blink 1.1s steps(1) infinite;
  }
  @keyframes cv-blink { 50% { opacity: 0; } }
  .shell-cv .tag { color: var(--color-alert); font-size: var(--fs-md); }

  .shell-cv .cv-meta {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    margin-top: 10px;
    line-height: 1.9;
  }
  .shell-cv .cv-meta a {
    color: var(--color-fg);
    text-decoration: none;
    border-bottom: 1px dotted var(--color-fg-faint);
  }
  .shell-cv .cv-meta a:hover { color: var(--color-accent); border-bottom-color: var(--color-accent); }
  .shell-cv .cv-meta .k { color: var(--color-fg-faint); }

  /* inline external links anywhere in the cv (bullets, descriptions,
     job titles, company names) — match the dotted-underline meta
     style so they read as links without shouting. */
  .shell-cv .ext {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dotted var(--color-fg-faint);
  }
  .shell-cv .ext:hover {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  .shell-cv .co .ext,
  .shell-cv .jt .ext { color: inherit; }
  .shell-cv .ext code { color: inherit; background: rgba(255, 123, 84, 0.08); }

  .shell-cv section { margin-top: var(--sp-8); }
  .shell-cv h2 {
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: .1em;
    color: var(--color-accent);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 7px;
    margin-bottom: var(--sp-4);
    text-transform: lowercase;
  }
  .shell-cv h2::before { content: "// "; color: var(--color-fg-faint); }
  .shell-cv .h2-second { margin-top: var(--sp-6); }

  .shell-cv .summary {
    color: var(--color-fg-dim);
    font-size: var(--fs-md);
    max-width: 74ch;
  }
  .shell-cv .summary b { color: var(--color-fg); font-weight: 600; }
  .shell-cv .os-intro { margin-bottom: var(--sp-5); }

  .shell-cv .job {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 18px;
    margin-bottom: var(--sp-4);
  }
  .shell-cv .when { color: var(--color-fg-faint); font-size: var(--fs-xs); padding-top: 2px; }
  .shell-cv .jt { font-weight: 600; color: var(--color-fg); font-size: 14px; }
  .shell-cv .co { color: var(--color-alert); }
  .shell-cv .jm { color: var(--color-fg-faint); font-size: var(--fs-xs); margin: 2px 0 4px; }
  .shell-cv .jd { color: var(--color-fg-dim); font-size: var(--fs-sm); max-width: 70ch; }

  .shell-cv .bl { list-style: none; margin: 6px 0 0; padding: 0; }
  .shell-cv .bl li {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.5;
    padding-left: 16px;
    position: relative;
    margin-bottom: 4px;
    max-width: 74ch;
  }
  .shell-cv .bl li::before {
    content: "+";
    position: absolute;
    left: 0;
    color: var(--color-accent);
    font-weight: 600;
  }
  .shell-cv .bl b { color: var(--color-fg); font-weight: 600; }
  .shell-cv .bl code,
  .shell-cv .summary code {
    color: var(--color-alert);
    background: rgba(255, 123, 84, 0.08);
    padding: 0 3px;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 0.95em;
  }

  .shell-cv .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-8);
    margin-top: var(--sp-8);
  }
  .shell-cv .kv { color: var(--color-fg-dim); font-size: var(--fs-md); }
  .shell-cv .kv b { color: var(--color-fg); font-weight: 600; }
  .shell-cv .kv .faint { color: var(--color-fg-faint); }

  .shell-cv .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .shell-cv .chip {
    border: 1px solid var(--color-border-bright);
    padding: 3px 9px;
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    background: var(--color-bg-panel);
  }
  .shell-cv .skl {
    font-size: var(--fs-micro);
    color: var(--color-fg-faint);
    letter-spacing: .12em;
    margin: 12px 0 5px;
  }

  .shell-cv .cv-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-10);
    padding: var(--sp-5) 0 0;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .shell-cv .dl { display: inline-flex; align-items: center; gap: 6px; }
  .shell-cv .dl-label { color: var(--color-fg-faint); }
  .shell-cv .dl-link {
    color: var(--color-fg);
    text-decoration: none;
    border-bottom: 1px dotted var(--color-fg-faint);
    font-family: var(--font-mono);
  }
  .shell-cv .dl-link:hover {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  .shell-cv .dl-sep { color: var(--color-fg-faint); }

  @media print {
    body { background: #fff; color: #000; }
    .shell-cv .dl { display: none; }
    .shell-cv { border: none; max-width: 100%; background: #fff; margin: 0; }
    .shell-cv .bar { background: #f0f0f0; border-color: #ddd; color: #777; }
    .shell-cv .pad { padding: 24px 30px; }
    .shell-cv h1, .shell-cv .jt, .shell-cv .kv b, .shell-cv .summary b, .shell-cv .bl b { color: #000; }
    .shell-cv .summary, .shell-cv .jd, .shell-cv .kv, .shell-cv .bl li, .shell-cv .cv-meta { color: #333; }
    .shell-cv .prompt, .shell-cv h2 { color: #0a7a45; }
    .shell-cv .tag, .shell-cv .co { color: #c1492a; }
    .shell-cv .bl code, .shell-cv .summary code { color: #c1492a; background: #f6efed; }
    .shell-cv .bl li::before { color: #0a7a45; }
    .shell-cv .when, .shell-cv .jm, .shell-cv .skl, .shell-cv .kv .faint, .shell-cv .cv-footer { color: #777; }
    .shell-cv .chip { background: #fff; border-color: #ccc; color: #444; }
    .shell-cv h1 .cur { display: none; }
    .shell-cv .cv-meta a,
    .shell-cv .ext { color: #000; border-bottom-color: #999; }
    .shell-cv .ext code { background: #f6efed; color: #c1492a; }
    @page { margin: 12mm; }
  }

  @media (max-width: 700px) {
    .shell-cv { margin: 0; border-left: 0; border-right: 0; }
    .shell-cv .pad { padding: var(--sp-6) var(--sp-5); }
    .shell-cv .grid2 { grid-template-columns: 1fr; gap: var(--sp-6); }
    .shell-cv .job { grid-template-columns: 1fr; gap: 4px; }
  }
`;
