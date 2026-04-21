import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';
import { fetchLexicon } from '../../lib/fetch-lexicon';

type LexiconDoc = {
  $type: string;
  lexicon: number;
  id: string;
  defs: Record<string, Def>;
  description?: string;
};

type Def = {
  type: string;
  description?: string;
  // object / record / params
  required?: string[];
  nullable?: string[];
  properties?: Record<string, Def>;
  // record
  key?: string;
  record?: Def;
  // query / procedure / subscription
  parameters?: Def;
  input?: { encoding?: string; schema?: Def };
  output?: { encoding?: string; schema?: Def };
  errors?: { name: string; description?: string }[];
  // primitives / strings
  enum?: string[];
  knownValues?: string[];
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  const?: unknown;
  // arrays
  items?: Def;
  minItems?: number;
  maxItems?: number;
  // refs
  ref?: string;
  refs?: string[];
  closed?: boolean;
};

export default function LexiconPage() {
  const { nsid: param } = useParams({ strict: false }) as { nsid?: string };
  const nsid = param ?? null;
  const navigate = useNavigate();
  const [input, setInput] = useState(nsid ?? '');

  const query = useQuery({
    queryKey: ['lexicon-browser', nsid],
    queryFn: () => fetchLexicon(nsid!) as Promise<LexiconDoc>,
    enabled: !!nsid,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    navigate({ to: `/labs/lexicon/${val}` as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lex">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          {nsid ? (
            <>
              <Link to="/labs/lexicon">lexicon</Link>
              <span className="sep">/</span>
              <span className="last">{nsid}</span>
            </>
          ) : (
            <span className="last">lexicon</span>
          )}
        </div>

        <header className="lex-hd">
          <h1>
            lexicon<span className="dot">.</span>
          </h1>
          <p className="sub">
            enter any atproto nsid to fetch its schema via the standard lexicon resolution chain — dns{' '}
            <code className="inline">_lexicon.&lt;reversed-nsid&gt;</code> txt for the authoring did, then{' '}
            <code className="inline">com.atproto.lexicon.schema</code> on the authority's pds — and render each
            definition with its properties, params, outputs, and refs typed out.
          </p>
          <form onSubmit={onSubmit} className="lex-form">
            <input
              className="inp"
              type="text"
              placeholder="e.g. app.bsky.feed.post, com.whtwnd.blog.entry, social.popfeed.feed.review"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="go" disabled={!input.trim()}>
              resolve →
            </button>
          </form>
          <div className="samples">
            <span className="t-faint">try</span>
            {['app.bsky.feed.post', 'app.bsky.actor.profile', 'com.whtwnd.blog.entry', 'social.popfeed.feed.review', 'sh.tangled.repo'].map((s) => (
              <Link key={s} to={`/labs/lexicon/${s}` as never} className="sample">
                {s}
              </Link>
            ))}
          </div>
        </header>

        {query.isFetching ? <LoadingPanel label="resolving lexicon…" /> : null}
        {query.error ? <ErrorPanel msg={query.error instanceof Error ? query.error.message : String(query.error)} /> : null}

        {!nsid ? (
          <section className="empty">
            <div className="empty-glyph">▯</div>
            <div className="empty-ttl">enter an nsid to start</div>
          </section>
        ) : null}

        {query.data ? <LexiconView doc={query.data} /> : null}

        <footer className="lex-footer">
          <span>
            src: <span className="t-accent">dns (moz doh) · plc.directory · pds · com.atproto.lexicon.schema</span>
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

function LexiconView({ doc }: { doc: LexiconDoc }) {
  const defNames = Object.keys(doc.defs ?? {});
  // main first, rest alpha
  defNames.sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));

  return (
    <>
      <section className="lex-meta">
        <div className="lex-id">{doc.id}</div>
        {doc.description ? <p className="lex-desc">{doc.description}</p> : null}
        <div className="lex-stats">
          <span>
            lexicon version <b>{doc.lexicon}</b>
          </span>
          <span>
            defs <b>{defNames.length}</b>
          </span>
        </div>
        <nav className="lex-toc">
          {defNames.map((n) => (
            <a key={n} href={`#def-${n}`} className="toc-link">
              <span className={'toc-type toc-' + (doc.defs[n]?.type ?? 'unknown')}>{doc.defs[n]?.type ?? '?'}</span>
              <span className="toc-name">{n}</span>
            </a>
          ))}
        </nav>
      </section>

      <section className="defs">
        {defNames.map((name) => (
          <DefCard key={name} name={name} def={doc.defs[name]} lexiconId={doc.id} />
        ))}
      </section>

      <section className="raw">
        <CodeBlock code={JSON.stringify(doc, null, 2)} filename={`${doc.id}.json`} language="json" />
      </section>
    </>
  );
}

function DefCard({ name, def, lexiconId }: { name: string; def: Def; lexiconId: string }) {
  return (
    <article id={`def-${name}`} className={'def def-' + def.type}>
      <header className="def-hd">
        <span className={'def-type def-type-' + def.type}>{def.type}</span>
        <span className="def-name">{name === 'main' ? lexiconId : `${lexiconId}#${name}`}</span>
      </header>
      {def.description ? <p className="def-desc">{def.description}</p> : null}
      <DefBody def={def} lexiconId={lexiconId} />
    </article>
  );
}

function DefBody({ def, lexiconId }: { def: Def; lexiconId: string }) {
  switch (def.type) {
    case 'record':
      return (
        <>
          {def.key ? (
            <div className="kv">
              <span className="k">key strategy</span>
              <span className="v">{def.key}</span>
            </div>
          ) : null}
          {def.record?.properties ? (
            <PropertyTable
              properties={def.record.properties}
              required={def.record.required ?? []}
              nullable={def.record.nullable ?? []}
              lexiconId={lexiconId}
            />
          ) : null}
        </>
      );
    case 'object':
    case 'params':
      return def.properties ? (
        <PropertyTable
          properties={def.properties}
          required={def.required ?? []}
          nullable={def.nullable ?? []}
          lexiconId={lexiconId}
        />
      ) : null;
    case 'query':
    case 'procedure':
      return (
        <>
          {def.parameters?.properties ? (
            <>
              <div className="section-lbl">parameters</div>
              <PropertyTable
                properties={def.parameters.properties}
                required={def.parameters.required ?? []}
                nullable={[]}
                lexiconId={lexiconId}
              />
            </>
          ) : null}
          {def.input ? (
            <>
              <div className="section-lbl">input · {def.input.encoding ?? '?'}</div>
              {def.input.schema ? <DefBody def={def.input.schema} lexiconId={lexiconId} /> : null}
            </>
          ) : null}
          {def.output ? (
            <>
              <div className="section-lbl">output · {def.output.encoding ?? '?'}</div>
              {def.output.schema ? <DefBody def={def.output.schema} lexiconId={lexiconId} /> : null}
            </>
          ) : null}
          {def.errors && def.errors.length > 0 ? (
            <>
              <div className="section-lbl">errors</div>
              <ul className="errs">
                {def.errors.map((e) => (
                  <li key={e.name} className="err-item">
                    <b>{e.name}</b>
                    {e.description ? <span className="t-faint"> — {e.description}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      );
    case 'subscription': {
      const message = (def as unknown as { message?: { schema?: Def } }).message;
      return (
        <>
          {def.parameters?.properties ? (
            <>
              <div className="section-lbl">parameters</div>
              <PropertyTable
                properties={def.parameters.properties}
                required={def.parameters.required ?? []}
                nullable={[]}
                lexiconId={lexiconId}
              />
            </>
          ) : null}
          {message?.schema ? (
            <>
              <div className="section-lbl">message</div>
              <DefBody def={message.schema} lexiconId={lexiconId} />
            </>
          ) : null}
        </>
      );
    }
    case 'token':
      return <div className="empty-inline">// token marker — referenced by name, no schema body</div>;
    case 'string':
    case 'integer':
    case 'boolean':
    case 'blob':
    case 'bytes':
    case 'cid-link':
    case 'null':
    case 'unknown':
      return <PrimitiveDetail def={def} />;
    case 'array':
      return def.items ? (
        <>
          <div className="section-lbl">items</div>
          <DefBody def={def.items} lexiconId={lexiconId} />
        </>
      ) : null;
    case 'ref':
      return <RefBadges refs={def.ref ? [def.ref] : []} lexiconId={lexiconId} />;
    case 'union':
      return (
        <>
          <RefBadges refs={def.refs ?? []} lexiconId={lexiconId} />
          {def.closed ? <div className="empty-inline">// closed union</div> : null}
        </>
      );
    default:
      return null;
  }
}

function PropertyTable({
  properties,
  required,
  nullable,
  lexiconId,
}: {
  properties: Record<string, Def>;
  required: string[];
  nullable: string[];
  lexiconId: string;
}) {
  const names = Object.keys(properties);
  return (
    <div className="props">
      {names.map((k) => {
        const p = properties[k];
        return (
          <div key={k} className="prop-row">
            <div className="prop-name">
              <span className="p-key">{k}</span>
              {required.includes(k) ? <span className="p-flag p-req">required</span> : null}
              {nullable.includes(k) ? <span className="p-flag p-null">nullable</span> : null}
            </div>
            <div className="prop-type">
              <TypeSummary def={p} lexiconId={lexiconId} />
            </div>
            {p.description ? <div className="prop-desc">{p.description}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function TypeSummary({ def, lexiconId }: { def: Def; lexiconId: string }) {
  const type = def.type ?? 'unknown';
  const bits: React.ReactNode[] = [<span key="t" className={'t-chip t-' + type}>{type}</span>];
  if (type === 'string' && def.format) bits.push(<span key="f" className="t-meta">format: {def.format}</span>);
  if (type === 'string' && def.enum) bits.push(<span key="e" className="t-meta">enum: {def.enum.join(' | ')}</span>);
  if (type === 'string' && def.knownValues) bits.push(<span key="kv" className="t-meta">known: {def.knownValues.join(' | ')}</span>);
  if ((type === 'string' || type === 'array') && (def.minLength != null || def.maxLength != null || def.minItems != null || def.maxItems != null)) {
    const lo = def.minLength ?? def.minItems;
    const hi = def.maxLength ?? def.maxItems;
    bits.push(<span key="len" className="t-meta">len: {lo ?? '?'}..{hi ?? '?'}</span>);
  }
  if (type === 'integer' && (def.minimum != null || def.maximum != null)) {
    bits.push(<span key="rng" className="t-meta">range: {def.minimum ?? '?'}..{def.maximum ?? '?'}</span>);
  }
  if (def.default !== undefined) bits.push(<span key="d" className="t-meta">default: {JSON.stringify(def.default)}</span>);
  if (type === 'array' && def.items) bits.push(<span key="it" className="t-meta">of: {innerSummary(def.items, lexiconId)}</span>);
  if (type === 'ref' && def.ref) bits.push(<RefChip key={def.ref} ref={def.ref} lexiconId={lexiconId} />);
  if (type === 'union' && def.refs) bits.push(...def.refs.map((r) => <RefChip key={r} ref={r} lexiconId={lexiconId} />));
  return <span className="type-summary">{bits}</span>;
}

function innerSummary(def: Def, lexiconId: string): React.ReactNode {
  if (def.type === 'ref' && def.ref) return <RefChip ref={def.ref} lexiconId={lexiconId} />;
  if (def.type === 'union' && def.refs) return <>{def.refs.map((r) => <RefChip key={r} ref={r} lexiconId={lexiconId} />)}</>;
  return <span>{def.type}</span>;
}

function RefBadges({ refs, lexiconId }: { refs: string[]; lexiconId: string }) {
  if (refs.length === 0) return null;
  return (
    <div className="refs">
      {refs.map((r) => (
        <RefChip key={r} ref={r} lexiconId={lexiconId} />
      ))}
    </div>
  );
}

function RefChip({ ref }: { ref: string; lexiconId?: string }) {
  // ref shapes: "#fooDef" (local), "app.bsky.foo.bar" (external main), "app.bsky.foo.bar#baz" (external def)
  const isLocal = ref.startsWith('#');
  if (isLocal) {
    const defName = ref.slice(1);
    return (
      <a href={`#def-${defName}`} className="ref-chip ref-local">
        {ref}
      </a>
    );
  }
  const [extNsid, extDef] = ref.split('#');
  return (
    <Link to={`/labs/lexicon/${extNsid}${extDef ? `#def-${extDef}` : ''}` as never} className="ref-chip ref-ext">
      {ref} ↗
    </Link>
  );
}

function PrimitiveDetail({ def }: { def: Def }) {
  return <TypeSummary def={def} lexiconId="" />;
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="prog">
      <div className="prog-line">
        <span>{label}</span>
      </div>
      <div className="prog-bar">
        <div className="prog-bar-indeterminate" />
      </div>
    </section>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <section className="err">
      <div className="err-hd">// error</div>
      <div className="err-body">{msg}</div>
    </section>
  );
}

const CSS = `
  .shell-lex { max-width: 960px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .lex-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .lex-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .lex-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .lex-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .lex-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .lex-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
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

  .samples {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;
    margin-top: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .sample {
    padding: 3px 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    text-decoration: none;
  }
  .sample:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }

  /* meta */
  .lex-meta {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .lex-id {
    font-family: var(--font-display);
    font-size: clamp(24px, 4vw, 36px);
    color: var(--color-accent);
    letter-spacing: -0.02em;
    word-break: break-all;
    line-height: 1.1;
  }
  .lex-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin-top: var(--sp-3);
    overflow-wrap: break-word;
  }
  .lex-stats {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .lex-stats b { color: var(--color-fg); font-weight: 400; }

  .lex-toc {
    display: flex; gap: 4px; flex-wrap: wrap;
    margin-top: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--color-border);
  }
  .toc-link {
    display: inline-flex; gap: 6px; align-items: baseline;
    padding: 3px 8px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    text-decoration: none;
  }
  .toc-link:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }
  .toc-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-fg-faint);
  }

  /* defs */
  .defs { display: flex; flex-direction: column; gap: var(--sp-4); margin-top: var(--sp-5); }
  .def {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4) var(--sp-5);
    scroll-margin-top: var(--sp-6);
  }
  .def-hd {
    display: flex; gap: var(--sp-3); align-items: baseline;
    padding-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
  }
  .def-type {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 2px 8px;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
  }
  .def-type-record   { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .def-type-query    { color: oklch(0.78 0.11 210); border-color: oklch(0.4 0.1 210); }
  .def-type-procedure{ color: oklch(0.82 0.13 85); border-color: oklch(0.5 0.1 85); }
  .def-type-subscription { color: oklch(0.78 0.16 315); border-color: oklch(0.4 0.12 315); }
  .def-type-object   { color: var(--color-fg-dim); }
  .def-type-token    { color: oklch(0.85 0.14 65); border-color: oklch(0.5 0.1 65); }
  .def-name {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    overflow-wrap: break-word;
    word-break: break-all;
    flex: 1;
    min-width: 0;
  }
  .def-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin: var(--sp-3) 0 0;
    white-space: pre-wrap;
  }

  .kv { display: flex; gap: var(--sp-3); margin-top: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .kv .k { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .kv .v { color: var(--color-fg); }

  .section-lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent-dim);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: var(--sp-4) 0 var(--sp-2);
  }

  .props { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); }
  .prop-row {
    padding: var(--sp-2) 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .prop-row:last-child { border-bottom: 0; }
  .prop-name { display: flex; gap: var(--sp-2); align-items: baseline; flex-wrap: wrap; }
  .p-key {
    font-family: var(--font-mono);
    color: var(--color-fg);
    font-size: var(--fs-sm);
  }
  .p-flag {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 1px 5px;
    border: 1px solid var(--color-border);
  }
  .p-req { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .p-null { color: oklch(0.82 0.13 85); border-color: oklch(0.5 0.1 85); }
  .prop-type {
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
  }
  .type-summary { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: baseline; }
  .t-chip {
    padding: 1px 6px;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    font-size: 10px;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .t-chip.t-string  { color: oklch(0.82 0.13 85); border-color: oklch(0.5 0.1 85); }
  .t-chip.t-integer { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .t-chip.t-boolean { color: oklch(0.78 0.16 315); border-color: oklch(0.4 0.12 315); }
  .t-chip.t-ref     { color: oklch(0.78 0.11 210); border-color: oklch(0.4 0.1 210); }
  .t-chip.t-union   { color: oklch(0.78 0.11 210); border-color: oklch(0.4 0.1 210); }
  .t-chip.t-array   { color: var(--color-fg-dim); }
  .t-chip.t-blob    { color: oklch(0.82 0.13 85); }
  .t-chip.t-unknown { color: var(--color-fg-faint); }
  .t-meta { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .prop-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-xs);
    margin-top: 4px;
    line-height: 1.5;
    font-family: var(--font-mono);
  }

  .refs { display: flex; gap: 6px; flex-wrap: wrap; margin-top: var(--sp-3); }
  .ref-chip {
    display: inline-block;
    padding: 3px 8px;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
    color: var(--color-accent);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    word-break: break-all;
  }
  .ref-chip:hover { background: color-mix(in oklch, var(--color-accent) 14%, transparent); text-decoration: none; }

  .errs { list-style: none; margin: 0; padding: 0; }
  .err-item {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 2px 0;
    color: var(--color-fg-dim);
  }
  .err-item b { color: var(--color-alert); font-weight: 400; }

  .empty-inline { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: var(--sp-2); }

  .raw { margin-top: var(--sp-6); }

  /* progress / error / empty */
  .prog {
    margin-top: var(--sp-6);
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

  .empty {
    margin-top: var(--sp-8);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); }

  .lex-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
