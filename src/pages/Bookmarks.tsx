import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Kind = 'article' | 'video' | 'paper' | 'tool' | 'thread' | 'talk';

type Bookmark = {
  title: string;
  url: string;
  domain: string;
  author?: string;
  kind: Kind;
  saved_at: string; // yyyy-mm-dd
  note: string;
  tags: string[];
};

// Hand-authored list — swap to an API when it gets tedious. Ordered newest first.
const BOOKMARKS: Bookmark[] = [
  {
    title: 'the grug brained developer',
    url: 'https://grugbrain.dev/',
    domain: 'grugbrain.dev',
    author: 'carson gross',
    kind: 'article',
    saved_at: '2026-04-18',
    note: 'anti-complexity gospel. the part on factoring over early abstraction earned a permanent slot in my brain.',
    tags: ['craft', 'architecture'],
  },
  {
    title: 'two bits of type-level typescript',
    url: 'https://effectivetypescript.com/',
    domain: 'effectivetypescript.com',
    kind: 'article',
    saved_at: '2026-04-12',
    note: 'reducer-style conditional types that i keep re-deriving by hand. save me.',
    tags: ['typescript'],
  },
  {
    title: 'the webb space telescope — raw frames',
    url: 'https://mast.stsci.edu/',
    domain: 'mast.stsci.edu',
    kind: 'tool',
    saved_at: '2026-04-10',
    note: 'public archive of raw jwst captures. i want to render a tiny viewer lab eventually.',
    tags: ['space', 'data'],
  },
  {
    title: 'atproto firehose patterns — sourcegraph post',
    url: 'https://sourcegraph.com/blog/firehose',
    domain: 'sourcegraph.com',
    kind: 'article',
    saved_at: '2026-04-06',
    note: 'backpressure + replay strategies; directly inspired the jetstream lab buffer flush.',
    tags: ['atproto', 'streaming'],
  },
  {
    title: 'human-readable durations — paper',
    url: 'https://arxiv.org/abs/1902.12040',
    domain: 'arxiv.org',
    kind: 'paper',
    saved_at: '2026-03-31',
    note: '"a few minutes" vs "3:02" — when each one reduces cognitive load. reference for the cron lab.',
    tags: ['ux', 'time'],
  },
  {
    title: 'why you should not use vite (2025)',
    url: 'https://example.com/anti-vite',
    domain: 'example.com',
    kind: 'article',
    saved_at: '2026-03-22',
    note: "keeping this around as a stress-test for my own opinions. didn't change them but sharpened them.",
    tags: ['tooling'],
  },
  {
    title: 'jepsen — maelstrom workshop',
    url: 'https://github.com/jepsen-io/maelstrom',
    domain: 'github.com',
    author: 'kyle kingsbury',
    kind: 'tool',
    saved_at: '2026-03-19',
    note: 'building toy distributed systems in whatever language. want to do the echo → broadcast → kafka path on a weekend.',
    tags: ['distributed', 'learning'],
  },
  {
    title: 'no one at coinbase uses coinbase',
    url: 'https://blog.example.com/coinbase',
    domain: 'blog.example.com',
    kind: 'thread',
    saved_at: '2026-03-14',
    note: 'dogfooding post-mortem. good reminder that "we use our own stuff" is frequently a lie.',
    tags: ['product'],
  },
  {
    title: 'strange loop 2024 — "accidentally quadratic"',
    url: 'https://www.youtube.com/watch?v=example',
    domain: 'youtube.com',
    author: 'nelson elhage',
    kind: 'talk',
    saved_at: '2026-03-08',
    note: 'every perf bug i\'ve caused, laid out. the `.includes()`-in-a-loop slide hurt personally.',
    tags: ['performance'],
  },
  {
    title: 'the grand unified theory of documents',
    url: 'https://maggieappleton.com/home-cooked-software',
    domain: 'maggieappleton.com',
    author: 'maggie appleton',
    kind: 'article',
    saved_at: '2026-03-01',
    note: 'home-cooked software as an aesthetic. direct inspiration for this whole site tbh.',
    tags: ['craft', 'philosophy'],
  },
  {
    title: 'how to read a research paper',
    url: 'https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf',
    domain: 'stanford.edu',
    author: 's. keshav',
    kind: 'paper',
    saved_at: '2026-02-25',
    note: 'three-pass method. i use this every time i open a systems paper.',
    tags: ['learning'],
  },
  {
    title: 'the unix haters handbook (full pdf)',
    url: 'https://web.mit.edu/~simsong/www/ugh.pdf',
    domain: 'mit.edu',
    kind: 'paper',
    saved_at: '2026-02-19',
    note: "old enough to be nostalgic, sharp enough to still land. 'this is unix; you keep your head in a bag'.",
    tags: ['unix', 'history'],
  },
  {
    title: 'notes on parquet',
    url: 'https://example.com/parquet',
    domain: 'example.com',
    kind: 'article',
    saved_at: '2026-02-11',
    note: 'dremel record-shredding done well. schema evolution section alone justifies the save.',
    tags: ['data'],
  },
  {
    title: 'the original html spec — tim berners-lee',
    url: 'https://info.cern.ch/hypertext/WWW/MarkUp/Tags.html',
    domain: 'info.cern.ch',
    kind: 'article',
    saved_at: '2026-01-30',
    note: '13 tags. every modern framework is a reaction to the choices here.',
    tags: ['web', 'history'],
  },
  {
    title: 'static search for the open web',
    url: 'https://github.com/pagefind/pagefind',
    domain: 'github.com',
    kind: 'tool',
    saved_at: '2026-01-21',
    note: 'keeping on deck for when this blog gets big enough to need in-page search.',
    tags: ['search', 'tooling'],
  },
];

const KIND_LABEL: Record<Kind, string> = {
  article: 'article',
  video: 'video',
  paper: 'paper',
  tool: 'tool',
  thread: 'thread',
  talk: 'talk',
};

const KIND_GLYPH: Record<Kind, string> = {
  article: '¶',
  video: '▶',
  paper: '◱',
  tool: '⚒',
  thread: '⌁',
  talk: '◐',
};

export default function BookmarksPage() {
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const b of BOOKMARKS) for (const t of b.tags) s.add(t);
    return [...s].sort();
  }, []);

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { all: BOOKMARKS.length };
    for (const b of BOOKMARKS) c[b.kind] = (c[b.kind] ?? 0) + 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    return BOOKMARKS.filter((b) => (kind === 'all' || b.kind === kind) && (tag === null || b.tags.includes(tag)));
  }, [kind, tag]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-bm">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/bookmarks
          </div>
          <h1>
            bookmarks<span className="dot">.</span>
          </h1>
          <p className="sub">
            articles, talks, papers, and tools i&apos;ve kept around. no algorithmic feed, no engagement bait — just
            things worth re-reading.
          </p>
          <div className="meta">
            <span>
              total <b>{BOOKMARKS.length}</b>
            </span>
            <span>
              tags <b>{allTags.length}</b>
            </span>
            <span>
              newest <b>{BOOKMARKS[0].saved_at}</b>
            </span>
          </div>
        </header>

        <section className="controls">
          <div className="kinds">
            {(['all', 'article', 'video', 'paper', 'tool', 'thread', 'talk'] as const).map((k) => (
              <button
                key={k}
                className={'chip' + (kind === k ? ' on' : '')}
                onClick={() => setKind(k)}
                type="button"
              >
                {k === 'all' ? 'all' : KIND_LABEL[k]} <span className="chip-n">{kindCounts[k] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="tags">
            <button className={'chip' + (tag === null ? ' on' : '')} onClick={() => setTag(null)} type="button">
              any tag
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                className={'chip' + (tag === t ? ' on' : '')}
                onClick={() => setTag(tag === t ? null : t)}
                type="button"
              >
                #{t}
              </button>
            ))}
          </div>
        </section>

        <section className="bm-list">
          {filtered.map((b) => (
            <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer" className="bm-row">
              <div className="bm-ico" aria-hidden="true">
                {KIND_GLYPH[b.kind]}
              </div>
              <div className="bm-body">
                <div className="bm-top">
                  <span className="bm-kind">{KIND_LABEL[b.kind]}</span>
                  <span className="bm-dot">·</span>
                  <span className="bm-domain">{b.domain}</span>
                  {b.author ? (
                    <>
                      <span className="bm-dot">·</span>
                      <span className="bm-author">{b.author}</span>
                    </>
                  ) : null}
                  <span className="bm-date">{b.saved_at}</span>
                </div>
                <div className="bm-title">{b.title}</div>
                <div className="bm-note">{b.note}</div>
                <div className="bm-tags">
                  {b.tags.map((t) => (
                    <span key={t} className="bm-tag">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bm-go" aria-hidden="true">
                →
              </div>
            </a>
          ))}
          {filtered.length === 0 ? <div className="empty">no matches. try a different filter.</div> : null}
        </section>

        <footer className="bm-footer">
          <span>
            src: <span className="t-accent">hand-curated · {BOOKMARKS.length} entries</span>
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
  .shell-bm { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 58ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5); font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-accent); font-weight: 400; }

  .controls {
    display: flex; flex-direction: column; gap: var(--sp-3);
    padding: var(--sp-5) 0 var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
  }
  .kinds, .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 4px 10px; background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-fg-faint);
    cursor: pointer;
    letter-spacing: 0.06em;
    text-transform: lowercase;
  }
  .chip:hover { border-color: var(--color-accent-dim); color: var(--color-fg); }
  .chip.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 10%, transparent); }
  .chip-n { margin-left: 4px; color: var(--color-fg-ghost); }

  .bm-list { display: flex; flex-direction: column; margin-top: var(--sp-4); }
  .bm-row {
    display: grid;
    grid-template-columns: 48px 1fr 24px;
    gap: var(--sp-4);
    padding: var(--sp-4) 0;
    border-bottom: 1px dashed var(--color-border);
    text-decoration: none;
    color: inherit;
  }
  .bm-row:hover { text-decoration: none; }
  .bm-row:hover .bm-title { color: var(--color-accent); }
  .bm-row:hover .bm-ico { color: var(--color-accent); text-shadow: 0 0 8px var(--accent-glow); }
  .bm-row:hover .bm-go { color: var(--color-accent); transform: translateX(4px); }

  .bm-ico {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--color-fg-faint);
    text-align: center;
    padding-top: 2px;
    transition: color 0.15s;
  }
  .bm-top {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .bm-top .bm-kind { color: var(--color-accent); }
  .bm-top .bm-dot { opacity: 0.5; }
  .bm-top .bm-date { margin-left: auto; color: var(--color-fg-ghost); text-transform: none; letter-spacing: 0.04em; }
  .bm-title {
    font-family: var(--font-display);
    font-size: 22px; font-weight: 500; letter-spacing: -0.01em;
    color: var(--color-fg);
    line-height: 1.2; margin-top: 6px;
  }
  .bm-note {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm); line-height: 1.55;
    margin-top: 6px;
  }
  .bm-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .bm-tag {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    letter-spacing: 0.04em;
  }
  .bm-go {
    font-size: 20px;
    color: var(--color-fg-faint);
    align-self: center;
    text-align: right;
    transition: color 0.15s, transform 0.15s;
  }
  .empty {
    padding: var(--sp-8) 0;
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .bm-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
