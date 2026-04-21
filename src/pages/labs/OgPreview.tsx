import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';
import { SITE } from '../../data';
import { getOgMeta, type OgMeta } from '../../server/og-preview';

/** When previewing a localhost source, rewrite any production og:image urls
 *  back to the same localhost origin so the cards actually load. Lets you
 *  verify /og/<slug> output before deploying. */
function rewriteLocalhost(meta: OgMeta): OgMeta {
  try {
    const src = new URL(meta.finalUrl);
    if (src.hostname !== 'localhost' && src.hostname !== '127.0.0.1') return meta;
    const bust = Date.now().toString(36);
    const swap = (u: string | undefined): string | undefined => {
      if (!u) return u;
      try {
        const parsed = new URL(u);
        if (parsed.hostname === SITE.domain) {
          parsed.protocol = src.protocol;
          parsed.host = src.host;
          // bust browser cache during iteration
          parsed.searchParams.set('_v', bust);
          return parsed.toString();
        }
        return u;
      } catch {
        return u;
      }
    };
    return {
      ...meta,
      image: swap(meta.image),
      twitterImage: swap(meta.twitterImage),
      favicon: swap(meta.favicon),
    };
  } catch {
    return meta;
  }
}

export default function OgPreviewPage() {
  const [input, setInput] = useState(`https://${SITE.domain}`);
  const [submitted, setSubmitted] = useState<string | null>(`https://${SITE.domain}`);

  const query = useQuery({
    queryKey: ['og-preview', submitted],
    queryFn: async () => rewriteLocalhost(await getOgMeta({ data: { url: submitted! } })),
    enabled: !!submitted,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    setSubmitted(val.startsWith('http') ? val : `https://${val}`);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-og">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">og-preview</span>
        </div>

        <header className="og-hd">
          <h1>
            og preview<span className="dot">.</span>
          </h1>
          <p className="sub">
            paste a url, see how its <code className="inline">og:*</code> and{' '}
            <code className="inline">twitter:*</code> meta tags would render in common crawlers. fetched on the
            server to sidestep cors; the raw tag dump lives at the bottom for debugging.
          </p>
        </header>

        <form onSubmit={onSubmit} className="og-form">
          <input
            className="inp"
            type="text"
            placeholder="https://imlunahey.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="go" disabled={!input.trim() || query.isFetching}>
            {query.isFetching ? 'fetching…' : 'preview →'}
          </button>
        </form>

        {query.isFetching && !query.data ? <LoadingPanel /> : null}

        {query.error ? (
          <section className="err">
            <div className="err-hd">// error</div>
            <div className="err-body">{query.error instanceof Error ? query.error.message : String(query.error)}</div>
          </section>
        ) : null}

        {query.data ? (
          <>
            <div className="previews">
              <BlueskyCard meta={query.data} />
              <TwitterCard meta={query.data} />
              <DiscordCard meta={query.data} />
              <SlackCard meta={query.data} />
            </div>

            <section className="summary">
              <div className="summary-hd">// resolved</div>
              <dl className="summary-dl">
                <dt>url</dt>
                <dd>{query.data.url}</dd>
                {query.data.finalUrl !== query.data.url ? (
                  <>
                    <dt>final url</dt>
                    <dd>{query.data.finalUrl}</dd>
                  </>
                ) : null}
                {query.data.canonical ? (
                  <>
                    <dt>canonical</dt>
                    <dd>{query.data.canonical}</dd>
                  </>
                ) : null}
                <dt>title</dt>
                <dd>{query.data.title ?? <span className="t-faint">(missing)</span>}</dd>
                <dt>description</dt>
                <dd>{query.data.description ?? <span className="t-faint">(missing)</span>}</dd>
                <dt>og:image</dt>
                <dd>
                  {query.data.image ?? <span className="t-faint">(missing)</span>}
                </dd>
                <dt>site name</dt>
                <dd>{query.data.siteName ?? <span className="t-faint">(missing)</span>}</dd>
                <dt>twitter:card</dt>
                <dd>{query.data.twitterCard ?? <span className="t-faint">(missing)</span>}</dd>
              </dl>
            </section>

            <section className="raw">
              <CodeBlock
                code={JSON.stringify(query.data.raw, null, 2)}
                filename="raw head meta"
                language="json"
              />
            </section>
          </>
        ) : null}

        <footer className="og-footer">
          <span>
            src: <span className="t-accent">server fn · regex meta parser · no headless browser</span>
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

// ─── card previews ─────────────────────────────────────────────────────────

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function BlueskyCard({ meta }: { meta: OgMeta }) {
  return (
    <CardShell name="bluesky">
      <div className="bsky-card">
        {meta.image ? (
          <div className="bsky-img" style={{ backgroundImage: `url(${cssUrl(meta.image)})` }} />
        ) : (
          <div className="bsky-img empty" />
        )}
        <div className="bsky-body">
          <div className="bsky-host">{hostOf(meta.finalUrl)}</div>
          <div className="bsky-title">{meta.title ?? '(no title)'}</div>
          {meta.description ? <div className="bsky-desc">{meta.description}</div> : null}
        </div>
      </div>
    </CardShell>
  );
}

function TwitterCard({ meta }: { meta: OgMeta }) {
  const image = meta.twitterImage ?? meta.image;
  return (
    <CardShell name="twitter / x">
      <div className="tw-card">
        {image ? (
          <div className="tw-img" style={{ backgroundImage: `url(${cssUrl(image)})` }} />
        ) : (
          <div className="tw-img empty" />
        )}
        <div className="tw-strip">
          <span className="tw-host">{hostOf(meta.finalUrl)}</span>
          <span className="tw-title">{meta.twitterTitle ?? meta.title ?? '(no title)'}</span>
        </div>
      </div>
    </CardShell>
  );
}

function DiscordCard({ meta }: { meta: OgMeta }) {
  return (
    <CardShell name="discord">
      <div className="dc-card">
        <div className="dc-bar" />
        <div className="dc-body">
          {meta.siteName ? <div className="dc-site">{meta.siteName}</div> : null}
          <div className="dc-title">{meta.title ?? '(no title)'}</div>
          {meta.description ? <div className="dc-desc">{meta.description}</div> : null}
          {meta.image ? (
            <div className="dc-img" style={{ backgroundImage: `url(${cssUrl(meta.image)})` }} />
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}

function SlackCard({ meta }: { meta: OgMeta }) {
  return (
    <CardShell name="slack">
      <div className="sl-card">
        <div className="sl-bar" />
        <div className="sl-body">
          {meta.siteName ? (
            <div className="sl-site">
              {meta.favicon ? <img src={meta.favicon} alt="" className="sl-fav" /> : null}
              <span>{meta.siteName}</span>
            </div>
          ) : null}
          <div className="sl-title">{meta.title ?? '(no title)'}</div>
          {meta.description ? <div className="sl-desc">{meta.description}</div> : null}
          {meta.image ? (
            <img className="sl-img" src={meta.image} alt="" />
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}

function CardShell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-hd">// {name}</div>
      <div className="card-frame">{children}</div>
    </section>
  );
}

function cssUrl(u: string): string {
  return u.replace(/"/g, '%22').replace(/\)/g, '%29');
}

function LoadingPanel() {
  return (
    <section className="prog">
      <div className="prog-line">fetching and parsing head…</div>
      <div className="prog-bar">
        <div className="prog-bar-indeterminate" />
      </div>
    </section>
  );
}

const CSS = `
  .shell-og { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .og-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .og-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .og-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .og-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .og-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .og-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
  .inp {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }
  .go {
    padding: 10px 18px;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .go:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .go:disabled { opacity: 0.4; cursor: not-allowed; }

  /* card shell */
  .previews {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: var(--sp-4);
    margin-top: var(--sp-6);
  }
  .card {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .card-hd {
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .card-frame {
    padding: var(--sp-5);
    background: #0c0c0c;
    min-height: 200px;
    display: flex; align-items: center; justify-content: center;
  }

  /* bluesky card (rounded, image on top) */
  .bsky-card {
    background: #fff;
    color: #000;
    border-radius: 10px;
    overflow: hidden;
    width: 100%;
    max-width: 420px;
    font-family: system-ui, -apple-system, sans-serif;
    border: 1px solid #e6e6ea;
  }
  .bsky-img {
    aspect-ratio: 1200 / 630;
    background-size: cover;
    background-position: center;
    background-color: #f4f4f5;
  }
  .bsky-img.empty {
    background-image: repeating-linear-gradient(45deg, #e6e6ea 0 8px, transparent 8px 16px);
  }
  .bsky-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
  .bsky-host { font-size: 11px; color: #6b6b73; }
  .bsky-title { font-size: 15px; font-weight: 600; line-height: 1.3; color: #0b0b0c; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .bsky-desc { font-size: 13px; color: #44444a; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* twitter large-image card */
  .tw-card {
    background: #15181c;
    color: #e7e9ea;
    border-radius: 16px;
    overflow: hidden;
    width: 100%;
    max-width: 420px;
    font-family: system-ui, -apple-system, sans-serif;
    border: 1px solid #2f3336;
  }
  .tw-img { aspect-ratio: 1200 / 630; background-size: cover; background-position: center; background-color: #1f2328; }
  .tw-img.empty { background-image: repeating-linear-gradient(45deg, #2f3336 0 8px, transparent 8px 16px); }
  .tw-strip {
    padding: 8px 14px 10px;
    display: flex; flex-direction: column; gap: 2px;
    border-top: 1px solid #2f3336;
  }
  .tw-host { font-size: 13px; color: #71767b; }
  .tw-title { font-size: 15px; font-weight: 400; line-height: 1.25; color: #e7e9ea; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* discord embed */
  .dc-card {
    background: #2b2d31;
    color: #dbdee1;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    max-width: 420px;
    font-family: gg sans, system-ui, -apple-system, sans-serif;
    display: grid;
    grid-template-columns: 4px 1fr;
    border: 1px solid #1e1f22;
  }
  .dc-bar { background: #5865f2; }
  .dc-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 4px; }
  .dc-site { font-size: 12px; color: #b5bac1; }
  .dc-title { font-size: 14px; font-weight: 600; color: #00a8fc; line-height: 1.3; }
  .dc-desc { font-size: 13px; color: #dbdee1; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
  .dc-img {
    margin-top: 8px;
    width: 100%;
    aspect-ratio: 1200 / 630;
    background-size: cover;
    background-position: center;
    background-color: #1e1f22;
    border-radius: 4px;
  }

  /* slack unfurl */
  .sl-card {
    background: #ffffff;
    color: #1d1c1d;
    width: 100%;
    max-width: 480px;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    display: grid;
    grid-template-columns: 4px 1fr;
    border: 1px solid #e0e0e0;
  }
  .sl-bar { background: #cccccc; }
  .sl-body { padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 4px; }
  .sl-site { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #616061; }
  .sl-fav { width: 14px; height: 14px; }
  .sl-title { font-size: 14px; font-weight: 700; color: #1264a3; line-height: 1.25; }
  .sl-desc { font-size: 13px; color: #1d1c1d; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .sl-img { margin-top: 8px; max-width: 100%; max-height: 240px; border-radius: 4px; }

  /* summary + raw */
  .summary {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
  }
  .summary-hd {
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-3);
  }
  .summary-dl { display: grid; grid-template-columns: 120px 1fr; gap: 4px var(--sp-3); font-size: var(--fs-xs); }
  .summary-dl dt { color: var(--color-fg-faint); }
  .summary-dl dd { color: var(--color-fg); margin: 0; word-break: break-all; }
  .summary-dl .t-faint { color: var(--color-fg-ghost); }
  .raw { margin-top: var(--sp-4); }

  /* progress + error */
  .prog {
    margin-top: var(--sp-5);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .prog-line { margin-bottom: var(--sp-2); }
  .prog-bar { height: 4px; background: var(--color-border); overflow: hidden; }
  .prog-bar-indeterminate {
    height: 100%; width: 30%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
    animation: prog-slide 1.2s ease-in-out infinite;
  }
  @keyframes prog-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  .err {
    margin-top: var(--sp-5);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .err-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-alert) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-alert);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .err-body { padding: var(--sp-3) var(--sp-4); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .og-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
