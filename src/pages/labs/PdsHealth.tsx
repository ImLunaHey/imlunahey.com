import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
};

async function probe(url: string): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const ms = Math.round(performance.now() - t0);
    let body: unknown;
    let error: string | undefined;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      try { body = await res.json(); } catch { /* malformed json */ }
    } else if (res.ok) {
      // 200 OK but non-JSON — usually the host's SPA fallthrough
      // (deer.social, AppView clients). Treat as a soft failure
      // since /xrpc isn't actually being served.
      error = `non-json response (${ct || 'no content-type'}) — not a pds endpoint`;
    }
    return { ok: res.ok && !error, status: res.status, ms, body, error };
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    return { ok: false, status: 0, ms, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}

type DescribeServer = {
  did?: string;
  availableUserDomains?: string[];
  inviteCodeRequired?: boolean;
  phoneVerificationRequired?: boolean;
  links?: { privacyPolicy?: string; termsOfService?: string };
  contact?: { email?: string };
};

type ServerVersion = { version?: string };

type HealthPayload = { describe: ProbeResult; version: ProbeResult; listRepos: ProbeResult };

// listRepos shape — paginated by cursor. Walked end-to-end gives every
// account hosted on the PDS. bsky.social has tens of millions, so we
// page on demand and let the user opt into "load all" with a stop.
type Repo = {
  did: string;
  head?: string;
  rev?: string;
  active?: boolean;
  status?: string;
};
type ListReposPage = { repos?: Repo[]; cursor?: string };
const REPOS_PAGE_SIZE = 1000;

function normalizePds(input: string): string {
  let u = input.trim();
  if (!u) return '';
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  u = u.replace(/\/$/, '');
  return u;
}

async function runHealth(pds: string): Promise<HealthPayload> {
  const describe = probe(`${pds}/xrpc/com.atproto.server.describeServer`);
  const version = probe(`${pds}/xrpc/_health`);
  const listRepos = probe(`${pds}/xrpc/com.atproto.sync.listRepos?limit=1`);
  const [d, v, l] = await Promise.all([describe, version, listRepos]);
  return { describe: d, version: v, listRepos: l };
}

function healthVerdict(h: HealthPayload | undefined): { label: string; kind: 'ok' | 'warn' | 'down' } {
  if (!h) return { label: 'checking…', kind: 'warn' };
  const okCount = [h.describe, h.version, h.listRepos].filter((r) => r.ok).length;
  if (okCount === 3) return { label: 'ok', kind: 'ok' };
  if (okCount === 0) return { label: 'down', kind: 'down' };
  return { label: 'degraded', kind: 'warn' };
}

// Community PDSes that also host user handles under the same domain.
// Verified to serve /xrpc — apex-domain AppView clients (deer.social,
// gndr.social) were dropped because they proxy /xrpc to the SPA's
// HTML fallback.
const SUGGESTIONS = [
  'https://bsky.social',
  'https://blacksky.app',
];

export default function PdsHealthPage() {
  const search = useSearch({ strict: false }) as { url?: string };
  const navigate = useNavigate();
  const initial = search.url ? normalizePds(search.url) : 'https://bsky.social';
  const [input, setInput] = useState(initial);
  const submitted = search.url ? normalizePds(search.url) : null;

  useEffect(() => {
    if (search.url) setInput(normalizePds(search.url));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.url]);

  const submit = (v: string) => {
    const n = normalizePds(v);
    if (n) navigate({ to: '/labs/pds-health', search: { url: n } });
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['pds-health', submitted],
    queryFn: () => runHealth(submitted!),
    enabled: !!submitted,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const verdict = useMemo(() => healthVerdict(data), [data]);
  const describe = data?.describe.body as DescribeServer | undefined;
  const healthBody = data?.version.body as ServerVersion | undefined;

  // — accounts browser — paginated com.atproto.sync.listRepos —
  // resets to empty whenever the user points at a new PDS, then
  // loads pages on demand. abortRef lets the stop button cancel an
  // in-flight page mid-walk.
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposCursor, setReposCursor] = useState<string | null>(null);
  const [reposHasMore, setReposHasMore] = useState(true);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposAutoLoad, setReposAutoLoad] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [reposFilter, setReposFilter] = useState('');
  const reposAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRepos([]);
    setReposCursor(null);
    setReposHasMore(true);
    setReposError(null);
    setReposAutoLoad(false);
    reposAbortRef.current?.abort();
    return () => reposAbortRef.current?.abort();
  }, [submitted]);

  const loadReposPage = useCallback(async () => {
    if (!submitted || reposLoading || !reposHasMore) return;
    setReposLoading(true);
    setReposError(null);
    const ctl = new AbortController();
    reposAbortRef.current = ctl;
    try {
      const url = new URL(`${submitted}/xrpc/com.atproto.sync.listRepos`);
      url.searchParams.set('limit', String(REPOS_PAGE_SIZE));
      if (reposCursor) url.searchParams.set('cursor', reposCursor);
      const res = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      // Some hosts (deer.social, AppView clients) live at the apex
      // and proxy unmatched paths to a SPA — listRepos returns the
      // HTML home instead of XRPC JSON. Detect that explicitly so
      // the error message says something useful instead of a raw
      // JSON.parse exception.
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json')) {
        throw new Error(
          `endpoint returned ${ct || 'no content-type'} — this host is probably not a PDS (no /xrpc handler)`,
        );
      }
      const body = (await res.json()) as ListReposPage;
      const next = body.repos ?? [];
      setRepos((prev) => prev.concat(next));
      if (body.cursor && next.length > 0) {
        setReposCursor(body.cursor);
      } else {
        setReposCursor(null);
        setReposHasMore(false);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setReposError((err as Error).message);
      setReposHasMore(false);
    } finally {
      setReposLoading(false);
    }
  }, [submitted, reposCursor, reposLoading, reposHasMore]);

  // Auto-load chains pages while the user wants "load all".
  useEffect(() => {
    if (reposAutoLoad && !reposLoading && reposHasMore) {
      loadReposPage();
    }
  }, [reposAutoLoad, reposLoading, reposHasMore, loadReposPage]);

  // First page on submit (or refetch) so the count strip populates
  // without an extra click.
  useEffect(() => {
    if (
      submitted
      && repos.length === 0
      && reposHasMore
      && !reposLoading
      && !reposError
      && data?.listRepos.ok
    ) {
      loadReposPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, data?.listRepos.ok]);

  const stopRepos = () => {
    reposAbortRef.current?.abort();
    setReposAutoLoad(false);
    setReposLoading(false);
  };

  const reposStats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const r of repos) {
      if (r.active === false) inactive++;
      else active++;
    }
    return { total: repos.length, active, inactive };
  }, [repos]);

  // Handle resolution — `describeRepo` on the PDS itself returns
  // { handle, did, didDoc } for any account it hosts. Lazy lookups
  // for visible rows only, capped concurrency so we don't fire
  // hundreds of fetches in parallel on PDSes with thousands of users.
  // Map values: string = resolved handle, null = unresolved/error,
  // 'loading' = in flight.
  const [handleCache, setHandleCache] = useState<Map<string, string | null | 'loading'>>(
    () => new Map(),
  );
  // Mirror of the cache for read-only access inside effects — avoids
  // making handleCache a dep (which would cycle since the effect
  // mutates it).
  const handleCacheRef = useRef(handleCache);
  handleCacheRef.current = handleCache;

  // Reset the cache whenever we point at a new PDS — handles are PDS-
  // local so they don't carry over.
  useEffect(() => {
    setHandleCache(new Map());
  }, [submitted]);

  const reposVisible = useMemo(() => {
    if (!reposFilter.trim()) return repos;
    const q = reposFilter.trim().toLowerCase();
    return repos.filter((r) => {
      if (r.did.toLowerCase().includes(q)) return true;
      const h = handleCache.get(r.did);
      return typeof h === 'string' && h.toLowerCase().includes(q);
    });
  }, [repos, reposFilter, handleCache]);

  // Fire describeRepo lookups for visible DIDs that haven't been
  // resolved yet. Cap to MAX_RESOLVE so a load-all on bsky.social
  // doesn't queue 30M fetches — users can refine the filter to
  // resolve a different slice. We only re-fire when reposVisible
  // changes — handle cache reads happen via ref to avoid a loop.
  useEffect(() => {
    if (!submitted) return;
    const MAX_RESOLVE = 300;
    const MAX_CONCURRENT = 8;

    const cache = handleCacheRef.current;
    const targets: string[] = [];
    for (let i = 0; i < reposVisible.length && targets.length < MAX_RESOLVE; i++) {
      const did = reposVisible[i].did;
      if (cache.has(did)) continue;
      targets.push(did);
    }
    if (targets.length === 0) return;

    // Mark all targets as loading in one batched setState before
    // kicking off fetches.
    setHandleCache((prev) => {
      const next = new Map(prev);
      for (const did of targets) {
        if (!next.has(did)) next.set(did, 'loading');
      }
      return next;
    });

    let cancelled = false;
    let i = 0;
    const resolveOne = async (did: string) => {
      try {
        const url = new URL(`${submitted}/xrpc/com.atproto.repo.describeRepo`);
        url.searchParams.set('repo', did);
        const res = await fetch(url.toString(), {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { handle?: string };
        if (cancelled) return;
        setHandleCache((prev) => {
          const next = new Map(prev);
          next.set(did, typeof body.handle === 'string' ? body.handle : null);
          return next;
        });
      } catch {
        if (cancelled) return;
        setHandleCache((prev) => {
          const next = new Map(prev);
          next.set(did, null);
          return next;
        });
      }
    };
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, targets.length) }, async () => {
      while (!cancelled && i < targets.length) {
        await resolveOne(targets[i++]);
      }
    });
    Promise.all(workers).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [submitted, reposVisible]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(input);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ph">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">pds health</span>
        </div>

        <header className="ph-hd">
          <h1>pds health<span className="dot">.</span></h1>
          <p className="sub">
            probe + inspect any atproto personal data server — health endpoints, operator metadata, and
            the full account roster paginated from <code>com.atproto.sync.listRepos</code>.
          </p>
        </header>

        <form className="ph-input-row" onSubmit={onSubmit}>
          <input
            className="ph-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://bsky.social"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="ph-btn" type="submit" disabled={isFetching}>
            {isFetching ? 'probing…' : 'probe'}
          </button>
        </form>

        <div className="ph-suggest">
          <span className="ph-suggest-lbl">try</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ph-chip" onClick={() => submit(s)}>
              {s.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>

        {!submitted ? null : (
          <div className="ph-result">
            <header className="ph-verdict">
              <div className={`ph-badge v-${verdict.kind}`}>
                <span className={`ph-light l-${verdict.kind}`} />
                <span>{verdict.label}</span>
              </div>
              <code className="ph-host">{submitted}</code>
              <button className="ph-refresh" onClick={() => refetch()} disabled={isFetching}>↻ refresh</button>
            </header>

            <section className="ph-probes">
              <ProbeCard name="describeServer" path="/xrpc/com.atproto.server.describeServer" result={data?.describe} />
              <ProbeCard name="health" path="/xrpc/_health" result={data?.version} />
              <ProbeCard name="listRepos" path="/xrpc/com.atproto.sync.listRepos" result={data?.listRepos} />
            </section>

            {describe || healthBody ? (
              <section className="ph-detail">
                <div className="ph-detail-hd">── server metadata</div>
                <div className="ph-kv">
                  {healthBody?.version ? <Row k="version" v={healthBody.version} /> : null}
                  {describe?.did ? <Row k="service did" v={describe.did} mono /> : null}
                  {describe?.availableUserDomains ? (
                    <Row
                      k="user domains"
                      v={describe.availableUserDomains.length ? describe.availableUserDomains.join(', ') : '—'}
                    />
                  ) : null}
                  {describe?.inviteCodeRequired !== undefined ? (
                    <Row k="invite required" v={describe.inviteCodeRequired ? 'yes' : 'no'} />
                  ) : null}
                  {describe?.phoneVerificationRequired !== undefined ? (
                    <Row k="phone required" v={describe.phoneVerificationRequired ? 'yes' : 'no'} />
                  ) : null}
                  {describe?.contact?.email ? <Row k="contact" v={describe.contact.email} /> : null}
                  {describe?.links?.privacyPolicy ? (
                    <Row k="privacy"  v={<a href={describe.links.privacyPolicy} target="_blank" rel="noopener noreferrer">{describe.links.privacyPolicy}</a>} />
                  ) : null}
                  {describe?.links?.termsOfService ? (
                    <Row k="terms" v={<a href={describe.links.termsOfService} target="_blank" rel="noopener noreferrer">{describe.links.termsOfService}</a>} />
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="ph-detail">
              <div className="ph-detail-hd">── accounts</div>
              <div className="ph-acct-counts">
                <div className="ph-acct-count">
                  <div className="ph-acct-v">{reposStats.total.toLocaleString()}</div>
                  <div className="ph-acct-k">loaded</div>
                </div>
                <div className="ph-acct-count">
                  <div className="ph-acct-v">{reposStats.active.toLocaleString()}</div>
                  <div className="ph-acct-k">active</div>
                </div>
                <div className="ph-acct-count">
                  <div className="ph-acct-v">{reposStats.inactive.toLocaleString()}</div>
                  <div className="ph-acct-k">deactivated</div>
                </div>
                <div className="ph-acct-count">
                  <div className="ph-acct-v">
                    {reposHasMore ? (reposLoading ? '…' : 'more') : 'done'}
                  </div>
                  <div className="ph-acct-k">{reposCursor ? 'cursor pending' : 'pagination'}</div>
                </div>
              </div>

              <div className="ph-acct-controls">
                {reposHasMore ? (
                  reposAutoLoad || reposLoading ? (
                    <button className="ph-acct-ctl" onClick={stopRepos}>◾ stop</button>
                  ) : (
                    <>
                      <button className="ph-acct-ctl" onClick={loadReposPage}>
                        load next {REPOS_PAGE_SIZE.toLocaleString()}
                      </button>
                      <button
                        className="ph-acct-ctl danger"
                        onClick={() => setReposAutoLoad(true)}
                        title="walk every cursor — slow on large PDSes"
                      >
                        load all
                      </button>
                    </>
                  )
                ) : null}
                <input
                  className="ph-acct-filter"
                  value={reposFilter}
                  onChange={(e) => setReposFilter(e.target.value)}
                  placeholder="filter by did or handle…"
                  spellCheck={false}
                />
                {reposError ? <span className="ph-err-msg">{reposError}</span> : null}
              </div>

              {repos.length > 0 ? (
                <div className="ph-acct-table">
                  <header className="ph-acct-row ph-acct-row-hd">
                    <div className="ph-c-id">handle / did</div>
                    <div className="ph-c-rev">rev</div>
                    <div className="ph-c-state">state</div>
                    <div className="ph-c-link">view</div>
                  </header>
                  {reposVisible.slice(0, 1000).map((r) => (
                    <RepoRow
                      key={r.did}
                      pds={submitted!}
                      repo={r}
                      handle={handleCache.get(r.did)}
                    />
                  ))}
                  {reposVisible.length > 1000 ? (
                    <div className="ph-acct-truncated">
                      showing first 1,000 of {reposVisible.length.toLocaleString()} matches — refine the filter
                    </div>
                  ) : null}
                  {reposVisible.length === 0 ? (
                    <div className="ph-acct-truncated">no matches for "{reposFilter}"</div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ph-row">
      <div className="ph-row-k">{k}</div>
      <div className={`ph-row-v ${mono ? 'mono' : ''}`}>{v}</div>
    </div>
  );
}

function RepoRow({
  pds,
  repo,
  handle,
}: {
  pds: string;
  repo: Repo;
  handle: string | null | 'loading' | undefined;
}) {
  const active = repo.active !== false;
  // Handle column states: undefined = not yet queued, 'loading' = in
  // flight, null = resolution failed (handle field missing or
  // describeRepo returned non-2xx), string = resolved.
  const handleNode =
    handle === 'loading' ? <span className="t-faint">resolving…</span>
    : handle == null ? <span className="t-faint">—</span>
    : (
      <a
        href={`https://bsky.app/profile/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ph-acct-handle"
      >
        @{handle}
      </a>
    );
  return (
    <div className={`ph-acct-row ${active ? '' : 'inactive'}`}>
      <div className="ph-c-id">
        <div className="ph-c-handle">{handleNode}</div>
        <div className="ph-c-did mono t-faint">{repo.did}</div>
      </div>
      <div className="ph-c-rev mono t-faint">{repo.rev?.slice(0, 12) ?? '—'}</div>
      <div className="ph-c-state">
        <span className={`ph-acct-state s-${active ? 'ok' : 'off'}`}>
          {active ? 'active' : (repo.status ?? 'inactive')}
        </span>
      </div>
      <div className="ph-c-link">
        <Link to="/labs/did-log" search={{ actor: repo.did }} className="ph-acct-link">
          did log →
        </Link>
        <a
          href={`${pds}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(repo.did)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ph-acct-link"
        >
          describe →
        </a>
      </div>
    </div>
  );
}

function ProbeCard({ name, path, result }: { name: string; path: string; result?: ProbeResult }) {
  const ok = result?.ok;
  const fast = (result?.ms ?? 9999) < 300;
  const medium = (result?.ms ?? 9999) < 900;
  return (
    <article className={`ph-probe ${ok === true ? 'ok' : ok === false ? 'fail' : ''}`}>
      <header className="ph-probe-hd">
        <span className={`ph-light l-${ok === true ? 'ok' : ok === false ? 'down' : 'warn'}`} />
        <span className="ph-probe-name">{name}</span>
        <span className={`ph-probe-status ${ok ? 's-ok' : 's-fail'}`}>
          {result ? (result.status > 0 ? result.status : 'err') : '…'}
        </span>
      </header>
      <div className="ph-probe-path">{path}</div>
      <div className="ph-probe-metrics">
        <span className={`ph-ms ${fast ? 'fast' : medium ? 'med' : 'slow'}`}>
          {result ? `${result.ms}ms` : '…'}
        </span>
        {result?.error ? <span className="ph-err-msg">{result.error}</span> : null}
      </div>
    </article>
  );
}

const CSS = `
  .shell-ph { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .ph-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .ph-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .ph-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ph-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .ph-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .ph-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: var(--sp-3);
  }
  .ph-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .ph-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .ph-suggest {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin: var(--sp-3) 0 var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .ph-suggest-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .ph-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
  }
  .ph-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ph-verdict {
    display: flex; align-items: center; gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    flex-wrap: wrap;
  }
  .ph-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: var(--sp-2) var(--sp-4);
    border: 1px solid;
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    font-weight: 500;
    text-transform: lowercase;
  }
  .ph-badge.v-ok { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .ph-badge.v-warn { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); background: color-mix(in oklch, var(--color-warn) 6%, transparent); }
  .ph-badge.v-down { color: var(--color-alert); border-color: var(--color-alert-dim); background: color-mix(in srgb, var(--color-alert) 6%, transparent); }

  .ph-light {
    width: 10px; height: 10px; border-radius: 50%;
    display: inline-block;
  }
  .ph-light.l-ok { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .ph-light.l-warn { background: var(--color-warn); animation: ph-pulse 1.4s ease-in-out infinite; }
  .ph-light.l-down { background: var(--color-alert); }
  @keyframes ph-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .ph-host {
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ph-refresh {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .ph-refresh:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ph-probes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .ph-probe {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    font-family: var(--font-mono);
  }
  .ph-probe.ok { border-color: var(--color-accent-dim); }
  .ph-probe.fail { border-color: var(--color-alert-dim); }
  .ph-probe-hd {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 4px;
  }
  .ph-probe-name {
    font-size: var(--fs-sm);
    color: var(--color-fg);
    flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ph-probe-status {
    font-size: var(--fs-xs);
    padding: 1px 6px;
    border: 1px solid currentColor;
  }
  .ph-probe-status.s-ok { color: var(--color-accent); }
  .ph-probe-status.s-fail { color: var(--color-alert); }

  .ph-probe-path {
    font-size: 10px;
    color: var(--color-fg-faint);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: var(--sp-2);
  }
  .ph-probe-metrics {
    display: flex; justify-content: space-between;
    font-size: var(--fs-xs);
  }
  .ph-ms {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .ph-ms.fast { color: var(--color-accent); }
  .ph-ms.med { color: var(--color-warn); }
  .ph-ms.slow { color: var(--color-alert); }
  .ph-err-msg {
    color: var(--color-alert);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 150px;
  }

  .ph-detail {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    margin-bottom: var(--sp-10);
  }
  .ph-detail-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }
  .ph-kv {
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .ph-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: var(--sp-3);
    padding: 4px 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .ph-row:last-child { border-bottom: 0; }
  .ph-row-k { color: var(--color-fg-faint); text-transform: lowercase; }
  .ph-row-v { color: var(--color-fg); word-break: break-word; }
  .ph-row-v.mono { font-size: var(--fs-xs); }
  .ph-row-v a { color: var(--color-accent); text-decoration: none; }
  .ph-row-v a:hover { text-decoration: underline; }

  @media (max-width: 600px) {
    .ph-row { grid-template-columns: 1fr; gap: 2px; }
  }

  /* accounts browser — paginated listRepos */
  .ph-acct-counts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-3);
    margin: var(--sp-3) 0;
  }
  .ph-acct-count {
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    padding: var(--sp-3) var(--sp-4);
  }
  .ph-acct-v {
    font-family: var(--font-display);
    font-size: 24px; line-height: 1;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .ph-acct-k {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-top: 6px;
  }
  @media (max-width: 720px) {
    .ph-acct-counts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .ph-acct-controls {
    display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
    margin: var(--sp-3) 0;
  }
  .ph-acct-ctl {
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 6px 12px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    cursor: pointer;
  }
  .ph-acct-ctl:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .ph-acct-ctl.danger:hover { color: var(--color-alert); border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .ph-acct-filter {
    background: var(--color-bg);
    color: var(--color-fg);
    border: 1px solid var(--color-border);
    padding: 6px 10px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    flex: 1; min-width: 200px;
  }

  .ph-acct-table {
    border: 1px solid var(--color-border);
    margin-top: var(--sp-2);
  }
  .ph-acct-row {
    display: grid;
    grid-template-columns: 1fr 100px 90px 180px;
    gap: var(--sp-3);
    align-items: center;
    padding: 8px var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .ph-acct-row:last-child { border-bottom: none; }
  .ph-acct-row.inactive { opacity: 0.5; }
  .ph-acct-row-hd {
    background: var(--color-bg);
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px;
  }
  .ph-c-id {
    display: flex; flex-direction: column; gap: 2px;
    min-width: 0; word-break: break-all;
  }
  .ph-c-handle { font-size: var(--fs-sm); }
  .ph-c-did { word-break: break-all; font-size: 10px; }
  .ph-acct-handle {
    color: var(--color-accent);
    text-decoration: none;
  }
  .ph-acct-handle:hover { text-decoration: underline; }
  .ph-c-link { display: flex; gap: var(--sp-3); justify-content: flex-end; }
  .ph-acct-link {
    color: var(--color-accent);
    text-decoration: none;
    font-size: var(--fs-xs);
  }
  .ph-acct-link:hover { text-decoration: underline; }

  .ph-acct-state {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ph-acct-state.s-ok { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .ph-acct-state.s-off { color: var(--color-fg-faint); border-color: var(--color-border); }

  .ph-acct-truncated {
    padding: var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-align: center;
  }

  @media (max-width: 760px) {
    .ph-acct-row {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .ph-acct-row-hd { display: none; }
    .ph-c-link { justify-content: flex-start; }
  }
`;
