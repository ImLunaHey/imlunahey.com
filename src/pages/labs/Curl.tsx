import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { HL_CSS, highlightJs } from '../../lib/highlight-js';

type Parsed = {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: string | null;
  basicAuth?: { user: string; pass: string };
  followRedirects: boolean;
};

function tokenize(cmd: string): string[] {
  // shell-like tokenizer: handles single quotes, double quotes, backslash escapes, line continuations
  const clean = cmd.replace(/\\\n\s*/g, ' ').trim();
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quote) {
      if (c === '\\' && quote === '"' && i + 1 < clean.length) {
        cur += clean[++i];
      } else if (c === quote) {
        quote = null;
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '\\' && i + 1 < clean.length) { cur += clean[++i]; continue; }
    if (/\s/.test(c)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

function parseCurl(cmd: string): { ok: true; result: Parsed } | { ok: false; error: string } {
  if (!cmd.trim()) return { ok: false, error: 'empty' };
  const tokens = tokenize(cmd);
  if (tokens[0] !== 'curl') return { ok: false, error: "expected command to start with 'curl'" };

  let url = '';
  let method = 'GET';
  const headers: Array<[string, string]> = [];
  let body: string | null = null;
  let basicAuth: Parsed['basicAuth'];
  let followRedirects = false;
  let explicitMethod = false;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i];
    if (t === '-X' || t === '--request') { method = next(); explicitMethod = true; }
    else if (t === '-H' || t === '--header') {
      const v = next();
      const idx = v.indexOf(':');
      if (idx > 0) headers.push([v.slice(0, idx).trim(), v.slice(idx + 1).trim()]);
    }
    else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-urlencode') {
      body = (body ? body + '&' : '') + next();
      if (!explicitMethod) method = 'POST';
    }
    else if (t === '--json') {
      body = next();
      headers.push(['Content-Type', 'application/json']);
      headers.push(['Accept', 'application/json']);
      if (!explicitMethod) method = 'POST';
    }
    else if (t === '-F' || t === '--form') {
      // multipart — keep as comment hint
      body = (body ? body + '\n' : '') + '// form: ' + next();
      if (!explicitMethod) method = 'POST';
    }
    else if (t === '-u' || t === '--user') {
      const v = next();
      const idx = v.indexOf(':');
      basicAuth = { user: idx > 0 ? v.slice(0, idx) : v, pass: idx > 0 ? v.slice(idx + 1) : '' };
    }
    else if (t === '-L' || t === '--location') followRedirects = true;
    else if (t === '-A' || t === '--user-agent') headers.push(['User-Agent', next()]);
    else if (t === '-e' || t === '--referer') headers.push(['Referer', next()]);
    else if (t === '-b' || t === '--cookie') headers.push(['Cookie', next()]);
    else if (t === '--compressed' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-v' || t === '--verbose' || t === '-i' || t === '--include' || t === '-I' || t === '--head') { /* ignore */ }
    else if (t === '-o' || t === '--output') { next(); /* ignore output path */ }
    else if (t === '-w' || t === '--write-out') { next(); /* ignore write-out format */ }
    else if (t === '-m' || t === '--max-time' || t === '--connect-timeout') { next(); /* ignore timeouts */ }
    else if (t.startsWith('--') || (t.startsWith('-') && t.length === 2)) {
      // unknown flag — skip the value conservatively if there's one
      const nxt = tokens[i + 1];
      if (nxt && !nxt.startsWith('-') && !nxt.startsWith('http')) i++;
    }
    else if (!url && (t.startsWith('http://') || t.startsWith('https://') || /^[a-z][a-z0-9.-]+\./i.test(t))) {
      url = t;
    }
  }

  if (!url) return { ok: false, error: 'no url found in command' };
  return { ok: true, result: { url, method, headers, body, basicAuth, followRedirects } };
}

function toFetch(p: Parsed): string {
  const headersObj: Record<string, string> = {};
  for (const [k, v] of p.headers) headersObj[k] = v;
  if (p.basicAuth) {
    headersObj['Authorization'] = `Basic btoa("${p.basicAuth.user}:${p.basicAuth.pass}")`;
  }

  const init: string[] = [];
  if (p.method !== 'GET') init.push(`method: ${JSON.stringify(p.method)}`);
  if (Object.keys(headersObj).length > 0) {
    init.push(`headers: ${JSON.stringify(headersObj, null, 2).split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')}`);
  }
  if (p.body !== null) init.push(`body: ${JSON.stringify(p.body)}`);
  if (p.followRedirects) init.push(`redirect: "follow"`);

  if (init.length === 0) return `await fetch(${JSON.stringify(p.url)});`;
  return `await fetch(${JSON.stringify(p.url)}, {\n  ${init.join(',\n  ')},\n});`;
}

function toAxios(p: Parsed): string {
  const headersObj: Record<string, string> = {};
  for (const [k, v] of p.headers) headersObj[k] = v;
  const cfg: string[] = [];
  cfg.push(`url: ${JSON.stringify(p.url)}`);
  if (p.method !== 'GET') cfg.push(`method: ${JSON.stringify(p.method.toLowerCase())}`);
  if (Object.keys(headersObj).length > 0) {
    cfg.push(`headers: ${JSON.stringify(headersObj, null, 2).split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')}`);
  }
  if (p.body !== null) cfg.push(`data: ${JSON.stringify(p.body)}`);
  if (p.basicAuth) cfg.push(`auth: { username: ${JSON.stringify(p.basicAuth.user)}, password: ${JSON.stringify(p.basicAuth.pass)} }`);
  return `await axios({\n  ${cfg.join(',\n  ')},\n});`;
}

function toNode(p: Parsed): string {
  return `const res = ${toFetch(p).replace(/^await /, 'await ')}\nconst text = await res.text();\nconsole.log(res.status, text);`;
}

const SAMPLE = `curl -X POST 'https://bsky.social/xrpc/com.atproto.server.createSession' \\
  -H 'Content-Type: application/json' \\
  --data '{"identifier":"handle.bsky.social","password":"..."}'`;

export default function CurlPage() {
  const [input, setInput] = useState(SAMPLE);
  const parsed = useMemo(() => parseCurl(input), [input]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cu">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">curl → fetch</span>
        </div>

        <header className="cu-hd">
          <h1>curl → fetch<span className="dot">.</span></h1>
          <p className="sub">
            paste a <code>curl</code> command — get a <code>fetch()</code> call (and axios) ready to
            drop into your js. handles flags: <code>-X</code>, <code>-H</code>, <code>-d</code>,{' '}
            <code>-u</code>, <code>-L</code>, <code>--json</code>, and more.
          </p>
        </header>

        <textarea
          className="cu-ta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          spellCheck={false}
          autoComplete="off"
          placeholder="curl https://example.com"
        />

        {!parsed.ok ? (
          <div className="cu-err">✗ {parsed.error}</div>
        ) : (
          <>
            <section className="cu-parsed">
              <div className="cu-parsed-hd">── parsed</div>
              <div className="cu-parsed-grid">
                <div><span>method</span><b className="t-accent">{parsed.result.method}</b></div>
                <div><span>url</span><b>{parsed.result.url}</b></div>
                <div><span>headers</span><b>{parsed.result.headers.length}</b></div>
                <div><span>body</span><b>{parsed.result.body ? `${parsed.result.body.length} bytes` : '—'}</b></div>
                {parsed.result.basicAuth ? <div><span>auth</span><b>basic · {parsed.result.basicAuth.user}</b></div> : null}
                {parsed.result.followRedirects ? <div><span>redirect</span><b>follow</b></div> : null}
              </div>
            </section>

            <section className="cu-outputs">
              <OutputBlock label="fetch" code={toFetch(parsed.result)} onCopy={copy} />
              <OutputBlock label="axios" code={toAxios(parsed.result)} onCopy={copy} />
              <OutputBlock label="fetch + read body" code={toNode(parsed.result)} onCopy={copy} />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function OutputBlock({ label, code, onCopy }: { label: string; code: string; onCopy: (s: string) => void }) {
  return (
    <article className="cu-block">
      <header className="cu-block-hd">
        <span>── {label}</span>
        <button className="cu-copy" onClick={() => onCopy(code)}>copy</button>
      </header>
      <pre className="cu-code">{highlightJs(code)}</pre>
    </article>
  );
}

const CSS = `
  .shell-cu { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .cu-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .cu-hd h1 { font-family: var(--font-display); font-size: clamp(44px, 7vw, 88px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .cu-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .cu-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }
  .cu-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .cu-ta {
    width: 100%;
    margin: var(--sp-5) 0 var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: vertical;
    outline: 0;
    white-space: pre;
  }
  .cu-ta:focus { border-color: var(--color-accent-dim); }

  .cu-err {
    padding: var(--sp-3);
    color: var(--color-alert);
    border: 1px solid var(--color-alert-dim);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .cu-parsed {
    margin-bottom: var(--sp-4);
    padding: var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .cu-parsed-hd { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
  .cu-parsed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .cu-parsed-grid > div { display: flex; flex-direction: column; gap: 2px; }
  .cu-parsed-grid > div span { color: var(--color-fg-faint); font-size: var(--fs-xs); text-transform: lowercase; }
  .cu-parsed-grid > div b { color: var(--color-fg); font-weight: 400; word-break: break-word; }

  .cu-outputs { display: flex; flex-direction: column; gap: var(--sp-3); padding-bottom: var(--sp-10); }
  .cu-block {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .cu-block-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .cu-copy {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 2px 8px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .cu-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .cu-code {
    padding: var(--sp-3);
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }
  ${HL_CSS}
`;
