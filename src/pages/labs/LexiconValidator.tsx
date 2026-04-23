import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { fetchLexicon } from '../../lib/fetch-lexicon';

type Def = {
  type: string;
  description?: string;
  required?: string[];
  nullable?: string[];
  properties?: Record<string, Def>;
  key?: string;
  record?: Def;
  enum?: string[];
  knownValues?: string[];
  format?: string;
  minLength?: number;
  maxLength?: number;
  minGraphemes?: number;
  maxGraphemes?: number;
  minimum?: number;
  maximum?: number;
  items?: Def;
  minItems?: number;
  maxItems?: number;
  ref?: string;
  refs?: string[];
  closed?: boolean;
  const?: unknown;
};

type LexiconDoc = {
  $type: string;
  lexicon: number;
  id: string;
  defs: Record<string, Def>;
  description?: string;
};

type VErr = { path: string; msg: string; hint?: string };

const FORMATS: Record<string, { test: (v: string) => boolean; desc: string }> = {
  datetime: { test: (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(v), desc: 'iso 8601 datetime' },
  did: { test: (v) => /^did:[a-z]+:[a-zA-Z0-9._:-]+$/.test(v), desc: 'did:method:id' },
  handle: { test: (v) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(v), desc: 'atproto handle' },
  'at-uri': { test: (v) => /^at:\/\/(did:[a-z]+:[a-zA-Z0-9._:-]+|[a-zA-Z0-9.-]+)(\/.+)?$/.test(v), desc: 'at:// uri' },
  uri: { test: (v) => /^[a-z][a-z0-9+.-]*:.+/i.test(v), desc: 'any uri scheme' },
  cid: { test: (v) => /^b[a-z2-7]{30,}$/.test(v) || /^Qm[a-zA-Z0-9]{44}$/.test(v), desc: 'ipfs cid' },
  language: { test: (v) => /^[a-zA-Z]{2,3}(-[a-zA-Z0-9-]+)?$/.test(v), desc: 'bcp 47 language tag' },
  tid: { test: (v) => /^[234567abcdefghijklmnopqrstuvwxyz]{13}$/.test(v), desc: '13-char tid' },
  'record-key': { test: (v) => /^[a-zA-Z0-9._~-]{1,512}$/.test(v), desc: 'record key' },
  'at-identifier': { test: (v) => /^did:[a-z]+:/.test(v) || /^[a-zA-Z0-9.-]+$/.test(v), desc: 'did or handle' },
  nsid: { test: (v) => /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+(\.[A-Za-z][A-Za-z0-9]*)$/.test(v), desc: 'reversed domain nsid' },
};

function resolveRef(ref: string, baseDoc: LexiconDoc): Def | null {
  if (ref.startsWith('#')) return baseDoc.defs[ref.slice(1)] ?? null;
  const [nsid, hash] = ref.split('#');
  if (!hash && nsid === baseDoc.id) return baseDoc.defs.main ?? null;
  if (hash && nsid === baseDoc.id) return baseDoc.defs[hash] ?? null;
  return null; // cross-doc refs not resolved — treat as unknown
}

function countGraphemes(s: string): number {
  try {
    let n = 0;
    for (const _ of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)) n++;
    return n;
  } catch { return s.length; }
}

function validate(doc: LexiconDoc, value: unknown): VErr[] {
  const errs: VErr[] = [];
  const root = doc.defs.main;
  if (!root) { errs.push({ path: '$', msg: 'lexicon has no #main def' }); return errs; }
  const target = root.type === 'record' && root.record ? root.record : root;
  walk(doc, target, value, '$', errs);
  return errs;
}

function walk(doc: LexiconDoc, def: Def, value: unknown, path: string, errs: VErr[]) {
  if (def.type === 'ref' && def.ref) {
    const resolved = resolveRef(def.ref, doc);
    if (resolved) return walk(doc, resolved, value, path, errs);
    // unresolved ref → skip validation
    return;
  }
  if (def.type === 'union' && def.refs) {
    // try each ref; succeed if any match produces zero errors; else report shortest error list
    let bestErrs: VErr[] | null = null;
    for (const ref of def.refs) {
      const resolved = resolveRef(ref, doc);
      if (!resolved) continue;
      const sub: VErr[] = [];
      walk(doc, resolved, value, path, sub);
      if (sub.length === 0) return;
      if (!bestErrs || sub.length < bestErrs.length) bestErrs = sub;
    }
    if (bestErrs) errs.push(...bestErrs);
    else errs.push({ path, msg: `value does not match any union member`, hint: def.refs.join(' | ') });
    return;
  }

  switch (def.type) {
    case 'null':
      if (value !== null) errs.push({ path, msg: `expected null, got ${typeof value}` });
      return;
    case 'boolean':
      if (typeof value !== 'boolean') errs.push({ path, msg: `expected boolean, got ${typeof value}` });
      return;
    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errs.push({ path, msg: `expected integer, got ${typeof value === 'number' ? 'float' : typeof value}` });
        return;
      }
      if (def.minimum != null && value < def.minimum) errs.push({ path, msg: `${value} < minimum ${def.minimum}` });
      if (def.maximum != null && value > def.maximum) errs.push({ path, msg: `${value} > maximum ${def.maximum}` });
      if (def.const !== undefined && value !== def.const) errs.push({ path, msg: `expected ${def.const}, got ${value}` });
      return;
    }
    case 'float': {
      if (typeof value !== 'number') errs.push({ path, msg: `expected number, got ${typeof value}` });
      return;
    }
    case 'string': {
      if (typeof value !== 'string') { errs.push({ path, msg: `expected string, got ${typeof value}` }); return; }
      if (def.enum && !def.enum.includes(value)) {
        errs.push({ path, msg: `"${value}" not in enum`, hint: def.enum.slice(0, 6).join(', ') + (def.enum.length > 6 ? '…' : '') });
      }
      if (def.const !== undefined && value !== def.const) errs.push({ path, msg: `expected const "${def.const}"` });
      if (def.minLength != null && [...value].length < def.minLength) errs.push({ path, msg: `too short (${[...value].length} < ${def.minLength})` });
      if (def.maxLength != null && new TextEncoder().encode(value).length > def.maxLength) {
        errs.push({ path, msg: `exceeds maxLength ${def.maxLength} bytes` });
      }
      if (def.minGraphemes != null && countGraphemes(value) < def.minGraphemes) errs.push({ path, msg: `fewer than ${def.minGraphemes} graphemes` });
      if (def.maxGraphemes != null && countGraphemes(value) > def.maxGraphemes) errs.push({ path, msg: `exceeds ${def.maxGraphemes} graphemes` });
      if (def.format) {
        const fmt = FORMATS[def.format];
        if (fmt && !fmt.test(value)) errs.push({ path, msg: `invalid format: ${def.format}`, hint: fmt.desc });
      }
      return;
    }
    case 'bytes':
      if (typeof value !== 'string' && !(value instanceof Uint8Array)) errs.push({ path, msg: 'expected bytes' });
      return;
    case 'cid-link':
      // $link reference object
      if (typeof value === 'object' && value !== null && '$link' in value) return;
      errs.push({ path, msg: 'expected cid-link ({ $link })' });
      return;
    case 'blob':
      if (typeof value !== 'object' || value === null || !('$type' in value) || (value as { $type?: string }).$type !== 'blob') {
        errs.push({ path, msg: 'expected blob reference' });
      }
      return;
    case 'array': {
      if (!Array.isArray(value)) { errs.push({ path, msg: `expected array, got ${typeof value}` }); return; }
      if (def.minItems != null && value.length < def.minItems) errs.push({ path, msg: `too few items (${value.length} < ${def.minItems})` });
      if (def.maxItems != null && value.length > def.maxItems) errs.push({ path, msg: `too many items (${value.length} > ${def.maxItems})` });
      if (def.items) {
        value.forEach((v, i) => walk(doc, def.items!, v, `${path}[${i}]`, errs));
      }
      return;
    }
    case 'object':
    case 'params':
    case 'record': {
      const inner = def.type === 'record' && def.record ? def.record : def;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errs.push({ path, msg: `expected object, got ${Array.isArray(value) ? 'array' : typeof value}` });
        return;
      }
      const obj = value as Record<string, unknown>;
      const required = inner.required ?? [];
      const properties = inner.properties ?? {};
      const nullable = new Set(inner.nullable ?? []);

      for (const k of required) {
        if (!(k in obj)) errs.push({ path: `${path}.${k}`, msg: 'required field missing' });
      }

      for (const [k, pdef] of Object.entries(properties)) {
        if (!(k in obj)) continue;
        const v = obj[k];
        if (v === null) {
          if (!nullable.has(k)) errs.push({ path: `${path}.${k}`, msg: 'null not allowed (not in nullable)' });
          continue;
        }
        walk(doc, pdef, v, `${path}.${k}`, errs);
      }

      if (inner.closed) {
        for (const k of Object.keys(obj)) {
          if (!(k in properties) && k !== '$type') {
            errs.push({ path: `${path}.${k}`, msg: 'unknown property (closed object)' });
          }
        }
      }
      return;
    }
    case 'unknown':
    case 'token':
      return; // any value OK
    default:
      // Unhandled type — skip silently
      return;
  }
}

const SAMPLE_RECORD = `{
  "$type": "app.bsky.feed.post",
  "text": "hello from a lexicon validator",
  "createdAt": "2026-04-23T14:22:10.000Z",
  "langs": ["en"]
}`;

export default function LexiconValidatorPage() {
  const [nsidInput, setNsidInput] = useState('app.bsky.feed.post');
  const [jsonInput, setJsonInput] = useState(SAMPLE_RECORD);
  const [nsidSubmitted, setNsidSubmitted] = useState<string | null>('app.bsky.feed.post');

  const { data: lexicon, isPending: loadingLex, error: lexErr } = useQuery({
    queryKey: ['lex-validator', nsidSubmitted],
    queryFn: () => fetchLexicon(nsidSubmitted!) as Promise<LexiconDoc>,
    enabled: !!nsidSubmitted,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const parsed = useMemo<{ ok: true; value: unknown } | { ok: false; error: string }>(() => {
    if (!jsonInput.trim()) return { ok: false, error: 'empty' };
    try { return { ok: true, value: JSON.parse(jsonInput) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'parse failed' }; }
  }, [jsonInput]);

  const errors = useMemo<VErr[]>(() => {
    if (!lexicon || !parsed.ok) return [];
    try { return validate(lexicon, parsed.value); }
    catch (err) { return [{ path: '$', msg: err instanceof Error ? err.message : 'validator crashed' }]; }
  }, [lexicon, parsed]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = nsidInput.trim();
    if (v) setNsidSubmitted(v);
  };

  const lexErrMsg = lexErr instanceof Error ? lexErr.message : null;
  const canValidate = !!lexicon && parsed.ok;
  const verdict =
    !nsidSubmitted ? 'idle' :
      loadingLex ? 'loading' :
        lexErrMsg ? 'schema-err' :
          !parsed.ok ? 'json-err' :
            errors.length === 0 ? 'valid' : 'invalid';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lv">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">lexicon validator</span>
        </div>

        <header className="lv-hd">
          <h1>lexicon validator<span className="dot">.</span></h1>
          <p className="sub">
            paste any atproto record, point at a lexicon nsid — get pass/fail with per-field violations.
            schemas are fetched live from their authoritative pds via dns-over-https + plc.directory.
          </p>
        </header>

        <section className="lv-inputs">
          <form className="lv-nsid-row" onSubmit={onSubmit}>
            <span className="lv-prompt">nsid</span>
            <input
              className="lv-nsid-input"
              value={nsidInput}
              onChange={(e) => setNsidInput(e.target.value)}
              placeholder="app.bsky.feed.post"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="lv-btn" type="submit" disabled={!nsidInput.trim()}>fetch</button>
          </form>

          <div className="lv-two">
            <div className="lv-panel">
              <header className="lv-panel-hd">
                <span>── record (json)</span>
                <span className={`lv-panel-tag ${parsed.ok ? 'ok' : 'err'}`}>
                  {parsed.ok ? '✓ valid json' : `✗ ${parsed.error}`}
                </span>
              </header>
              <textarea
                className="lv-ta"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="lv-panel">
              <header className="lv-panel-hd">
                <span>── schema</span>
                <span className={`lv-panel-tag ${lexicon ? 'ok' : lexErrMsg ? 'err' : 'dim'}`}>
                  {lexicon ? `✓ ${lexicon.id}` : lexErrMsg ? '✗ schema error' : loadingLex ? 'loading…' : 'idle'}
                </span>
              </header>
              <pre className="lv-schema">
                {lexErrMsg ? lexErrMsg :
                  lexicon ? JSON.stringify(lexicon, null, 2) :
                    loadingLex ? 'resolving authority via dns-over-https…' : '—'}
              </pre>
            </div>
          </div>
        </section>

        <section className="lv-verdict-row">
          <div className={`lv-verdict v-${verdict}`}>
            <span className={`lv-light l-${verdict}`} />
            <span>
              {verdict === 'valid' ? '✓ record is valid' :
                verdict === 'invalid' ? `✗ ${errors.length} violation${errors.length === 1 ? '' : 's'}` :
                  verdict === 'schema-err' ? '✗ schema fetch failed' :
                    verdict === 'json-err' ? '✗ invalid json' :
                      verdict === 'loading' ? 'loading schema…' : 'idle'}
            </span>
          </div>
          {canValidate && errors.length === 0 ? (
            <div className="lv-verdict-sub">no violations against <code>{lexicon?.id}</code> definition</div>
          ) : null}
        </section>

        {errors.length > 0 ? (
          <section className="lv-errors">
            <header className="lv-errors-hd">── violations</header>
            <ul>
              {errors.map((e, i) => (
                <li key={i} className="lv-error">
                  <span className="lv-error-path">{e.path}</span>
                  <span className="lv-error-msg">{e.msg}</span>
                  {e.hint ? <span className="lv-error-hint">{e.hint}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

const CSS = `
  .shell-lv { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .lv-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .lv-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 88px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .lv-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .lv-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .lv-inputs { padding: var(--sp-5) 0 var(--sp-4); }

  .lv-nsid-row {
    display: flex;
    margin-bottom: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .lv-prompt {
    padding: 0 var(--sp-3);
    display: flex; align-items: center;
    background: var(--color-bg-raised);
    border-right: 1px solid var(--color-border);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .lv-nsid-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-accent);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .lv-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .lv-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .lv-two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
  }
  .lv-panel {
    display: flex; flex-direction: column;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    min-height: 320px;
    min-width: 0;
    overflow: hidden;
  }
  .lv-panel-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .lv-panel-tag.ok { color: var(--color-accent); }
  .lv-panel-tag.err { color: var(--color-alert); }
  .lv-panel-tag.dim { color: var(--color-fg-faint); }

  .lv-ta {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: vertical;
    white-space: pre;
    overflow: auto;
  }
  .lv-schema {
    flex: 1;
    margin: 0;
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.45;
    color: var(--color-fg-dim);
    overflow: auto;
    max-height: 400px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .lv-verdict-row {
    padding: var(--sp-4) 0 var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .lv-verdict {
    display: inline-flex; align-items: center; gap: 10px;
    align-self: flex-start;
    padding: var(--sp-2) var(--sp-4);
    border: 1px solid;
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    font-weight: 500;
    text-transform: lowercase;
  }
  .lv-verdict.v-valid { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .lv-verdict.v-invalid { color: var(--color-alert); border-color: var(--color-alert-dim); background: color-mix(in srgb, var(--color-alert) 6%, transparent); }
  .lv-verdict.v-json-err, .lv-verdict.v-schema-err { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .lv-verdict.v-loading, .lv-verdict.v-idle { color: var(--color-fg-faint); border-color: var(--color-border); }

  .lv-light {
    width: 12px; height: 12px; border-radius: 50%;
    flex-shrink: 0;
  }
  .lv-light.l-valid { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .lv-light.l-invalid, .lv-light.l-json-err, .lv-light.l-schema-err { background: var(--color-alert); }
  .lv-light.l-loading { background: var(--color-warn); animation: lv-pulse 1.4s ease-in-out infinite; }
  .lv-light.l-idle { background: var(--color-fg-faint); opacity: 0.4; }
  @keyframes lv-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  .lv-verdict-sub {
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .lv-verdict-sub code { color: var(--color-accent); }

  .lv-errors {
    padding-bottom: var(--sp-10);
  }
  .lv-errors-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .lv-errors ul {
    list-style: none;
    display: flex; flex-direction: column; gap: 2px;
    border: 1px solid var(--color-alert-dim);
    background: color-mix(in srgb, var(--color-alert) 3%, var(--color-bg-panel));
  }
  .lv-error {
    display: grid;
    grid-template-columns: minmax(140px, auto) 1fr auto;
    gap: var(--sp-3);
    align-items: baseline;
    padding: 6px var(--sp-3);
    border-bottom: 1px dashed color-mix(in srgb, var(--color-alert) 20%, var(--color-border));
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .lv-error:last-child { border-bottom: 0; }
  .lv-error-path {
    color: var(--color-alert);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lv-error-msg {
    color: var(--color-fg);
  }
  .lv-error-hint {
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
    text-align: right;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 800px) {
    .lv-two { grid-template-columns: 1fr; }
    .lv-error { grid-template-columns: 1fr; gap: 2px; }
    .lv-error-hint { text-align: left; }
  }
`;
