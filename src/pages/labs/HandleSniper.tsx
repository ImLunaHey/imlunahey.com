import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type ResolveResult = { did: string } | { error: string; notFound?: boolean };

async function resolveHandle(handle: string): Promise<ResolveResult> {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    );
    if (res.status === 400 || res.status === 404) {
      return { error: 'not-found', notFound: true };
    }
    if (!res.ok) return { error: `http ${res.status}` };
    const j = (await res.json()) as { did?: string };
    if (!j.did) return { error: 'no did' };
    return { did: j.did };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'fetch failed' };
  }
}

type Profile = { did: string; handle: string; displayName?: string; avatar?: string; description?: string; followersCount?: number; postsCount?: number };

async function fetchProfile(actor: string): Promise<Profile | null> {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as Profile;
  } catch { return null; }
}

function isValidHandle(h: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(h);
}

/**
 * Public PDSes that offer user handles under their own domain. Ordered by
 * how widely used they are. Add to this list as new community PDSes appear.
 */
const COMMUNITY_PDS_DOMAINS = [
  'bsky.social',
  'blacksky.app',
  'gndr.social',
  'deer.social',
  'boobee.blue',
  'magnetic.fun',
  'hypno.love',
  'pds.witchcraft.systems',
] as const;

function suggestions(base: string): string[] {
  // strip a trailing recognised suffix so we get the bare handle
  let clean = base;
  for (const pds of COMMUNITY_PDS_DOMAINS) {
    if (clean.endsWith('.' + pds)) { clean = clean.slice(0, -pds.length - 1); break; }
  }
  clean = clean.replace(/\..*$/, '');
  if (!clean) return [];

  const out: string[] = [];
  // every community PDS gets a variant
  for (const pds of COMMUNITY_PDS_DOMAINS) out.push(`${clean}.${pds}`);
  // common name-collision workarounds on the default PDS
  out.push(`${clean}1.bsky.social`, `the${clean}.bsky.social`, `${clean}-dev.bsky.social`);
  // self-hosted / custom domain variants
  out.push(`${clean}.dev`, `${clean}.io`, `${clean}.app`);
  return Array.from(new Set(out));
}

export default function HandleSniperPage() {
  const search = useSearch({ strict: false }) as { q?: string };
  const navigate = useNavigate();
  const urlQ = search.q?.trim().toLowerCase() || null;
  const [input, setInput] = useState(urlQ ?? 'imlunahey.com');

  useEffect(() => {
    if (urlQ) setInput(urlQ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const normalized = input.replace(/^@/, '').trim().toLowerCase();

  // The list of handles being checked is derived from the current URL query
  // (plus its suggested variants). Submitting the form navigates to ?q=...
  // so the URL stays shareable.
  const checked = useMemo(() => {
    const base = urlQ || 'imlunahey.com';
    const variants = suggestions(base);
    return Array.from(new Set([base, ...variants])).slice(0, 40);
  }, [urlQ]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!normalized) return;
    navigate({ to: '/labs/handle-sniper', search: { q: normalized } });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hs">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">handle sniper</span>
        </div>

        <header className="hs-hd">
          <h1>handle sniper<span className="dot">.</span></h1>
          <p className="sub">
            check bluesky handle availability at a glance. uses <code>resolveHandle</code> — 404 means
            nobody has it. we also fan out to popular suffixes so you can see which variants are free.
          </p>
        </header>

        <form className="hs-input-row" onSubmit={onSubmit}>
          <div className="hs-prompt">@</div>
          <input
            className="hs-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle.bsky.social"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="hs-btn" type="submit" disabled={!normalized}>check</button>
        </form>

        {checked.length > 0 ? (
          <section className="hs-list">
            {checked.map((h) => (
              <HandleRow key={h} handle={h} />
            ))}
          </section>
        ) : null}
      </main>
    </>
  );
}

function HandleRow({ handle }: { handle: string }) {
  const valid = isValidHandle(handle);
  const { data, isPending } = useQuery<ResolveResult>({
    queryKey: ['resolve', handle],
    queryFn: () => resolveHandle(handle),
    enabled: valid,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const taken = data && 'did' in data;
  const free = data && 'notFound' in data && data.notFound;

  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['hs-profile', handle],
    queryFn: () => fetchProfile(handle),
    enabled: taken === true,
    staleTime: 1000 * 60 * 10,
  });

  let state: 'free' | 'taken' | 'invalid' | 'checking' | 'error' =
    !valid ? 'invalid' : isPending ? 'checking' : free ? 'free' : taken ? 'taken' : 'error';

  return (
    <article className={`hs-row hs-${state}`}>
      <div className="hs-row-l">
        <span className={`hs-dot hs-dot-${state}`} />
        <div className="hs-row-name">
          <span className="hs-at">@</span>{handle}
        </div>
        <span className={`hs-status hs-status-${state}`}>
          {state === 'free' ? '✓ available' :
            state === 'taken' ? '✗ taken' :
              state === 'invalid' ? 'invalid handle' :
                state === 'checking' ? 'checking…' : 'error'}
        </span>
      </div>
      {taken && profile ? (
        <div className="hs-row-r">
          {profile.avatar ? <img src={profile.avatar} alt="" className="hs-avatar" /> : <div className="hs-avatar hs-avatar-fallback" />}
          <div className="hs-row-meta">
            <div className="hs-display">{profile.displayName || profile.handle}</div>
            <div className="hs-did">{profile.did}</div>
          </div>
          <a
            className="hs-view"
            href={`https://bsky.app/profile/${profile.handle}`}
            target="_blank"
            rel="noopener noreferrer"
          >view ↗</a>
        </div>
      ) : state === 'free' ? (
        <div className="hs-row-r">
          <a
            className="hs-view grab"
            href={`https://bsky.app/settings/account/handle`}
            target="_blank"
            rel="noopener noreferrer"
          >grab it ↗</a>
        </div>
      ) : null}
    </article>
  );
}

const CSS = `
  .shell-hs { max-width: 980px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .hs-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .hs-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .hs-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .hs-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }
  .hs-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .hs-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .hs-prompt {
    padding: 0 var(--sp-4);
    display: flex; align-items: center;
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    color: var(--color-accent);
    text-shadow: 0 0 6px var(--accent-glow);
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-raised);
  }
  .hs-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    padding: var(--sp-3);
  }
  .hs-input::placeholder { color: var(--color-fg-faint); }
  .hs-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .hs-btn:hover { filter: brightness(1.1); }
  .hs-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .hs-list {
    padding: var(--sp-4) 0 var(--sp-10);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hs-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-3);
    align-items: center;
    padding: var(--sp-2) var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    transition: border-color 0.12s;
  }
  .hs-row.hs-free { border-color: var(--color-accent-dim); }
  .hs-row.hs-taken { border-color: var(--color-border); }
  .hs-row.hs-invalid { opacity: 0.6; }
  .hs-row-l {
    display: flex; align-items: center; gap: var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    min-width: 0;
  }
  .hs-dot {
    width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0;
  }
  .hs-dot-free { background: var(--color-accent); box-shadow: 0 0 6px var(--accent-glow); }
  .hs-dot-taken { background: var(--color-fg-faint); }
  .hs-dot-checking { background: var(--color-warn); animation: hs-pulse 1s ease-in-out infinite; }
  .hs-dot-invalid, .hs-dot-error { background: var(--color-alert); }
  @keyframes hs-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .hs-row-name {
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .hs-at { color: var(--color-fg-faint); }

  .hs-status {
    margin-left: auto;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 2px 8px;
    border: 1px solid;
    flex-shrink: 0;
  }
  .hs-status-free {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .hs-status-taken {
    color: var(--color-fg-faint);
    border-color: var(--color-border-bright);
  }
  .hs-status-invalid, .hs-status-error {
    color: var(--color-alert);
    border-color: var(--color-alert-dim);
  }
  .hs-status-checking {
    color: var(--color-warn);
    border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
  }

  .hs-row-r {
    display: flex; align-items: center; gap: var(--sp-3);
    flex-shrink: 0;
  }
  .hs-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--color-bg-raised);
    object-fit: cover;
  }
  .hs-avatar-fallback {
    background: linear-gradient(135deg, var(--color-border-bright), var(--color-bg-raised));
  }
  .hs-row-meta {
    display: flex; flex-direction: column;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    max-width: 180px;
  }
  .hs-display { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hs-did { color: var(--color-fg-faint); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .hs-view {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 3px 9px;
    text-decoration: none;
  }
  .hs-view:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }
  .hs-view.grab {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .hs-view.grab:hover { background: var(--color-accent); color: #000; }

  @media (max-width: 600px) {
    .hs-row { grid-template-columns: 1fr; gap: var(--sp-2); }
    .hs-row-r { justify-content: flex-end; }
  }
`;
