import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Dir = 'csv2json' | 'json2csv';

function parseCsv(text: string, delim: string, hasHeader: boolean): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"' && cell === '') inQuotes = true;
      else if (c === delim) { cur.push(cell); cell = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { cur.push(cell); out.push(cur); cur = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell !== '' || cur.length > 0) { cur.push(cell); out.push(cur); }

  if (out.length === 0) return { headers: [], rows: [] };
  if (hasHeader) {
    const headers = out[0];
    return { headers, rows: out.slice(1) };
  }
  const headers = out[0].map((_, i) => `col${i + 1}`);
  return { headers, rows: out };
}

function csvCell(v: unknown, delim: string): string {
  const s = v == null ? '' : String(v);
  if (s.includes('"') || s.includes(delim) || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toJson(text: string, delim: string, hasHeader: boolean, numeric: boolean): string {
  const { headers, rows } = parseCsv(text, delim, hasHeader);
  const coerce = (v: string): string | number | boolean | null => {
    if (!numeric) return v;
    if (v === '') return '';
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  };
  const arr = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      o[headers[i] ?? `col${i + 1}`] = coerce(r[i] ?? '');
    }
    return o;
  });
  return JSON.stringify(arr, null, 2);
}

function fromJson(text: string, delim: string): string {
  const v = JSON.parse(text);
  if (!Array.isArray(v)) throw new Error('expected a json array of objects');
  if (v.length === 0) return '';
  const allKeys = new Set<string>();
  for (const o of v) {
    if (o && typeof o === 'object') for (const k of Object.keys(o)) allKeys.add(k);
  }
  const headers = [...allKeys];
  const lines: string[] = [];
  lines.push(headers.map((h) => csvCell(h, delim)).join(delim));
  for (const row of v) {
    if (row && typeof row === 'object') {
      lines.push(headers.map((h) => csvCell((row as Record<string, unknown>)[h], delim)).join(delim));
    }
  }
  return lines.join('\n');
}

const SAMPLE_CSV = `name,handle,posts,joined
luna,imlunahey.com,1247,2023-07-15
jane,jane.bsky.social,42,2024-01-01
bob,"bob, the builder",999,2023-12-25`;

export default function CsvPage() {
  const [dir, setDir] = useState<Dir>('csv2json');
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [json, setJson] = useState('');
  const [delim, setDelim] = useState(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [coerce, setCoerce] = useState(true);

  const result = useMemo<{ ok: true; value: string; preview?: { headers: string[]; rows: string[][] } } | { ok: false; error: string }>(() => {
    try {
      if (dir === 'csv2json') {
        const parsed = parseCsv(csv, delim, hasHeader);
        return { ok: true, value: toJson(csv, delim, hasHeader, coerce), preview: parsed };
      } else {
        const out = fromJson(json, delim);
        const parsed = parseCsv(out, delim, hasHeader);
        return { ok: true, value: out, preview: parsed };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'failed' };
    }
  }, [dir, csv, json, delim, hasHeader, coerce]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-csv">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">csv</span>
        </div>

        <header className="csv-hd">
          <h1>csv<span className="dot">.</span></h1>
          <p className="sub">
            convert between csv and json. paste either side, see the other. handles quoted fields,
            escaped quotes, alternate delimiters (comma / tab / semicolon / pipe), type coercion.
          </p>
        </header>

        <section className="csv-bar">
          <div className="csv-pill">
            <button
              className={`csv-pbtn ${dir === 'csv2json' ? 'on' : ''}`}
              onClick={() => setDir('csv2json')}
            >csv → json</button>
            <button
              className={`csv-pbtn ${dir === 'json2csv' ? 'on' : ''}`}
              onClick={() => setDir('json2csv')}
            >json → csv</button>
          </div>
          <div className="csv-opts" role="group" aria-label="delimiter">
            <span className="csv-lbl" aria-hidden="true">delim</span>
            {[
              { d: ',', n: ',' },
              { d: '\t', n: '\\t' },
              { d: ';', n: ';' },
              { d: '|', n: '|' },
            ].map((o) => (
              <button
                key={o.n}
                className={`csv-chip ${delim === o.d ? 'on' : ''}`}
                onClick={() => setDelim(o.d)}
              >{o.n}</button>
            ))}
            <label className="csv-check">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              has header
            </label>
            {dir === 'csv2json' ? (
              <label className="csv-check">
                <input type="checkbox" checked={coerce} onChange={(e) => setCoerce(e.target.checked)} />
                coerce types
              </label>
            ) : null}
          </div>
        </section>

        <section className="csv-io">
          <div className="csv-col">
            <header className="csv-col-hd">
              <span>── {dir === 'csv2json' ? 'csv (input)' : 'json (input)'}</span>
              <button
                className="csv-copy"
                onClick={() => copy(dir === 'csv2json' ? csv : json)}
              >copy</button>
            </header>
            {dir === 'csv2json' ? (
              <textarea
                className="csv-ta"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                spellCheck={false}
              />
            ) : (
              <textarea
                className="csv-ta"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='[{"name":"luna","posts":1247}]'
                spellCheck={false}
              />
            )}
          </div>
          <div className="csv-col">
            <header className="csv-col-hd">
              <span>── {dir === 'csv2json' ? 'json (output)' : 'csv (output)'}</span>
              {result.ok ? <button className="csv-copy" onClick={() => copy(result.value)}>copy</button> : null}
            </header>
            {result.ok ? (
              <textarea
                className="csv-ta"
                value={result.value}
                readOnly
                spellCheck={false}
              />
            ) : (
              <div className="csv-err">✗ {result.error}</div>
            )}
          </div>
        </section>

        {result.ok && result.preview && result.preview.headers.length > 0 ? (
          <section className="csv-preview">
            <header className="csv-preview-hd">── preview · {result.preview.rows.length} rows</header>
            <div className="csv-table-wrap">
              <table className="csv-table">
                <thead>
                  <tr>
                    {result.preview.headers.map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.rows.slice(0, 25).map((r, i) => (
                    <tr key={i}>
                      {result.preview!.headers.map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.preview.rows.length > 25 ? (
                <div className="csv-more">…{result.preview.rows.length - 25} more rows</div>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

const CSS = `
  .shell-csv { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .csv-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .csv-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .csv-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .csv-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .csv-bar {
    display: flex; gap: var(--sp-4); flex-wrap: wrap; align-items: center;
    margin: var(--sp-5) 0 var(--sp-3);
  }
  .csv-pill {
    display: inline-flex;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .csv-pbtn {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    background: transparent;
    color: var(--color-fg-dim);
    border: 0;
    padding: 6px 14px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .csv-pbtn.on { background: var(--color-accent); color: #000; }

  .csv-opts { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .csv-lbl {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em;
  }
  .csv-chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer;
  }
  .csv-chip.on { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .csv-check {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim); cursor: pointer;
  }
  .csv-check input { accent-color: var(--color-accent); }

  .csv-io {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .csv-col { display: flex; flex-direction: column; background: var(--color-bg-panel); border: 1px solid var(--color-border); min-height: 300px; }
  .csv-col-hd {
    display: flex; justify-content: space-between;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .csv-copy {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright); padding: 2px 8px;
    cursor: pointer;
  }
  .csv-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .csv-ta {
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
  .csv-err {
    padding: var(--sp-3);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .csv-preview { padding-bottom: var(--sp-10); }
  .csv-preview-hd { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
  .csv-table-wrap {
    overflow-x: auto;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .csv-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .csv-table th, .csv-table td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .csv-table th { color: var(--color-accent); background: var(--color-bg-raised); font-weight: 400; }
  .csv-table td { color: var(--color-fg-dim); }
  .csv-more { padding: var(--sp-2); text-align: center; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  @media (max-width: 760px) {
    .csv-io { grid-template-columns: 1fr; }
  }
`;
