import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Op =
  | { type: 'equal'; text: string; ai: number; bi: number }
  | { type: 'remove'; text: string; ai: number }
  | { type: 'add'; text: string; bi: number };

type Row = {
  left: { ln: number; text: string; kind: 'eq' | 'del' | 'pad' } | null;
  right: { ln: number; text: string; kind: 'eq' | 'add' | 'pad' } | null;
};

function lineDiff(a: string[], b: string[]): Op[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops: Op[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'equal', text: a[i - 1], ai: i - 1, bi: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ type: 'remove', text: a[i - 1], ai: i - 1 });
      i--;
    } else {
      ops.unshift({ type: 'add', text: b[j - 1], bi: j - 1 });
      j--;
    }
  }
  while (i > 0) { ops.unshift({ type: 'remove', text: a[i - 1], ai: i - 1 }); i--; }
  while (j > 0) { ops.unshift({ type: 'add', text: b[j - 1], bi: j - 1 }); j--; }
  return ops;
}

function toRows(ops: Op[]): Row[] {
  // Pair adjacent remove+add as side-by-side. Dangling removes/adds get padded.
  const rows: Row[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      rows.push({
        left: { ln: op.ai + 1, text: op.text, kind: 'eq' },
        right: { ln: op.bi + 1, text: op.text, kind: 'eq' },
      });
      i++;
    } else if (op.type === 'remove') {
      // collect run of removes then adds
      const rem: Op[] = [];
      while (i < ops.length && ops[i].type === 'remove') { rem.push(ops[i]); i++; }
      const add: Op[] = [];
      while (i < ops.length && ops[i].type === 'add') { add.push(ops[i]); i++; }
      const pairs = Math.max(rem.length, add.length);
      for (let k = 0; k < pairs; k++) {
        const r = rem[k];
        const a = add[k];
        rows.push({
          left: r ? { ln: (r as { ai: number }).ai + 1, text: r.text, kind: 'del' } : { ln: 0, text: '', kind: 'pad' },
          right: a ? { ln: (a as { bi: number }).bi + 1, text: a.text, kind: 'add' } : { ln: 0, text: '', kind: 'pad' },
        });
      }
    } else {
      rows.push({
        left: { ln: 0, text: '', kind: 'pad' },
        right: { ln: op.bi + 1, text: op.text, kind: 'add' },
      });
      i++;
    }
  }
  return rows;
}

const SAMPLE_A = `const add = (a, b) => a + b;
const sub = (a, b) => a - b;
const mul = (a, b) => a * b;

function main() {
  console.log(add(2, 3));
  console.log(sub(10, 5));
}`;

const SAMPLE_B = `const add = (a, b) => a + b;
const sub = (a, b) => a - b;
const mul = (a, b) => a * b;
const div = (a, b) => a / b;

function main() {
  console.log(add(2, 3));
  console.log(sub(10, 5));
  console.log(mul(4, 6));
  console.log(div(20, 4));
}`;

export default function DiffPage() {
  const [a, setA] = useState(SAMPLE_A);
  const [b, setB] = useState(SAMPLE_B);
  const [view, setView] = useState<'split' | 'unified'>('split');
  const [ignoreWs, setIgnoreWs] = useState(false);

  const ops = useMemo(() => {
    const aa = a.split('\n');
    const bb = b.split('\n');
    if (ignoreWs) {
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
      // diff on normalised lines but render the original text
      const aNorm = aa.map(norm);
      const bNorm = bb.map(norm);
      const raw = lineDiff(aNorm, bNorm);
      return raw.map((o) => {
        if (o.type === 'equal') return { ...o, text: aa[o.ai] } as Op;
        if (o.type === 'remove') return { ...o, text: aa[o.ai] } as Op;
        return { ...o, text: bb[o.bi] } as Op;
      });
    }
    return lineDiff(aa, bb);
  }, [a, b, ignoreWs]);

  const rows = useMemo(() => toRows(ops), [ops]);

  const stats = useMemo(() => {
    let add = 0, del = 0, eq = 0;
    for (const o of ops) {
      if (o.type === 'add') add++;
      else if (o.type === 'remove') del++;
      else eq++;
    }
    return { add, del, eq };
  }, [ops]);

  const unifiedHunks = useMemo(() => {
    // Group ops into hunks with context lines around changes
    const CTX = 3;
    const hunks: Op[][] = [];
    let curr: Op[] = [];
    let eqRun = 0;
    for (const op of ops) {
      if (op.type === 'equal') {
        curr.push(op);
        eqRun++;
      } else {
        eqRun = 0;
        curr.push(op);
      }
    }
    if (curr.length > 0) hunks.push(curr);
    // Trim leading/trailing context in each hunk
    return hunks.map((h) => {
      const first = h.findIndex((o) => o.type !== 'equal');
      const last = h.findLastIndex((o) => o.type !== 'equal');
      if (first < 0) return h;
      const start = Math.max(0, first - CTX);
      const end = Math.min(h.length, last + CTX + 1);
      return h.slice(start, end);
    });
  }, [ops]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-diff">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">diff</span>
        </div>

        <header className="diff-hd">
          <h1>diff<span className="dot">.</span></h1>
          <p className="sub">
            paste two blobs — see every changed line highlighted. lcs-based, line-level. split view
            aligns matching lines side by side; unified view collapses into a patch-style hunk list.
          </p>
        </header>

        <section className="diff-io">
          <div className="diff-col">
            <header className="diff-col-hd">
              <span>── a · original</span>
              <span className="diff-col-ct">{a.split('\n').length} lines</span>
            </header>
            <textarea
              className="diff-ta"
              value={a}
              onChange={(e) => setA(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="diff-col">
            <header className="diff-col-hd">
              <span>── b · changed</span>
              <span className="diff-col-ct">{b.split('\n').length} lines</span>
            </header>
            <textarea
              className="diff-ta"
              value={b}
              onChange={(e) => setB(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </section>

        <section className="diff-toolbar">
          <div className="diff-stats">
            <span className="s-add">+{stats.add}</span>
            <span className="s-del">−{stats.del}</span>
            <span className="s-eq">={stats.eq}</span>
            <span className="s-total">{ops.length} total</span>
          </div>
          <div className="diff-controls">
            <label className="diff-check">
              <input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} />
              ignore whitespace
            </label>
            <div className="diff-pill">
              <button
                className={`diff-pill-btn ${view === 'split' ? 'on' : ''}`}
                onClick={() => setView('split')}
              >split</button>
              <button
                className={`diff-pill-btn ${view === 'unified' ? 'on' : ''}`}
                onClick={() => setView('unified')}
              >unified</button>
            </div>
          </div>
        </section>

        {stats.add === 0 && stats.del === 0 ? (
          <div className="diff-nodiff">✓ identical — no differences found</div>
        ) : view === 'split' ? (
          <section className="diff-view">
            <table className="diff-split">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="diff-ln diff-ln-a">{r.left && r.left.kind !== 'pad' ? r.left.ln : ''}</td>
                    <td className={`diff-cell d-${r.left?.kind ?? 'pad'}`}>
                      {r.left && r.left.kind !== 'pad' ? (
                        <span className="diff-prefix">{r.left.kind === 'del' ? '−' : ' '}</span>
                      ) : null}
                      <span className="diff-text">{r.left?.text ?? ''}</span>
                    </td>
                    <td className="diff-ln diff-ln-b">{r.right && r.right.kind !== 'pad' ? r.right.ln : ''}</td>
                    <td className={`diff-cell d-${r.right?.kind ?? 'pad'}`}>
                      {r.right && r.right.kind !== 'pad' ? (
                        <span className="diff-prefix">{r.right.kind === 'add' ? '+' : ' '}</span>
                      ) : null}
                      <span className="diff-text">{r.right?.text ?? ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="diff-view">
            {unifiedHunks.map((hunk, hi) => (
              <article key={hi} className="diff-hunk">
                <header className="diff-hunk-hd">
                  @@ hunk {hi + 1} @@
                </header>
                <pre className="diff-unified">
                  {hunk.map((op, i) => {
                    const kind = op.type === 'equal' ? 'eq' : op.type === 'add' ? 'add' : 'del';
                    const prefix = op.type === 'equal' ? ' ' : op.type === 'add' ? '+' : '−';
                    const ln = op.type === 'remove' ? op.ai + 1 : op.type === 'add' ? op.bi + 1 : op.ai + 1;
                    return (
                      <div key={i} className={`diff-uline d-${kind}`}>
                        <span className="diff-uln">{ln}</span>
                        <span className="diff-prefix">{prefix}</span>
                        <span className="diff-text">{op.text || ' '}</span>
                      </div>
                    );
                  })}
                </pre>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

const CSS = `
  .shell-diff { max-width: 1400px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .diff-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .diff-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .diff-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .diff-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }

  .diff-io {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin: var(--sp-5) 0 var(--sp-3);
  }
  .diff-col {
    display: flex; flex-direction: column;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    min-height: 220px;
  }
  .diff-col-hd {
    display: flex; justify-content: space-between;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .diff-col-ct { color: var(--color-accent-dim); }
  .diff-ta {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    padding: var(--sp-3);
    resize: vertical;
    white-space: pre;
    overflow: auto;
  }

  .diff-toolbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: var(--sp-3);
    padding: var(--sp-2) 0;
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .diff-stats {
    display: flex; gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .diff-stats .s-add { color: var(--color-accent); }
  .diff-stats .s-del { color: var(--color-alert); }
  .diff-stats .s-eq { color: var(--color-fg-faint); }
  .diff-stats .s-total { color: var(--color-fg-faint); margin-left: var(--sp-3); }

  .diff-controls {
    display: flex; gap: var(--sp-3); align-items: center;
    flex-wrap: wrap;
  }
  .diff-check {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim); cursor: pointer;
  }
  .diff-check input { accent-color: var(--color-accent); }
  .diff-pill {
    display: inline-flex;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .diff-pill-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 0;
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .diff-pill-btn.on {
    background: var(--color-accent);
    color: #000;
  }

  .diff-nodiff {
    padding: var(--sp-5);
    text-align: center;
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, transparent);
  }

  .diff-view {
    padding-bottom: var(--sp-10);
  }

  .diff-split {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    table-layout: fixed;
  }
  .diff-split td {
    padding: 2px 6px;
    vertical-align: top;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .diff-ln {
    width: 48px;
    text-align: right;
    color: var(--color-fg-ghost);
    background: var(--color-bg-raised);
    border-right: 1px solid var(--color-border);
    user-select: none;
    font-size: var(--fs-xs);
  }
  .diff-cell {
    font-size: var(--fs-sm);
    line-height: 1.5;
    overflow-x: auto;
  }
  .d-eq { color: var(--color-fg-dim); }
  .d-add {
    background: color-mix(in oklch, var(--color-accent) 12%, transparent);
    color: var(--color-accent);
  }
  .d-del {
    background: color-mix(in srgb, var(--color-alert) 12%, transparent);
    color: var(--color-alert);
  }
  .d-pad {
    background: repeating-linear-gradient(
      45deg,
      transparent 0 4px,
      var(--color-border) 4px 5px
    );
  }
  .diff-prefix {
    display: inline-block;
    width: 1.5ch;
    color: inherit;
    opacity: 0.5;
  }
  .diff-text { white-space: pre-wrap; word-break: break-word; }

  .diff-hunk {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    margin-bottom: var(--sp-3);
  }
  .diff-hunk-hd {
    padding: 4px var(--sp-3);
    background: var(--color-bg-raised);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .diff-unified {
    margin: 0;
    padding: var(--sp-2) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    overflow-x: auto;
  }
  .diff-uline {
    display: grid;
    grid-template-columns: 48px 20px 1fr;
    padding: 1px var(--sp-3);
    align-items: baseline;
  }
  .diff-uln {
    color: var(--color-fg-ghost);
    font-size: var(--fs-xs);
    text-align: right;
    padding-right: var(--sp-2);
    user-select: none;
  }

  @media (max-width: 800px) {
    .diff-io { grid-template-columns: 1fr; }
    .diff-split { font-size: var(--fs-xs); }
    .diff-ln { width: 36px; }
  }
`;
