import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type AtActor = { did: string; handle: string; displayName?: string; avatar?: string };

type AtPost = {
  uri: string;
  cid: string;
  author: AtActor;
  record: { text: string; createdAt: string };
  indexedAt: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
};

type ThreadNode = {
  $type: string;
  post?: AtPost;
  parent?: ThreadNode;
  replies?: ThreadNode[];
  // #notFoundPost / #blockedPost have different shapes
  notFound?: boolean;
  blocked?: boolean;
  uri?: string;
};

async function fetchThread(atUri: string, depth = 10, parentHeight = 10): Promise<ThreadNode> {
  const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread');
  url.searchParams.set('uri', atUri);
  url.searchParams.set('depth', String(depth));
  url.searchParams.set('parentHeight', String(parentHeight));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`thread fetch failed: ${res.status}`);
  const j = (await res.json()) as { thread: ThreadNode };
  return j.thread;
}

async function resolveHandleToDid(handle: string): Promise<string> {
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  );
  if (!res.ok) throw new Error('handle resolution failed');
  const j = (await res.json()) as { did?: string };
  if (!j.did) throw new Error('no did');
  return j.did;
}

/**
 * Accept any of:
 *   https://bsky.app/profile/HANDLE/post/RKEY
 *   at://did:plc:.../app.bsky.feed.post/RKEY
 *   at://HANDLE/app.bsky.feed.post/RKEY
 */
async function normalizeToAtUri(input: string): Promise<string> {
  const t = input.trim();
  if (t.startsWith('at://did:')) return t;

  const bskyMatch = /^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(t);
  if (bskyMatch) {
    const [, actor, rkey] = bskyMatch;
    const did = actor.startsWith('did:') ? actor : await resolveHandleToDid(actor);
    return `at://${did}/app.bsky.feed.post/${rkey}`;
  }

  const atHandleMatch = /^at:\/\/([^/]+)\/(app\.bsky\.feed\.post)\/([^/?#]+)/.exec(t);
  if (atHandleMatch) {
    const [, actor, , rkey] = atHandleMatch;
    if (actor.startsWith('did:')) return t;
    const did = await resolveHandleToDid(actor);
    return `at://${did}/app.bsky.feed.post/${rkey}`;
  }

  throw new Error('expected a bsky.app post url or at:// uri');
}

function rkey(uri?: string): string {
  if (!uri) return '';
  return uri.split('/').pop() ?? '';
}

function relative(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  if (d < 86400 * 365) return `${Math.floor(d / (86400 * 30))}mo`;
  return `${(d / (86400 * 365)).toFixed(1)}y`;
}

function flattenParents(node: ThreadNode): ThreadNode[] {
  const chain: ThreadNode[] = [];
  let cur = node.parent;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  return chain;
}

function countTree(node: ThreadNode): { posts: number; authors: Set<string>; likes: number } {
  let posts = 0;
  let likes = 0;
  const authors = new Set<string>();
  const walk = (n: ThreadNode) => {
    if (n.post) {
      posts++;
      likes += n.post.likeCount ?? 0;
      authors.add(n.post.author.did);
    }
    for (const r of n.replies ?? []) walk(r);
  };
  walk(node);
  return { posts, authors, likes };
}

export default function ThreadTreePage() {
  const search = useSearch({ strict: false }) as { uri?: string };
  const initial = search.uri ?? 'https://bsky.app/profile/imlunahey.com/post/3mjzwsly52c2c';
  const navigate = useNavigate();
  const [input, setInput] = useState(initial);
  const submitted = search.uri ?? null;

  useEffect(() => {
    if (search.uri) setInput(search.uri);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.uri]);

  const submit = (v: string) => {
    const t = v.trim();
    if (t) navigate({ to: '/labs/thread-tree', search: { uri: t } });
  };

  const { data: atUri, error: normErr } = useQuery({
    queryKey: ['thread-norm', submitted],
    queryFn: () => normalizeToAtUri(submitted!),
    enabled: !!submitted,
    retry: false,
    staleTime: Infinity,
  });

  const { data: thread, isPending, error: threadErr } = useQuery({
    queryKey: ['thread', atUri],
    queryFn: () => fetchThread(atUri!),
    enabled: !!atUri,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const parents = useMemo(() => (thread ? flattenParents(thread) : []), [thread]);
  const stats = useMemo(() => (thread ? countTree(thread) : null), [thread]);

  const err = normErr instanceof Error ? normErr.message : threadErr instanceof Error ? threadErr.message : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(input);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tt">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">thread tree</span>
        </div>

        <header className="tt-hd">
          <h1>thread tree<span className="dot">.</span></h1>
          <p className="sub">
            paste any bluesky post url or at:// uri. fetches <code>app.bsky.feed.getPostThread</code>{' '}
            up to 10 levels deep, shows the full conversation with ancestors and all replies as an
            indented tree.
          </p>
        </header>

        <form className="tt-input-row" onSubmit={onSubmit}>
          <input
            className="tt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://bsky.app/profile/…/post/… or at://…"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="tt-btn" type="submit" disabled={!input.trim()}>load</button>
        </form>

        {err ? (
          <div className="tt-err">✗ {err}</div>
        ) : isPending && submitted ? (
          <div className="tt-loading">loading thread…</div>
        ) : thread && thread.post ? (
          <>
            {stats ? (
              <div className="tt-stats">
                <div><span>posts</span><b>{stats.posts}</b></div>
                <div><span>participants</span><b>{stats.authors.size}</b></div>
                <div><span>total likes</span><b>{stats.likes}</b></div>
                <div><span>ancestors</span><b>{parents.length}</b></div>
              </div>
            ) : null}

            {parents.length > 0 ? (
              <details className="tt-ancestors" open>
                <summary>── ancestors ({parents.length})</summary>
                <div className="tt-ancestors-list">
                  {parents.map((p, i) => <PostRow key={p.post?.uri ?? i} node={p} ghost />)}
                </div>
              </details>
            ) : null}

            <div className="tt-root">
              <div className="tt-label">── root post</div>
              <PostRow node={thread} isRoot />
            </div>

            {thread.replies && thread.replies.length > 0 ? (
              <div className="tt-replies">
                <div className="tt-label">── replies ({thread.replies.length})</div>
                <Replies replies={thread.replies} depth={0} />
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}

function Replies({ replies, depth }: { replies: ThreadNode[]; depth: number }) {
  return (
    <ul className="tt-list">
      {replies.map((r, i) => (
        <li key={r.post?.uri ?? i} className="tt-branch" data-depth={depth}>
          <PostRow node={r} />
          {r.replies && r.replies.length > 0 ? (
            <Replies replies={r.replies} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PostRow({ node, ghost, isRoot }: { node: ThreadNode; ghost?: boolean; isRoot?: boolean }) {
  if (node.$type?.endsWith('#notFoundPost') || node.notFound) {
    return <div className="tt-post tt-missing">post not found</div>;
  }
  if (node.$type?.endsWith('#blockedPost') || node.blocked) {
    return <div className="tt-post tt-missing">post blocked</div>;
  }
  const p = node.post;
  if (!p) return null;
  const href = `https://bsky.app/profile/${p.author.handle}/post/${rkey(p.uri)}`;
  return (
    <article className={`tt-post ${ghost ? 'ghost' : ''} ${isRoot ? 'root' : ''}`}>
      <div className="tt-post-l">
        {p.author.avatar ? (
          <img src={p.author.avatar} alt="" className="tt-avatar" />
        ) : (
          <div className="tt-avatar tt-avatar-fallback" />
        )}
      </div>
      <div className="tt-post-r">
        <header className="tt-post-hd">
          <span className="tt-display">{p.author.displayName || p.author.handle}</span>
          <span className="tt-handle">@{p.author.handle}</span>
          <span className="tt-sep">·</span>
          <span className="tt-time" title={p.record.createdAt}>{relative(p.record.createdAt)}</span>
          <a className="tt-ext" href={href} target="_blank" rel="noopener noreferrer">↗</a>
        </header>
        <div className="tt-body">{p.record.text}</div>
        <footer className="tt-post-ft">
          <span>💬 {p.replyCount ?? 0}</span>
          <span>🔁 {p.repostCount ?? 0}</span>
          <span>♥ {p.likeCount ?? 0}</span>
        </footer>
      </div>
    </article>
  );
}

const CSS = `
  .shell-tt { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .tt-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .tt-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .tt-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .tt-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }
  .tt-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .tt-input-row {
    display: flex;
    margin: var(--sp-5) 0 var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .tt-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: var(--sp-3);
  }
  .tt-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .tt-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .tt-err {
    padding: var(--sp-3);
    border: 1px solid var(--color-alert-dim);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .tt-loading {
    padding: var(--sp-5);
    text-align: center;
    font-family: var(--font-mono);
    color: var(--color-fg-faint);
  }

  .tt-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .tt-stats > div {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    display: flex; flex-direction: column; gap: 2px;
  }
  .tt-stats > div span { color: var(--color-fg-faint); font-size: var(--fs-xs); text-transform: lowercase; }
  .tt-stats > div b { color: var(--color-accent); font-weight: 400; font-size: var(--fs-md); }

  .tt-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin: var(--sp-3) 0 var(--sp-2);
  }

  .tt-ancestors {
    margin-bottom: var(--sp-3);
    font-family: var(--font-mono);
  }
  .tt-ancestors summary {
    cursor: pointer; user-select: none;
    padding: var(--sp-2) var(--sp-3);
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .tt-ancestors summary:hover { color: var(--color-accent); }
  .tt-ancestors-list {
    padding: var(--sp-2);
    display: flex; flex-direction: column; gap: 2px;
    border-left: 2px dashed var(--color-border-bright);
    margin-left: var(--sp-4);
    margin-top: var(--sp-2);
  }

  .tt-root { margin: var(--sp-3) 0 var(--sp-4); }

  .tt-replies { padding-bottom: var(--sp-10); }
  .tt-list {
    list-style: none;
    position: relative;
    padding-left: var(--sp-5);
  }
  .tt-list::before {
    content: '';
    position: absolute;
    left: 6px; top: 0; bottom: 20px;
    width: 2px;
    background: var(--color-border);
  }
  .tt-branch {
    position: relative;
    padding-top: var(--sp-2);
  }
  .tt-branch::before {
    content: '';
    position: absolute;
    left: -14px; top: 30px;
    width: 14px; height: 2px;
    background: var(--color-border);
  }

  .tt-post {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    transition: border-color 0.1s;
  }
  .tt-post:hover { border-color: var(--color-border-bright); }
  .tt-post.root {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .tt-post.ghost { opacity: 0.7; }
  .tt-post.tt-missing {
    grid-template-columns: 1fr;
    color: var(--color-fg-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .tt-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--color-bg-raised);
  }
  .tt-avatar-fallback {
    background: linear-gradient(135deg, var(--color-border-bright), var(--color-bg-raised));
  }

  .tt-post-r { min-width: 0; }
  .tt-post-hd {
    display: flex; align-items: baseline; gap: 6px;
    font-size: var(--fs-sm);
    flex-wrap: wrap;
  }
  .tt-display {
    color: var(--color-fg);
    font-weight: 500;
    font-family: var(--font-display);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 200px;
  }
  .tt-handle {
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 200px;
  }
  .tt-sep { color: var(--color-fg-ghost); }
  .tt-time {
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .tt-ext {
    margin-left: auto;
    color: var(--color-fg-faint);
    text-decoration: none;
    font-size: var(--fs-sm);
  }
  .tt-ext:hover { color: var(--color-accent); }

  .tt-body {
    color: var(--color-fg-dim);
    font-size: var(--fs-md);
    line-height: 1.5;
    margin: 6px 0 var(--sp-2);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .tt-post-ft {
    display: flex; gap: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 600px) {
    .tt-stats { grid-template-columns: 1fr 1fr; }
    .tt-post { grid-template-columns: 28px 1fr; gap: var(--sp-2); padding: var(--sp-2); }
    .tt-avatar { width: 28px; height: 28px; }
    .tt-list { padding-left: var(--sp-4); }
  }
`;
