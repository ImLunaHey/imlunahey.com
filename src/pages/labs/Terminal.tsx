import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Node =
  | { kind: 'dir'; name: string; children: Node[]; dyn?: true }
  | { kind: 'file'; name: string; href?: string; note?: string; external?: true };

const LAB_FILES: Node[] = [
  { kind: 'file', name: 'wordle' }, { kind: 'file', name: 'snake' },
  { kind: 'file', name: 'typing' }, { kind: 'file', name: 'life' },
  { kind: 'file', name: 'palette' }, { kind: 'file', name: 'infinite-canvas' },
  { kind: 'file', name: 'jetstream' }, { kind: 'file', name: 'plc-log' },
  { kind: 'file', name: 'lexicon' }, { kind: 'file', name: 'feed' },
  { kind: 'file', name: 'css-battles' }, { kind: 'file', name: 'car-explorer' },
  { kind: 'file', name: 'at-uri' }, { kind: 'file', name: 'verse-reveal' },
  { kind: 'file', name: 'og-preview' }, { kind: 'file', name: 'jwt' },
  { kind: 'file', name: 'cron' }, { kind: 'file', name: 'tid' },
  { kind: 'file', name: 'pdf-uploader' }, { kind: 'file', name: 'list-cleaner' },
  { kind: 'file', name: 'screenshot-maker' }, { kind: 'file', name: 'bsky-composer' },
  { kind: 'file', name: 'fingerprint' }, { kind: 'file', name: 'whois' },
  { kind: 'file', name: 'ids' }, { kind: 'file', name: 'unicode' },
  { kind: 'file', name: 'handle-sniper' }, { kind: 'file', name: 'did-log' },
  { kind: 'file', name: 'thread-tree' }, { kind: 'file', name: 'pds-health' },
  { kind: 'file', name: 'regex' }, { kind: 'file', name: 'encode' },
  { kind: 'file', name: 'diff' }, { kind: 'file', name: 'lexicon-validator' },
  { kind: 'file', name: 'firehose-stats' }, { kind: 'file', name: 'dns' },
  { kind: 'file', name: 'json' }, { kind: 'file', name: 'colour' },
  { kind: 'file', name: 'timestamp' }, { kind: 'file', name: 'matrix' },
  { kind: 'file', name: 'terminal' },
];

const ROOT: Node = {
  kind: 'dir',
  name: '/',
  children: [
    { kind: 'file', name: 'readme.txt' },
    { kind: 'file', name: 'about' },
    { kind: 'dir', name: 'blog', children: [], dyn: true },
    { kind: 'dir', name: 'projects', children: [], dyn: true },
    { kind: 'dir', name: 'gallery', children: [] },
    { kind: 'dir', name: 'watching', children: [], dyn: true },
    { kind: 'dir', name: 'games', children: [], dyn: true },
    { kind: 'dir', name: 'library', children: [] },
    { kind: 'dir', name: 'bookmarks', children: [] },
    { kind: 'dir', name: 'homelab', children: [] },
    { kind: 'dir', name: 'music', children: [] },
    { kind: 'dir', name: 'globe', children: [] },
    { kind: 'dir', name: 'guestbook', children: [] },
    { kind: 'dir', name: 'ai', children: [] },
    { kind: 'dir', name: 'uses', children: [] },
    { kind: 'dir', name: 'health', children: [] },
    { kind: 'dir', name: 'labs', children: LAB_FILES },
  ],
};

function normalize(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out;
}

function resolvePath(cwd: string[], input: string): string[] {
  if (input.startsWith('/')) return normalize(input.slice(1).split('/'));
  return normalize([...cwd, ...input.split('/')]);
}

function nodeAt(path: string[]): Node | null {
  let cur: Node = ROOT;
  for (const p of path) {
    if (cur.kind !== 'dir') return null;
    const next = cur.children.find((c) => c.name === p);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function displayPath(path: string[]): string {
  return '/' + path.join('/');
}

function padR(s: string, n: number) { return s.length >= n ? s : s + ' '.repeat(n - s.length); }

const HELP = `available commands:
  ls [path]        list files in a directory
  cd <path>        change directory (.. supported)
  pwd              print working directory
  cat <path>       read a file or dir summary
  open <path>      navigate the browser to a path
  tree             list every known page
  echo <text>      print text
  date             current date + time
  whoami           about the site owner
  uptime           session + site uptime
  neofetch         pretty system info
  history          show command history
  clear            clear the screen
  help             this message
  exit             go home`;

const README = `imlunahey.com — a personal site with way too many labs.

this shell wraps the router: every path you can visit in a browser
is also a "file" you can cat or open from here.

try:
  ls /labs
  cat readme.txt
  open /games
  neofetch
  help`;

const ABOUT = `luna · software engineer in london, uk.
i make things for the web and bluesky. typescript, react, tailwind.
this shell is a lab — type 'help' for commands.`;

type Entry =
  | { kind: 'cmd'; cwd: string[]; text: string }
  | { kind: 'out'; node: ReactNode }
  | { kind: 'err'; text: string };

export default function TerminalPage() {
  const [cwd, setCwd] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Entry[]>([
    { kind: 'out', node: <pre className="t-ascii">{BANNER}</pre> },
    { kind: 'out', node: <span className="t-dim">type <b className="t-accent">help</b> for commands · <b className="t-accent">ls</b> to browse · <b className="t-accent">open /home</b> to escape.</span> },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history]);

  const prompt = useMemo(() => (
    <>
      <span className="t-user">luna</span>
      <span className="t-at">@</span>
      <span className="t-host">imlunahey</span>
      <span className="t-colon">:</span>
      <span className="t-path">{displayPath(cwd) || '/'}</span>
      <span className="t-dollar">$</span>
    </>
  ), [cwd]);

  function push(e: Entry) {
    setHistory((h) => [...h, e]);
  }

  function run(raw: string) {
    const text = raw.trim();
    if (!text) { push({ kind: 'cmd', cwd, text: '' }); return; }
    push({ kind: 'cmd', cwd, text });
    setCmdHistory((h) => [...h, text]);
    setCmdIdx(null);

    const [name, ...args] = text.split(/\s+/);
    const arg = args.join(' ');

    switch (name) {
      case 'help':
        push({ kind: 'out', node: <pre>{HELP}</pre> });
        return;
      case 'clear':
      case 'cls':
        setHistory([]);
        return;
      case 'pwd':
        push({ kind: 'out', node: <span>{displayPath(cwd) || '/'}</span> });
        return;
      case 'echo':
        push({ kind: 'out', node: <span>{arg}</span> });
        return;
      case 'date':
        push({ kind: 'out', node: <span>{new Date().toString()}</span> });
        return;
      case 'whoami':
        push({ kind: 'out', node: <pre>{ABOUT}</pre> });
        return;
      case 'uptime': {
        const secs = Math.round((Date.now() - startedAt.current) / 1000);
        push({ kind: 'out', node: <span>session: {secs}s · site: since 2023</span> });
        return;
      }
      case 'history':
        push({ kind: 'out', node: (
          <pre>{cmdHistory.map((h, i) => `${String(i + 1).padStart(3, ' ')}  ${h}`).join('\n') || '(empty)'}</pre>
        ) });
        return;
      case 'neofetch':
        push({ kind: 'out', node: <pre className="t-neo">{neofetch(Date.now() - startedAt.current)}</pre> });
        return;
      case 'tree':
        push({ kind: 'out', node: <pre>{renderTree(ROOT, '')}</pre> });
        return;
      case 'exit':
        navigate({ to: '/' as never });
        return;
      case 'ls': {
        const target = arg ? resolvePath(cwd, arg) : cwd;
        const node = nodeAt(target);
        if (!node) { push({ kind: 'err', text: `ls: ${arg || displayPath(target)}: no such file or directory` }); return; }
        if (node.kind === 'file') { push({ kind: 'out', node: <span>{node.name}</span> }); return; }
        const cols = 4;
        const rows: string[] = [];
        for (let i = 0; i < node.children.length; i += cols) {
          const group = node.children.slice(i, i + cols);
          rows.push(group.map((c) => padR((c.kind === 'dir' ? c.name + '/' : c.name), 22)).join(''));
        }
        if (node.children.length === 0 && node.dyn !== true) {
          push({ kind: 'out', node: <span className="t-dim">(empty)</span> }); return;
        }
        if (node.dyn && node.children.length === 0) {
          push({
            kind: 'out',
            node: <span className="t-dim">(dynamic — open with <b className="t-accent">open {displayPath(target)}</b>)</span>,
          });
          return;
        }
        push({ kind: 'out', node: (
          <pre className="t-ls">{node.children.map((c) => (
            <span key={c.name} className={c.kind === 'dir' ? 't-accent' : ''}>
              {c.kind === 'dir' ? c.name + '/' : c.name}{'\n'}
            </span>
          ))}</pre>
        ) });
        return;
      }
      case 'cd': {
        if (!arg || arg === '~' || arg === '/') { setCwd([]); return; }
        const target = resolvePath(cwd, arg);
        const node = nodeAt(target);
        if (!node) { push({ kind: 'err', text: `cd: ${arg}: no such file or directory` }); return; }
        if (node.kind !== 'dir') { push({ kind: 'err', text: `cd: ${arg}: not a directory` }); return; }
        setCwd(target);
        return;
      }
      case 'cat': {
        if (!arg) { push({ kind: 'err', text: 'cat: missing operand' }); return; }
        const target = resolvePath(cwd, arg);
        const name = target[target.length - 1] ?? '';
        if (name === 'readme.txt') { push({ kind: 'out', node: <pre>{README}</pre> }); return; }
        if (name === 'about') { push({ kind: 'out', node: <pre>{ABOUT}</pre> }); return; }
        const node = nodeAt(target);
        if (!node) { push({ kind: 'err', text: `cat: ${arg}: no such file or directory` }); return; }
        const path = '/' + target.join('/');
        push({ kind: 'out', node: (
          <span>
            this is a live page. <button className="t-link" onClick={() => navigate({ to: path as never })}>open {path}</button>{' '}
            in the browser to see it.
          </span>
        ) });
        return;
      }
      case 'open': {
        const path = arg ? (arg.startsWith('/') ? arg : '/' + resolvePath(cwd, arg).join('/')) : '/';
        push({ kind: 'out', node: <span>opening <b>{path}</b>…</span> });
        navigate({ to: path as never });
        return;
      }
      default:
        push({ kind: 'err', text: `command not found: ${name} — try 'help'` });
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      run(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const next = cmdIdx === null ? cmdHistory.length - 1 : Math.max(0, cmdIdx - 1);
      setCmdIdx(next);
      setInput(cmdHistory[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdIdx === null) return;
      const next = cmdIdx + 1;
      if (next >= cmdHistory.length) { setCmdIdx(null); setInput(''); }
      else { setCmdIdx(next); setInput(cmdHistory[next] ?? ''); }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault(); setHistory([]);
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault(); push({ kind: 'cmd', cwd, text: input + '^C' }); setInput('');
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-term" onClick={() => inputRef.current?.focus()}>
        <div className="term-crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">terminal</span>
        </div>

        <div className="term-screen">
          {history.map((e, i) => (
            <div key={i} className="term-line">
              {e.kind === 'cmd' ? (
                <>
                  <span className="term-prompt">
                    <span className="t-user">luna</span>
                    <span className="t-at">@</span>
                    <span className="t-host">imlunahey</span>
                    <span className="t-colon">:</span>
                    <span className="t-path">{displayPath(e.cwd) || '/'}</span>
                    <span className="t-dollar">$</span>
                  </span>
                  <span className="term-input">{e.text}</span>
                </>
              ) : e.kind === 'err' ? (
                <span className="term-err">{e.text}</span>
              ) : (
                <div className="term-out">{e.node}</div>
              )}
            </div>
          ))}
          <form
            className="term-live"
            onSubmit={(ev) => { ev.preventDefault(); run(input); setInput(''); }}
          >
            <span className="term-prompt">{prompt}</span>
            <input
              ref={inputRef}
              className="term-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <span className="term-cursor" aria-hidden>▊</span>
          </form>
          <div ref={bottomRef} />
        </div>
      </main>
    </>
  );
}

function renderTree(node: Node, prefix: string): string {
  if (node.kind !== 'dir') return prefix + node.name;
  const lines: string[] = [prefix + node.name + '/'];
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    const last = i === children.length - 1;
    lines.push(prefix + (last ? '└── ' : '├── ') + (c.kind === 'dir' ? c.name + '/' : c.name));
    if (c.kind === 'dir' && c.children.length > 0 && c.children.length <= 12) {
      for (let j = 0; j < c.children.length; j++) {
        const d = c.children[j];
        const lastD = j === c.children.length - 1;
        lines.push(prefix + (last ? '    ' : '│   ') + (lastD ? '└── ' : '├── ') + (d.kind === 'dir' ? d.name + '/' : d.name));
      }
    }
  }
  return lines.join('\n');
}

function neofetch(sessionMs: number): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '—';
  const shortUa = ua.match(/(Firefox|Chrome|Safari|Edge)\/[\d.]+/)?.[0] ?? ua.slice(0, 40);
  const secs = Math.round(sessionMs / 1000);
  return `        ██████████
      ██░░░░░░░░░░██
    ██░░░█ █░░░░░░░██       luna@imlunahey
    ██░░░░░░░░░░░░░██       ─────────────────
    ██░░░░  ▀▀▀  ░░██       os        web
    ██░░░░░░░░░░░░░██       shell     /labs/terminal
      ██░░░░░░░░░██         resolution dynamic
        ██████████          browser   ${shortUa}
                            timezone  ${tz}
                            uptime    ${secs}s this session
                            font      Doto + JetBrains Mono
                            palette   phosphor green`;
}

const BANNER = `  ┬  ┬ ┬┌┐┌┌─┐   ┌┐ ┌─┐┬─┐┌┐┌┌─┐┌┬┐
  │  │ │││││├─┤───├┴┐├─┤├┬┘│││├┤  │
  ┴─┘└─┘┘└┘┴ ┴   └─┘┴ ┴┴└─┘└┘└─┘ ┴
  imlunahey.com · v0.1`;

const CSS = `
  .shell-term {
    max-width: 100%;
    margin: 0 auto;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    min-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
  }
  .term-crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .term-crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .term-crumbs a:hover { color: var(--color-accent); }
  .term-crumbs .sep { margin: 0 6px; }
  .term-crumbs .last { color: var(--color-accent); }

  .term-screen {
    flex: 1;
    background: #020402;
    border: 1px solid var(--color-border);
    padding: var(--sp-3) var(--sp-4);
    font-family: "JetBrains Mono Variable", ui-monospace, monospace;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--color-fg);
    overflow-y: auto;
    max-height: calc(100vh - 130px);
    cursor: text;
    box-shadow: inset 0 0 40px rgba(0, 40, 0, 0.2);
  }

  .term-line { margin: 0; }
  .term-line + .term-line { margin-top: 1px; }

  .term-prompt {
    user-select: none;
    display: inline-flex;
    gap: 0;
    white-space: nowrap;
    margin-right: 8px;
  }
  .t-user { color: var(--color-accent); text-shadow: 0 0 4px var(--accent-glow); }
  .t-at { color: var(--color-fg-faint); }
  .t-host { color: #7cd3f7; }
  .t-colon { color: var(--color-fg-faint); }
  .t-path { color: var(--color-warn); }
  .t-dollar { color: var(--color-fg-faint); margin: 0 6px; }
  .t-dim { color: var(--color-fg-faint); }

  .term-input { color: var(--color-fg); }
  .term-out { color: var(--color-fg-dim); white-space: pre-wrap; }
  .term-out pre { margin: 0; font-family: inherit; font-size: inherit; color: inherit; white-space: pre; overflow-x: auto; }
  .term-out .t-ls { color: inherit; }
  .term-out .t-neo { color: var(--color-accent); }
  .term-out .t-ascii { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .term-err { color: var(--color-alert); }
  .t-link {
    background: transparent; border: 0; padding: 0;
    color: var(--color-accent); cursor: pointer;
    font-family: inherit; font-size: inherit;
    text-decoration: underline;
  }

  .term-live {
    display: flex;
    align-items: baseline;
    margin-top: 2px;
  }
  .term-field {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    font-family: inherit;
    font-size: inherit;
    padding: 0;
    caret-color: transparent;
  }
  .term-cursor {
    color: var(--color-accent);
    animation: term-blink 1s steps(1) infinite;
    margin-left: -4px;
    pointer-events: none;
  }
  @keyframes term-blink {
    50% { opacity: 0; }
  }
`;
