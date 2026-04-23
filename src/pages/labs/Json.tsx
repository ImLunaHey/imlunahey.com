import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Path = string;

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

const SAMPLE = `{
  "name": "luna",
  "handles": ["imlunahey.com", "imlunahey.bsky.social"],
  "did": "did:plc:k6acu4chiwkixvdedcmdgmal",
  "services": {
    "pds": "https://puffball.us-east.host.bsky.network",
    "labeler": null
  },
  "posts": {
    "count": 1247,
    "latest": {
      "uri": "at://did:plc:.../app.bsky.feed.post/3mjzwsly52c2c",
      "likes": 42,
      "reposts": 3
    }
  },
  "pinned": [],
  "verified": true,
  "joined": "2023-07-15T14:22:10Z"
}`;

export default function JsonPage() {
  const [raw, setRaw] = useState(SAMPLE);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<Path>>(new Set(['$']));

  const parsed = useMemo<{ ok: true; value: unknown } | { ok: false; error: string }>(() => {
    if (!raw.trim()) return { ok: false, error: 'empty' };
    try { return { ok: true, value: JSON.parse(raw) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'parse failed' }; }
  }, [raw]);

  const stats = useMemo(() => {
    if (!parsed.ok) return null;
    let nodes = 0, leaves = 0, depth = 0;
    function walk(v: unknown, d: number) {
      nodes++;
      depth = Math.max(depth, d);
      if (v !== null && typeof v === 'object') {
        for (const key in v) walk((v as Record<string, unknown>)[key], d + 1);
      } else {
        leaves++;
      }
    }
    walk(parsed.value, 0);
    return { nodes, leaves, depth, bytes: new TextEncoder().encode(raw).length };
  }, [parsed, raw]);

  const toggle = (p: Path) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p); else n.add(p);
      return n;
    });
  };

  const expandAll = () => {
    if (!parsed.ok) return;
    const all = new Set<Path>();
    function walk(v: unknown, p: Path) {
      all.add(p);
      if (Array.isArray(v)) {
        v.forEach((c, i) => walk(c, `${p}[${i}]`));
      } else if (v !== null && typeof v === 'object') {
        for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], `${p}.${k}`);
      }
    }
    walk(parsed.value, '$');
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set(['$']));

  const format = () => {
    if (parsed.ok) setRaw(JSON.stringify(parsed.value, null, 2));
  };
  const minify = () => {
    if (parsed.ok) setRaw(JSON.stringify(parsed.value));
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-js">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">json</span>
        </div>

        <header className="js-hd">
          <h1>json<span className="dot">.</span></h1>
          <p className="sub">
            paste any json blob — get a collapsible tree with search, per-node path, and a click-to-copy
            jsonpath. deals gracefully with deeply nested bluesky records, lexicons, and responses.
          </p>
        </header>

        <section className="js-io">
          <div className="js-col">
            <header className="js-col-hd">
              <span>── input</span>
              <span className={parsed.ok ? 'ok' : 'err'}>
                {parsed.ok ? `✓ valid · ${stats?.bytes} bytes` : `✗ ${parsed.error}`}
              </span>
            </header>
            <textarea
              className="js-ta"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="js-actions">
              <button className="js-btn" onClick={format} disabled={!parsed.ok}>format</button>
              <button className="js-btn" onClick={minify} disabled={!parsed.ok}>minify</button>
              <button className="js-btn" onClick={() => setRaw('')}>clear</button>
              <button className="js-btn" onClick={() => { try { navigator.clipboard.writeText(raw); } catch { /* noop */ } }}>copy</button>
            </div>
          </div>

          <div className="js-col">
            <header className="js-col-hd">
              <span>── tree</span>
              {stats ? <span>{stats.nodes} nodes · depth {stats.depth}</span> : null}
            </header>
            <div className="js-tree-toolbar">
              <input
                className="js-search"
                placeholder="filter by key or value…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                spellCheck={false}
              />
              <button className="js-btn sm" onClick={expandAll}>expand all</button>
              <button className="js-btn sm" onClick={collapseAll}>collapse</button>
            </div>
            <div className="js-tree">
              {parsed.ok ? (
                <Node
                  value={parsed.value}
                  path="$"
                  label="$"
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  search={search.toLowerCase()}
                />
              ) : (
                <div className="js-empty">enter valid json to see the tree</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function matchesSearch(v: unknown, key: string, q: string): boolean {
  if (!q) return true;
  if (key.toLowerCase().includes(q)) return true;
  if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
  if (typeof v === 'number' || typeof v === 'boolean') {
    if (String(v).toLowerCase().includes(q)) return true;
  }
  if (v === null) return 'null'.includes(q);
  if (typeof v === 'object') {
    for (const k in v) {
      if (matchesSearch((v as Record<string, unknown>)[k], k, q)) return true;
    }
  }
  return false;
}

function Node({
  value, path, label, depth, expanded, onToggle, search,
}: {
  value: unknown;
  path: Path;
  label: string;
  depth: number;
  expanded: Set<Path>;
  onToggle: (p: Path) => void;
  search: string;
}) {
  const t = typeOf(value);
  const isObj = t === 'object';
  const isArr = t === 'array';
  const isContainer = isObj || isArr;
  const open = expanded.has(path);

  if (search && !matchesSearch(value, label, search)) return null;

  const copyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { navigator.clipboard.writeText(path); } catch { /* noop */ }
  };

  const entries = isArr
    ? (value as unknown[]).map((v, i) => ({ k: String(i), v, childPath: `${path}[${i}]` }))
    : isObj
      ? Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ k, v, childPath: `${path}.${k}` }))
      : [];

  return (
    <div className={`js-node d-${depth}`}>
      <div className={`js-row t-${t}`} onClick={() => isContainer && onToggle(path)}>
        {isContainer ? (
          <span className="js-toggle">{open ? '▾' : '▸'}</span>
        ) : (
          <span className="js-toggle empty" />
        )}
        <span className="js-key">{label}</span>
        <span className="js-colon">:</span>
        {isContainer ? (
          <span className="js-meta">
            <span className={`js-bracket t-${t}`}>
              {isArr ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).length}}`}
            </span>
            {!open && entries.length > 0 ? (
              <span className="js-preview">
                {entries.slice(0, 3).map(({ k, v }) => (
                  <span key={k} className="js-preview-item">
                    {isObj ? <span className="js-preview-k">{k}:</span> : null}
                    <span className={`js-preview-v t-${typeOf(v)}`}>{compactPreview(v)}</span>
                  </span>
                ))}
                {entries.length > 3 ? <span className="t-faint">…</span> : null}
              </span>
            ) : null}
          </span>
        ) : (
          <span className={`js-value t-${t}`}>{formatScalar(value)}</span>
        )}
        <button className="js-path" onClick={copyPath} title="copy json path">{'⎘'}</button>
      </div>
      {isContainer && open ? (
        <div className="js-children">
          {entries.map(({ k, v, childPath }) => (
            <Node
              key={k}
              value={v}
              path={childPath}
              label={k}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              search={search}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatScalar(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function compactPreview(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 18 ? `"${v.slice(0, 18)}…"` : `"${v}"`;
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return `{${Object.keys(v as object).length}}`;
  return String(v);
}

const CSS = `
  .shell-js { max-width: 1300px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .js-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .js-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .js-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .js-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .js-io {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
    padding: var(--sp-5) 0 var(--sp-10);
  }
  .js-col {
    display: flex; flex-direction: column;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    min-height: 560px;
  }
  .js-col-hd {
    display: flex; justify-content: space-between;
    padding: 8px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .js-col-hd .ok { color: var(--color-accent); }
  .js-col-hd .err { color: var(--color-alert); }

  .js-ta {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: none;
    white-space: pre;
    overflow: auto;
  }
  .js-actions {
    display: flex; gap: 4px;
    padding: var(--sp-2) var(--sp-3);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-raised);
  }
  .js-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 3px 9px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .js-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .js-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .js-btn.sm { padding: 2px 7px; font-size: 10px; }

  .js-tree-toolbar {
    display: flex; gap: 4px;
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-raised);
  }
  .js-search {
    flex: 1;
    background: transparent;
    border: 1px solid var(--color-border);
    outline: 0;
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .js-search:focus { border-color: var(--color-accent-dim); }

  .js-tree {
    flex: 1;
    padding: var(--sp-3);
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    max-height: 640px;
  }
  .js-empty {
    color: var(--color-fg-faint);
    text-align: center;
    padding: var(--sp-6);
    font-size: var(--fs-sm);
  }

  .js-node {
    min-width: 0;
  }
  .js-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 1px 2px;
    white-space: nowrap;
    overflow: hidden;
  }
  .js-row:hover { background: var(--color-bg-raised); }
  .js-row:hover .js-path { opacity: 1; }

  .js-toggle {
    width: 14px;
    text-align: center;
    color: var(--color-fg-faint);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }
  .js-toggle.empty { visibility: hidden; }
  .js-key {
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .js-colon { color: var(--color-fg-faint); flex-shrink: 0; }
  .js-meta { display: flex; gap: 6px; align-items: baseline; min-width: 0; overflow: hidden; }
  .js-bracket {
    color: var(--color-fg-dim);
  }
  .js-preview {
    display: flex; gap: 8px;
    color: var(--color-fg-ghost);
    font-size: var(--fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .js-preview-item { display: inline-flex; gap: 2px; }
  .js-preview-k { color: var(--color-fg-faint); }
  .js-preview-v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }

  .js-value {
    word-break: break-all;
    white-space: pre-wrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .t-string { color: #e9a074; }
  .t-number { color: #7cd3f7; }
  .t-boolean { color: #bf8cff; }
  .t-null { color: var(--color-fg-faint); font-style: italic; }
  .t-array { color: var(--color-warn); }
  .t-object { color: var(--color-fg-dim); }
  .t-faint { color: var(--color-fg-ghost); }

  .js-path {
    margin-left: auto;
    background: transparent;
    border: 0;
    color: var(--color-fg-faint);
    cursor: pointer;
    padding: 0 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    opacity: 0;
    transition: opacity 0.08s;
  }
  .js-path:hover { color: var(--color-accent); }

  .js-children {
    padding-left: var(--sp-4);
    border-left: 1px dashed var(--color-border);
    margin-left: 8px;
  }

  @media (max-width: 800px) {
    .js-io { grid-template-columns: 1fr; }
  }
`;
