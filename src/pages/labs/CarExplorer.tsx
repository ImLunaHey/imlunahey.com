import { iterateAtpRepo } from '@atcute/car';
import { simpleFetchHandler, XRPC } from '@atcute/client';
import { getPdsEndpoint } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { json } from '@codemirror/lang-json';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import CodeMirror from '@uiw/react-codemirror';
import { jsonSchema } from 'codemirror-json-schema';
import { memo, useRef, useState } from 'react';
import { useLexiconSchema } from '../../hooks/use-lexicon-schema';

// ─── resolvers (module-scope: only one instance per page) ──────────────────

const handleResolver = new CompositeHandleResolver({
  strategy: 'race',
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
    http: new WellKnownHandleResolver(),
  },
});

const docResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

// ─── known lexicons (label chip on the collection list) ────────────────────

const KNOWN_LEXICONS: Record<string, string> = {
  'app.bsky.actor.profile': 'bluesky profile',
  'app.bsky.feed.generator': 'bluesky feed',
  'app.bsky.feed.like': 'bluesky like',
  'app.bsky.feed.post': 'bluesky post',
  'app.bsky.feed.postgate': 'bluesky postgate',
  'app.bsky.feed.repost': 'bluesky repost',
  'app.bsky.feed.threadgate': 'bluesky threadgate',
  'app.bsky.graph.block': 'bluesky block',
  'app.bsky.graph.follow': 'bluesky follow',
  'app.bsky.graph.list': 'bluesky list',
  'app.bsky.graph.listblock': 'bluesky listblock',
  'app.bsky.graph.listitem': 'bluesky list item',
  'app.bsky.graph.starterpack': 'bluesky starterpack',
  'app.bsky.graph.verification': 'bluesky verification',
  'app.popsky.comment': 'popsky review comment',
  'app.popsky.like': 'popsky like',
  'app.popsky.list': 'popsky list',
  'app.popsky.listItem': 'popsky list item',
  'app.popsky.review': 'popsky review',
  'blue.badge.collection': 'atproto.camp badges',
  'blue.flashes.actor.profile': 'flashes.blue profile',
  'chat.bsky.actor.declaration': 'bluesky chat prefs',
  'com.imlunahey.pdf': 'pdf uploader record',
  'com.whtwnd.blog.entry': 'whtwnd blog entry',
  'place.stream.chat.message': 'place.stream chat',
  'place.stream.chat.profile': 'place.stream profile',
  'place.stream.key': 'place.stream key',
  'place.stream.livestream': 'place.stream livestream',
  'sh.tangled.repo': 'tangled.sh repo',
  'sh.tangled.repo.issue': 'tangled.sh issue',
  'social.popfeed.feed.review': 'popfeed review',
};

// ─── data fetch ────────────────────────────────────────────────────────────

type CarData = Record<string, { rkey: string; record: unknown }[]>;
type FetchProgress = { percent: number; received: number; total: number; indeterminate: boolean };

function useCar(handle: string | null) {
  const [progress, setProgress] = useState<FetchProgress>({
    percent: 0,
    received: 0,
    total: 0,
    indeterminate: false,
  });

  const didQuery = useQuery({
    queryKey: ['car-explorer', 'did', handle],
    queryFn: async () => {
      if (!handle) throw new Error('no handle provided');
      // accept a bare did too
      if (handle.startsWith('did:')) return handle;
      return await handleResolver.resolve(handle as `${string}.${string}`);
    },
    enabled: !!handle,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const did = didQuery.data;

  const carQuery = useQuery<CarData>({
    queryKey: ['car-explorer', 'repo', did],
    queryFn: async () => {
      if (!did) throw new Error('no did');
      if (!did.startsWith('did:plc:') && !did.startsWith('did:web:')) {
        throw new Error(`unsupported did method: ${did}`);
      }
      const doc = await docResolver.resolve(did as `did:plc:${string}` | `did:web:${string}`);
      if (!doc) throw new Error('no did document');
      const pdsUrl = getPdsEndpoint(doc);
      if (!pdsUrl) throw new Error('no pds endpoint in did document');

      const trackedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        setProgress({ percent: 0, received: 0, total: 0, indeterminate: false });
        const res = await fetch(input, init);
        if (!res.ok || !res.body) return res;

        const totalHeader = res.headers.get('Content-Length');
        const total = totalHeader ? parseInt(totalHeader, 10) : 0;
        const indeterminate = !total || Number.isNaN(total);
        setProgress((p) => ({ ...p, total, indeterminate }));

        const reader = res.body.getReader();
        const stream = new ReadableStream({
          async start(controller) {
            let received = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              received += value.length;
              const percent = indeterminate ? Math.min(Math.floor((received / 1_000_000) * 10), 90) : Math.min(Math.round((received / total) * 100), 100);
              setProgress({ percent, received, total, indeterminate });
              controller.enqueue(value);
            }
          },
        });
        return new Response(stream, { status: res.status, statusText: res.statusText, headers: res.headers });
      };

      const rpc = new XRPC({ handler: simpleFetchHandler({ service: pdsUrl, fetch: trackedFetch }) });
      const { data } = await rpc.get('com.atproto.sync.getRepo', { params: { did: did as `did:${string}:${string}` } });

      const out: CarData = {};
      for (const { collection, rkey, record } of iterateAtpRepo(data)) {
        (out[collection] ||= []).push({ rkey, record });
      }
      return out;
    },
    enabled: !!did,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    did,
    data: carQuery.data,
    isLoading: didQuery.isLoading || carQuery.isLoading,
    error: didQuery.error ?? carQuery.error,
    progress,
  };
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function CarExplorerPage() {
  const rawParams = useParams({ strict: false }) as { _splat?: string };
  const [splatHandle, splatCollection] = (rawParams._splat ?? '').split('/');
  const handle = splatHandle || null;
  const collection = splatCollection || null;
  const navigate = useNavigate();

  const [input, setInput] = useState(handle ?? '');
  const { did, data, isLoading, error, progress } = useCar(handle);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = input.trim().replace(/^@/, '');
    if (!val) return;
    navigate({ to: `/labs/car-explorer/${val}` as never });
  };

  const download = () => {
    if (!data || !handle) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${handle}-car-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  };

  const collections = data ? Object.keys(data).sort() : [];
  const totalRecords = data ? Object.values(data).reduce((sum, r) => sum + r.length, 0) : 0;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-car">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          {handle ? (
            <>
              <Link to={`/labs/car-explorer/${handle}` as never}>car-explorer</Link>
              <span className="sep">/</span>
              <span className={collection ? '' : 'last'}>{handle}</span>
            </>
          ) : (
            <span className="last">car-explorer</span>
          )}
          {collection ? (
            <>
              <span className="sep">/</span>
              <span className="last">{collection}</span>
            </>
          ) : null}
        </div>

        <header className="car-hd">
          <h1>
            car explorer<span className="dot">.</span>
          </h1>
          <p className="sub">
            browse any atproto repo end-to-end. resolves the handle → did → pds, downloads the full car archive via{' '}
            <code className="inline">com.atproto.sync.getRepo</code>, parses it with{' '}
            <code className="inline">@atcute/car</code>, then groups records by collection.
          </p>

          <form onSubmit={onSubmit} className="car-form">
            <input
              className="car-input"
              type="text"
              placeholder="handle or did (e.g. imlunahey.com)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="car-go" disabled={!input.trim()}>
              explore →
            </button>
            {data && handle ? (
              <button type="button" className="car-dl" onClick={download} title="download repo as json">
                ↓ json
              </button>
            ) : null}
          </form>

          {handle ? (
            <div className="car-meta">
              <span>
                handle <b>{handle}</b>
              </span>
              {did ? (
                <span>
                  did <b>{did}</b>
                </span>
              ) : null}
              {data ? (
                <span>
                  records <b>{totalRecords.toLocaleString()}</b>
                </span>
              ) : null}
              {data ? (
                <span>
                  collections <b>{collections.length}</b>
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {isLoading ? <ProgressPanel progress={progress} /> : null}

        {error ? (
          <section className="err">
            <div className="err-hd">// error</div>
            <div className="err-body">{error instanceof Error ? error.message : String(error)}</div>
          </section>
        ) : null}

        {!handle ? (
          <section className="empty">
            <div className="empty-glyph">▯</div>
            <div className="empty-ttl">enter a handle or did to start</div>
            <div className="empty-sub">try imlunahey.com or did:plc:k6acu4chiwkixvdedcmdgmal</div>
          </section>
        ) : null}

        {data && !collection ? <CollectionList handle={handle!} data={data} /> : null}

        {data && collection && data[collection] ? (
          <RecordList handle={handle!} collection={collection} items={data[collection]} />
        ) : null}

        {data && collection && !data[collection] ? (
          <section className="empty">
            <div className="empty-glyph">◌</div>
            <div className="empty-ttl">no records in this collection</div>
            <div className="empty-sub">
              <Link to={`/labs/car-explorer/${handle}` as never} className="t-accent">
                ← back to collections
              </Link>
            </div>
          </section>
        ) : null}

        <footer className="car-footer">
          <span>
            src: <span className="t-accent">com.atproto.sync.getRepo · @atcute/car · json-schema</span>
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

// ─── progress ──────────────────────────────────────────────────────────────

function ProgressPanel({ progress }: { progress: FetchProgress }) {
  const mb = (b: number) => (b / 1024 / 1024).toFixed(2);
  return (
    <section className="prog">
      <div className="prog-line">
        <span className="prog-lbl">
          {progress.indeterminate ? 'downloading repo…' : `downloading repo · ${progress.percent}%`}
        </span>
        <span className="prog-val">
          {mb(progress.received)} mb{!progress.indeterminate && progress.total > 0 ? ` / ${mb(progress.total)} mb` : ''}
        </span>
      </div>
      <div className="prog-bar">
        {progress.indeterminate ? (
          <div className="prog-bar-indeterminate" />
        ) : (
          <div className="prog-bar-fill" style={{ width: `${progress.percent}%` }} />
        )}
      </div>
    </section>
  );
}

// ─── collections list ──────────────────────────────────────────────────────

function CollectionList({ handle, data }: { handle: string; data: CarData }) {
  const collections = Object.keys(data).sort();
  return (
    <section className="cols">
      <div className="cols-hd">
        <span className="cols-ttl">// collections</span>
        <span className="cols-meta">{collections.length} nsid</span>
      </div>
      {collections.map((nsid) => {
        const count = data[nsid].length;
        const label = KNOWN_LEXICONS[nsid];
        return (
          <Link key={nsid} to={`/labs/car-explorer/${handle}/${nsid}` as never} className="col-row">
            <span className="col-nsid">{nsid}</span>
            <span className="col-lbl">{label ?? <span className="t-faint">unknown lexicon</span>}</span>
            <span className="col-count">{count.toLocaleString()}</span>
            <span className="col-go">→</span>
          </Link>
        );
      })}
    </section>
  );
}

// ─── record list (virtualised) ─────────────────────────────────────────────

function RecordList({
  handle,
  collection,
  items,
}: {
  handle: string;
  collection: string;
  items: { rkey: string; record: unknown }[];
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(items.length === 1 ? 0 : null);

  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (openIdx === i ? 440 : 52),
    overscan: 6,
    gap: 6,
  });

  return (
    <section className="recs">
      <div className="recs-hd">
        <Link to={`/labs/car-explorer/${handle}` as never} className="recs-back">
          ← collections
        </Link>
        <span className="recs-nsid">{collection}</span>
        <span className="recs-count">
          {items.length} record{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="recs-scroll" ref={parentRef}>
        <div className="recs-inner" style={{ height: `${virt.getTotalSize()}px` }}>
          {virt.getVirtualItems().map((v) => {
            const item = items[v.index];
            return (
              <div
                key={v.key}
                className="rec"
                data-index={v.index}
                ref={virt.measureElement}
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <Record
                  rkey={item.rkey}
                  record={item.record}
                  open={openIdx === v.index}
                  onToggle={() => setOpenIdx((cur) => (cur === v.index ? null : v.index))}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const Record = memo(function Record({
  rkey,
  record,
  open,
  onToggle,
}: {
  rkey: string;
  record: unknown;
  open: boolean;
  onToggle: () => void;
}) {
  const $type =
    record && typeof record === 'object' && record !== null && '$type' in record && typeof record.$type === 'string'
      ? record.$type
      : undefined;
  const { data: schema } = useLexiconSchema($type);

  return (
    <div className={'rec-card' + (open ? ' open' : '')}>
      <button type="button" className="rec-hd" onClick={onToggle}>
        <span className="rec-caret">{open ? '▾' : '▸'}</span>
        <span className="rec-rkey">{rkey}</span>
        <span className="rec-type">{$type ?? <span className="t-faint">(no $type)</span>}</span>
      </button>
      {open ? (
        <div className="rec-body">
          <CodeMirror
            value={JSON.stringify(record, null, 2)}
            extensions={[json(), jsonSchema(schema ?? { type: 'object' })]}
            theme={tokyoNight}
            readOnly
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
          />
        </div>
      ) : null}
    </div>
  );
});

// ─── styles ────────────────────────────────────────────────────────────────

const CSS = `
  .shell-car { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .car-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .car-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .car-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .car-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .car-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .car-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
  .car-input {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .car-input:focus { outline: none; border-color: var(--color-accent-dim); }
  .car-input::placeholder { color: var(--color-fg-ghost); }
  .car-go, .car-dl {
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
  .car-go:hover:not(:disabled), .car-dl:hover {
    background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel));
  }
  .car-go:disabled { opacity: 0.4; cursor: not-allowed; }
  .car-dl {
    border-color: var(--color-border-bright);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
  }
  .car-dl:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .car-meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .car-meta b { color: var(--color-fg); font-weight: 400; word-break: break-all; }

  /* progress */
  .prog {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .prog-line { display: flex; justify-content: space-between; color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
  .prog-val { color: var(--color-fg-dim); }
  .prog-bar { height: 4px; background: var(--color-border); overflow: hidden; }
  .prog-bar-fill { height: 100%; background: var(--color-accent); box-shadow: 0 0 6px var(--accent-glow); transition: width 0.15s linear; }
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

  /* error */
  .err {
    margin-top: var(--sp-6);
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
  .err-body { padding: var(--sp-4) var(--sp-5); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  /* empty */
  .empty {
    margin-top: var(--sp-8);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); word-break: break-all; }

  /* collections list */
  .cols { margin-top: var(--sp-6); }
  .cols-hd {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: var(--sp-3);
    margin-bottom: var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .cols-ttl { color: var(--color-accent); letter-spacing: 0.08em; text-transform: uppercase; }
  .cols-meta { color: var(--color-fg-faint); }

  .col-row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 2fr) auto auto;
    gap: var(--sp-4);
    align-items: baseline;
    padding: 10px var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
    text-decoration: none;
    color: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .col-row:hover { background: var(--color-bg-raised); text-decoration: none; }
  .col-row:hover .col-nsid { color: var(--color-accent); }
  .col-row:hover .col-go { color: var(--color-accent); transform: translateX(3px); }
  .col-nsid { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .col-lbl { color: var(--color-fg-faint); font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .col-count {
    color: var(--color-accent);
    font-family: var(--font-mono);
    min-width: 50px;
    text-align: right;
  }
  .col-go { color: var(--color-fg-faint); transition: transform 0.12s, color 0.12s; }

  /* records list */
  .recs { margin-top: var(--sp-6); }
  .recs-hd {
    display: flex; align-items: baseline; gap: var(--sp-4);
    padding-bottom: var(--sp-3);
    margin-bottom: var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .recs-back { color: var(--color-fg-faint); text-decoration: none; }
  .recs-back:hover { color: var(--color-accent); text-decoration: none; }
  .recs-nsid { color: var(--color-accent); }
  .recs-count { margin-left: auto; color: var(--color-fg-faint); }

  .recs-scroll { height: calc(100dvh - 320px); min-height: 400px; overflow: auto; border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .recs-inner { position: relative; width: 100%; }
  .rec { position: absolute; top: 0; left: 0; right: 0; }

  .rec-card {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    margin: 3px var(--sp-3);
  }
  .rec-card.open { border-color: var(--color-accent-dim); background: var(--color-bg-raised); }
  .rec-hd {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%;
    border: 0;
    background: transparent;
    padding: var(--sp-3) var(--sp-4);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-align: left;
  }
  .rec-hd:hover { background: var(--color-bg-raised); }
  .rec-caret { color: var(--color-accent); width: 12px; flex-shrink: 0; }
  .rec-rkey { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .rec-type { color: var(--color-fg-faint); font-size: var(--fs-xs); white-space: nowrap; }
  .rec-body { border-top: 1px solid var(--color-border); }
  .rec-body .cm-editor { font-size: 12px; }
  .rec-body .cm-scroller { max-height: 380px; }

  .car-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 640px) {
    .col-row { grid-template-columns: 1fr auto; }
    .col-lbl { grid-column: 1 / -1; }
  }
`;
