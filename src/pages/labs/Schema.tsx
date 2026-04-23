import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { HL_CSS, highlightJs } from '../../lib/highlight-js';

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema | Schema[];
  format?: string;
  examples?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  enum?: unknown[];
};

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function detectFormat(s: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(s)) return 'date-time';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'date';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return 'time';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email';
  if (/^https?:\/\/\S+$/.test(s)) return 'uri';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'uuid';
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'ipv4';
  return undefined;
}

function mergeTypes(types: Set<string>): string | string[] {
  const arr = Array.from(types);
  // prefer 'number' over 'integer' when both occur
  if (arr.includes('number') && arr.includes('integer')) {
    const rest = arr.filter((t) => t !== 'integer');
    if (rest.length === 1) return rest[0];
    return rest;
  }
  if (arr.length === 1) return arr[0];
  return arr;
}

function infer(v: unknown): Schema {
  const t = typeOf(v);
  switch (t) {
    case 'null': return { type: 'null' };
    case 'boolean': return { type: 'boolean' };
    case 'integer': return { type: 'integer' };
    case 'number': return { type: 'number' };
    case 'string': {
      const s = v as string;
      const f = detectFormat(s);
      return f ? { type: 'string', format: f } : { type: 'string' };
    }
    case 'array': {
      const arr = v as unknown[];
      if (arr.length === 0) return { type: 'array', items: {} };
      const items = arr.map(infer);
      // try to merge homogeneous item schemas
      const merged = mergeSchemas(items);
      return { type: 'array', items: merged };
    }
    case 'object': {
      const obj = v as Record<string, unknown>;
      const properties: Record<string, Schema> = {};
      const required: string[] = [];
      for (const [k, val] of Object.entries(obj)) {
        properties[k] = infer(val);
        if (val !== null && val !== undefined) required.push(k);
      }
      const out: Schema = { type: 'object', properties };
      if (required.length) out.required = required;
      return out;
    }
  }
  return {};
}

function mergeSchemas(schemas: Schema[]): Schema {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];
  // collect primitive types
  const types = new Set<string>();
  for (const s of schemas) {
    if (Array.isArray(s.type)) s.type.forEach((t) => types.add(t));
    else if (s.type) types.add(s.type);
  }
  const objectSchemas = schemas.filter((s) => s.type === 'object');
  const arraySchemas = schemas.filter((s) => s.type === 'array');
  if (objectSchemas.length === schemas.length) {
    // all objects — merge properties
    const props: Record<string, Schema[]> = {};
    const requiredCounts: Record<string, number> = {};
    for (const s of objectSchemas) {
      for (const [k, ps] of Object.entries(s.properties ?? {})) {
        (props[k] ||= []).push(ps);
      }
      for (const k of s.required ?? []) requiredCounts[k] = (requiredCounts[k] ?? 0) + 1;
    }
    const merged: Record<string, Schema> = {};
    for (const [k, arr] of Object.entries(props)) {
      merged[k] = mergeSchemas(arr);
    }
    const required = Object.entries(requiredCounts)
      .filter(([, c]) => c === objectSchemas.length)
      .map(([k]) => k);
    return { type: 'object', properties: merged, ...(required.length ? { required } : {}) };
  }
  if (arraySchemas.length === schemas.length) {
    const inner: Schema[] = [];
    for (const s of arraySchemas) {
      if (s.items && !Array.isArray(s.items)) inner.push(s.items);
    }
    return { type: 'array', items: mergeSchemas(inner) };
  }
  return { type: mergeTypes(types) };
}

const SAMPLE = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "luna@imlunahey.com",
  "name": "luna",
  "age": 33,
  "verified": true,
  "created": "2023-07-15T14:22:10Z",
  "tags": ["atproto", "bluesky", "dev"],
  "address": {
    "city": "london",
    "country": "uk"
  },
  "lastLogin": null
}`;

export default function SchemaPage() {
  const [input, setInput] = useState(SAMPLE);
  const [draft, setDraft] = useState('2020-12');

  const result = useMemo(() => {
    try {
      const v = JSON.parse(input);
      const schema = infer(v);
      const meta = {
        $schema: draft === '2020-12' ? 'https://json-schema.org/draft/2020-12/schema' : 'http://json-schema.org/draft-07/schema#',
        ...schema,
      };
      return { ok: true as const, schema: meta };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'parse failed' };
    }
  }, [input, draft]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-sch">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">schema</span>
        </div>

        <header className="sch-hd">
          <h1>schema<span className="dot">.</span></h1>
          <p className="sub">
            paste any json — infer a json schema from it. detects common formats (date-time, email,
            uuid, uri, ipv4), marks required vs optional based on nullability, merges heterogeneous
            arrays sensibly.
          </p>
        </header>

        <div className="sch-bar">
          <label className="sch-lbl">draft</label>
          <div className="sch-pill">
            {['2020-12', '07'].map((d) => (
              <button
                key={d}
                className={`sch-pbtn ${draft === d ? 'on' : ''}`}
                onClick={() => setDraft(d)}
              >draft {d}</button>
            ))}
          </div>
        </div>

        <section className="sch-io">
          <div className="sch-col">
            <header className="sch-col-hd">
              <span>── input json</span>
            </header>
            <textarea
              className="sch-ta"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="sch-col">
            <header className="sch-col-hd">
              <span>── inferred schema</span>
              {result.ok ? (
                <button className="sch-copy" onClick={() => copy(JSON.stringify(result.schema, null, 2))}>copy</button>
              ) : null}
            </header>
            {result.ok ? (
              <pre className="sch-out">{highlightJs(JSON.stringify(result.schema, null, 2))}</pre>
            ) : (
              <div className="sch-err">✗ {result.error}</div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

const CSS = `
  .shell-sch { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .sch-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .sch-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .sch-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .sch-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .sch-bar { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-5) 0 var(--sp-3); }
  .sch-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .sch-pill { display: inline-flex; border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .sch-pbtn { background: transparent; border: 0; color: var(--color-fg-dim); padding: 4px 10px; cursor: pointer; font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: lowercase; }
  .sch-pbtn.on { background: var(--color-accent); color: #000; }

  .sch-io {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
    padding-bottom: var(--sp-10);
  }
  .sch-col { display: flex; flex-direction: column; background: var(--color-bg-panel); border: 1px solid var(--color-border); min-height: 560px; }
  .sch-col-hd {
    display: flex; justify-content: space-between;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .sch-copy { font-family: var(--font-mono); font-size: var(--fs-xs); background: transparent; color: var(--color-fg-dim); border: 1px solid var(--color-border-bright); padding: 2px 8px; cursor: pointer; }
  .sch-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .sch-ta {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    line-height: 1.5;
    resize: none;
    white-space: pre;
    overflow: auto;
  }
  .sch-out {
    flex: 1;
    margin: 0;
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--color-fg);
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
  }
  .sch-err { padding: var(--sp-3); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-sm); }

  ${HL_CSS}

  @media (max-width: 800px) {
    .sch-io { grid-template-columns: 1fr; }
  }
`;
