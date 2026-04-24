import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  bskyPostWebUrl,
  fetchBacklinks,
  fetchPosts,
  type PostView,
} from '../../lib/atproto-helpers';

/**
 * Walks the quote graph downward: post → its quote-posts → THEIR quote
 * posts → etc. Each level is one constellation query + one getPosts
 * hydration. Capped at MAX_DEPTH and MAX_PER_NODE to prevent exploding
 * on viral posts.
 */

const MAX_DEPTH = 4;
const MAX_PER_NODE = 12;
const SOURCE = 'app.bsky.feed.post:embed.record.uri';

type Node = {
  post: PostView;
  children: Node[];
  truncated: number; // how many quotes we didn't fetch at this level
};

function normaliseSubject(raw: string): string | null {
  const s = raw.trim();
  if (s.startsWith('at://')) return s;
  const m = /^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(s);
  if (m && m[1].startsWith('did:')) return `at://${m[1]}/app.bsky.feed.post/${m[2]}`;
  return null;
}

async function buildTree(root: string, depth: number): Promise<Node | null> {
  const posts = await fetchPosts([root]);
  const post = posts.get(root);
  if (!post) return null;
  if (depth === 0) return { post, children: [], truncated: 0 };
  // query the first MAX_PER_NODE quotes of this post
  const { records, total } = await fetchBacklinks(root, SOURCE, { limit: MAX_PER_NODE });
  const childUris = records.map((r) => `at://${r.did}/${r.collection}/${r.rkey}`);
  const childTrees = await Promise.all(childUris.map((u) => buildTree(u, depth - 1)));
  const children = childTrees.filter((n): n is Node => n !== null);
  const truncated = Math.max(0, total - children.length);
  return { post, children, truncated };
}

function countNodes(n: Node): number {
  return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

export default function QuoteTreePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    navigate({ to: '/labs/quote-tree' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-qt">
        <header className="page-hd">
          <div className="label">~/labs/quote-tree</div>
          <h1>quote tree<span className="dot">.</span></h1>
          <p className="sub">
            paste a bluesky post — render the tree of quote-posts-of-quote-posts, recursively.
            capped at depth {MAX_DEPTH} and {MAX_PER_NODE} quotes per node so viral posts don&apos;t
            melt the browser. social-drama topology viewer.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="at://did:plc:.../app.bsky.feed.post/... or bsky.app url"
            aria-label="post at-uri or bsky.app url"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">trace →</button>
        </form>

        {search.q ? <Tree raw={search.q} /> : (
          <div className="empty">paste a post above to see its quote tree.</div>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">constellation.microcosm.blue · public.api.bsky.app</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Tree({ raw }: { raw: string }) {
  const subject = normaliseSubject(raw);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tree, setTree] = useState<Node | null>(null);

  useEffect(() => {
    if (!subject) { setState('error'); return; }
    let cancelled = false;
    setState('loading');
    setTree(null);
    (async () => {
      try {
        const t = await buildTree(subject, MAX_DEPTH);
        if (cancelled) return;
        setTree(t);
        setState(t ? 'ready' : 'error');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [subject]);

  if (!subject) return <div className="err">expected an at-uri or bsky.app url for a post.</div>;
  if (state === 'loading') return <div className="loading">walking the quote graph (this can take a few seconds for viral posts)…</div>;
  if (state === 'error' || !tree) return <div className="err">couldn&apos;t build the tree — post missing or constellation unreachable.</div>;

  const total = countNodes(tree);

  return (
    <>
      <div className="stats">
        <div><span className="k">posts in tree</span><b>{total}</b></div>
        <div><span className="k">max depth</span><b>{MAX_DEPTH}</b></div>
        <div><span className="k">per-node cap</span><b>{MAX_PER_NODE}</b></div>
      </div>
      <ul className="tree" role="tree">
        <NodeView node={tree} depth={0} isRoot />
      </ul>
    </>
  );
}

function NodeView({ node, depth, isRoot }: { node: Node; depth: number; isRoot?: boolean }) {
  const { post } = node;
  const text = post.record.text ?? '';
  const snippet = text.length > 200 ? text.slice(0, 197) + '…' : text;
  return (
    <li className={'tnode' + (isRoot ? ' root' : '')}>
      <a href={bskyPostWebUrl(post)} target="_blank" rel="noopener noreferrer" className="t-link">
        {post.author.avatar ? <img src={post.author.avatar} alt="" className="t-avatar" /> : <div className="t-avatar empty" />}
        <div className="t-body">
          <div className="t-who">
            <b>{post.author.displayName || post.author.handle}</b>
            <span className="t-handle">@{post.author.handle}</span>
            {post.indexedAt ? <span className="t-when">· {post.indexedAt.slice(0, 10)}</span> : null}
          </div>
          {snippet ? <div className="t-text">{snippet}</div> : null}
          <div className="t-counts">
            ♡ {post.likeCount ?? 0} · ↻ {post.repostCount ?? 0} · ❝ {post.quoteCount ?? 0}
          </div>
        </div>
      </a>
      {node.children.length > 0 ? (
        <ul className="tchildren">
          {node.children.map((c, i) => (
            <NodeView key={c.post.uri + i} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
      {node.truncated > 0 ? (
        <div className="truncated">+ {node.truncated} more quote{node.truncated === 1 ? '' : 's'} not shown{depth + 1 > MAX_DEPTH ? ' (depth cap)' : ` (per-node cap is ${MAX_PER_NODE})`}</div>
      ) : null}
    </li>
  );
}

const CSS = `
  .shell-qt { max-width: 960px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .empty, .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }

  .stats { margin-top: var(--sp-5); display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stats .k { color: var(--color-fg-faint); display: block; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .stats b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; font-variant-numeric: tabular-nums; }

  .tree, .tchildren { list-style: none; }
  .tree { margin-top: var(--sp-4); }
  .tchildren { margin-left: var(--sp-5); padding-left: var(--sp-3); border-left: 1px dashed var(--color-border); }
  .tnode { margin-top: var(--sp-2); }
  .tnode.root > .t-link { border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); }
  .t-link { display: grid; grid-template-columns: 36px 1fr; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); text-decoration: none; color: inherit; transition: background 0.1s; }
  .t-link:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel)); }
  .t-link:hover .t-who b { color: var(--color-accent); }
  .t-avatar { width: 36px; height: 36px; border: 1px solid var(--color-border); object-fit: cover; }
  .t-avatar.empty { background: var(--color-bg-raised); background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .t-body { min-width: 0; }
  .t-who { display: flex; gap: 6px; flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); align-items: baseline; }
  .t-who b { color: var(--color-fg); font-weight: 400; }
  .t-handle { color: var(--color-fg-faint); }
  .t-when { color: var(--color-fg-faint); }
  .t-text { color: var(--color-fg-dim); font-size: var(--fs-xs); line-height: 1.5; margin-top: 4px; white-space: pre-wrap; overflow-wrap: break-word; }
  .t-counts { margin-top: 4px; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); font-variant-numeric: tabular-nums; }

  .truncated { margin-left: var(--sp-5); padding: 6px 0 0 var(--sp-3); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
