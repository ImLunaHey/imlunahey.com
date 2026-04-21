import { simpleFetchHandler, XRPC } from '@atcute/client';
import { AppBskyEmbedImages, AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/client/lexicons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useProfile } from '../../hooks/use-profile';

type ThreadNode = AppBskyFeedDefs.ThreadViewPost & { $type: 'app.bsky.feed.defs#threadViewPost' };
type ThreadChild = NonNullable<AppBskyFeedDefs.ThreadViewPost['replies']>[number];

const isThreadNode = (n: ThreadChild | undefined): n is ThreadNode =>
  !!n && n.$type === 'app.bsky.feed.defs#threadViewPost';

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

function useAuthorFeed(actor: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['labs-feed', actor],
    queryFn: ({ pageParam }) =>
      rpc
        .get('app.bsky.feed.getAuthorFeed', {
          params: { actor, includePins: true, filter: 'posts_no_replies', cursor: pageParam },
        })
        .then((res) => res.data),
    enabled: !!actor && enabled,
    retry: false,
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 1000 * 60 * 5,
  });
}

function fmtRel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2_592_000) return `${Math.floor(diff / 86_400)}d`;
  return iso.slice(0, 10);
}

function compactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function useThread(uri: string | null) {
  return useQuery({
    queryKey: ['labs-feed', 'thread', uri],
    queryFn: async () => {
      if (!uri) throw new Error('no uri');
      const res = await rpc.get('app.bsky.feed.getPostThread', { params: { uri } });
      const thread = res.data.thread;
      if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
        throw new Error('thread not viewable');
      }
      return thread as ThreadNode;
    },
    enabled: !!uri,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export default function FeedPage() {
  const rawParams = useParams({ strict: false }) as { _splat?: string };
  const splat = (rawParams._splat ?? '').split('/').filter(Boolean);
  // supported shapes:
  //   []                         → landing
  //   ['handle']                 → feed view
  //   ['handle', 'post', 'rkey'] → thread view
  const handle = splat[0] ? splat[0].replace(/^@/, '') : null;
  const rkey = splat.length >= 3 && splat[1] === 'post' ? splat[2] : null;
  const navigate = useNavigate();
  const [input, setInput] = useState(handle ?? '');

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = input.trim().replace(/^@/, '');
    if (!val) return;
    navigate({ to: `/labs/feed/${val}` as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-feed">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          {handle ? (
            <>
              <Link to="/labs/feed">feed</Link>
              <span className="sep">/</span>
              {rkey ? (
                <>
                  <Link to={`/labs/feed/${handle}` as never}>@{handle}</Link>
                  <span className="sep">/</span>
                  <span className="last">post · {rkey}</span>
                </>
              ) : (
                <span className="last">@{handle}</span>
              )}
            </>
          ) : (
            <span className="last">feed</span>
          )}
        </div>

        <header className="feed-hd">
          <h1>
            feed<span className="dot">.</span>
          </h1>
          <p className="sub">
            read any bluesky actor's feed via{' '}
            <code className="inline">app.bsky.feed.getAuthorFeed</code> on public.api. no auth. pins, reposts, and
            embedded images rendered.
          </p>
          <form onSubmit={onSubmit} className="feed-form">
            <input
              className="feed-input"
              type="text"
              placeholder="handle or did (e.g. imlunahey.com)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="feed-go" disabled={!input.trim()}>
              load feed →
            </button>
          </form>
        </header>

        {handle && rkey ? (
          <ThreadRoute handle={handle} rkey={rkey} />
        ) : handle ? (
          <FeedView handle={handle} />
        ) : (
          <EmptyLanding />
        )}

        <footer className="feed-footer">
          <span>
            src: <span className="t-accent">public.api.bsky.app · app.bsky.feed.getAuthorFeed</span>
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

function ThreadRoute({ handle, rkey }: { handle: string; rkey: string }) {
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile({ actor: handle });
  const uri = profile?.did ? `at://${profile.did}/app.bsky.feed.post/${rkey}` : null;
  const { data: thread, isLoading: threadLoading, error: threadError } = useThread(uri);

  if (profileLoading) return <LoadingPanel label="resolving profile…" />;
  if (profileError) return <ErrorPanel msg={profileError instanceof Error ? profileError.message : String(profileError)} />;
  if (!profile) return null;
  if (threadLoading) return <LoadingPanel label="loading thread…" />;
  if (threadError) return <ErrorPanel msg={threadError instanceof Error ? threadError.message : String(threadError)} />;
  if (!thread) return null;

  const parents = walkParents(thread);
  const replies = (thread.replies ?? []).filter(isThreadNode);

  return (
    <>
      <Link to={`/labs/feed/${handle}` as never} className="back-row">
        ← @{handle}'s feed
      </Link>

      {parents.length > 0 ? (
        <section className="thread-parents">
          {parents.map((p) => (
            <PostCard key={p.post.uri} post={p.post} href={linkFromUri(p.post.uri, p.post.author.handle)} compact />
          ))}
        </section>
      ) : null}

      <section className="thread-focus">
        <PostCard post={thread.post} focus />
      </section>

      <section className="thread-replies">
        <div className="replies-hd">
          ── replies <span className="replies-count">{thread.post.replyCount ?? 0}</span>
        </div>
        {replies.length === 0 ? (
          <div className="t-faint" style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>
            no replies yet.
          </div>
        ) : (
          replies.map((r) => <ThreadReply key={r.post.uri} node={r} depth={0} />)
        )}
      </section>
    </>
  );
}

function ThreadReply({ node, depth }: { node: ThreadNode; depth: number }) {
  const children = (node.replies ?? []).filter(isThreadNode);
  const indent = Math.min(depth, 5);
  return (
    <div className="thread-reply" style={{ marginLeft: indent * 16 }}>
      <PostCard post={node.post} href={linkFromUri(node.post.uri, node.post.author.handle)} compact />
      {children.length > 0 ? (
        <div className="thread-children">
          {children.map((c) => (
            <ThreadReply key={c.post.uri} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function walkParents(node: ThreadNode): ThreadNode[] {
  const out: ThreadNode[] = [];
  let p: ThreadChild | undefined = node.parent;
  while (isThreadNode(p)) {
    out.push(p);
    p = p.parent;
  }
  return out.reverse();
}

function linkFromUri(uri: string, handle: string): string {
  const rkey = uri.split('/').pop() ?? '';
  return `/labs/feed/${handle}/post/${rkey}`;
}

function EmptyLanding() {
  return (
    <section className="empty">
      <div className="empty-glyph">▤</div>
      <div className="empty-ttl">enter a handle to load their feed</div>
      <div className="empty-sub">try imlunahey.com or jay.bsky.team</div>
    </section>
  );
}

function FeedView({ handle }: { handle: string }) {
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile({ actor: handle });
  const isPrivate = profile?.labels?.some((l) => l.val === '!no-unauthenticated') ?? false;
  const [confirmedPrivate, setConfirmedPrivate] = useState(false);
  const enabled = !!profile && (!isPrivate || confirmedPrivate);

  const feedQuery = useAuthorFeed(profile?.did ?? handle, enabled);

  if (profileLoading) return <LoadingPanel label="resolving profile…" />;
  if (profileError) {
    return <ErrorPanel msg={profileError instanceof Error ? profileError.message : String(profileError)} />;
  }
  if (!profile) return null;

  return (
    <>
      <ProfileCard profile={profile} />

      {isPrivate && !confirmedPrivate ? (
        <section className="gate">
          <div className="gate-hd">// private profile</div>
          <div className="gate-body">
            this actor has opted out of showing their posts to unauthenticated clients (the{' '}
            <code className="inline">!no-unauthenticated</code> label). public.api will likely return nothing.
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <button type="button" className="gate-btn" onClick={() => setConfirmedPrivate(true)}>
                try anyway →
              </button>
            </div>
          </div>
        </section>
      ) : (
        <FeedList feedQuery={feedQuery} browseHandle={handle} />
      )}
    </>
  );
}

type ProfileShape = NonNullable<ReturnType<typeof useProfile>['data']>;

function ProfileCard({ profile }: { profile: ProfileShape }) {
  return (
    <section className="profile">
      {profile.banner ? (
        <div className="profile-banner" style={{ backgroundImage: `url(${profile.banner})` }} />
      ) : (
        <div className="profile-banner empty-banner" />
      )}
      <div className="profile-body">
        {profile.avatar ? (
          <img src={profile.avatar} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar empty-avatar" />
        )}
        <div className="profile-meta">
          <div className="profile-name">
            {profile.displayName ?? profile.handle}
            <span className="dot">.</span>
          </div>
          <div className="profile-handle">@{profile.handle}</div>
          {profile.description ? <div className="profile-desc">{profile.description}</div> : null}
          <div className="profile-stats">
            <span>
              <b>{compactNumber(profile.postsCount ?? 0)}</b> posts
            </span>
            <span>
              <b>{compactNumber(profile.followersCount ?? 0)}</b> followers
            </span>
            <span>
              <b>{compactNumber(profile.followsCount ?? 0)}</b> following
            </span>
            <a
              href={`https://bsky.app/profile/${profile.did}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-link"
            >
              bsky.app ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

type FeedQuery = ReturnType<typeof useAuthorFeed>;

function FeedList({ feedQuery, browseHandle }: { feedQuery: FeedQuery; browseHandle: string }) {
  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, error } = feedQuery;
  const posts = data?.pages.flatMap((p) => p.feed) ?? [];

  if (error) {
    return <ErrorPanel msg={error instanceof Error ? error.message : String(error)} />;
  }
  if (isFetching && posts.length === 0) return <LoadingPanel label="fetching feed…" />;
  if (posts.length === 0) {
    return (
      <section className="empty">
        <div className="empty-glyph">◌</div>
        <div className="empty-ttl">no posts in this feed</div>
        <div className="empty-sub">public.api returned zero items</div>
      </section>
    );
  }

  return (
    <>
      <section className="posts">
        {posts.map((p) => (
          <Post key={p.post.uri} item={p} browseHandle={browseHandle} />
        ))}
      </section>
      {hasNextPage ? (
        <div className="load-more">
          <button type="button" className="load-more-btn" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'loading…' : 'load more ↓'}
          </button>
        </div>
      ) : (
        <div className="end-line">── end of feed</div>
      )}
    </>
  );
}

// per-feed-item type from lexicons is deeply parameterised — pick what we actually use
type FeedItem = NonNullable<NonNullable<ReturnType<typeof useAuthorFeed>['data']>['pages'][number]['feed']>[number];

function Post({ item, browseHandle }: { item: FeedItem; browseHandle: string }) {
  const rkey = item.post.uri.split('/').pop() ?? '';
  const reason = (item.reason as { $type?: string } | undefined)?.$type;
  return (
    <PostCard
      post={item.post}
      reason={
        reason === 'app.bsky.feed.defs#reasonPin' ? 'pin' : reason === 'app.bsky.feed.defs#reasonRepost' ? 'repost' : null
      }
      href={`/labs/feed/${browseHandle}/post/${rkey}`}
    />
  );
}

function PostCard({
  post,
  reason,
  href,
  compact,
  focus,
}: {
  post: AppBskyFeedDefs.PostView;
  reason?: 'pin' | 'repost' | null;
  href?: string | null;
  compact?: boolean;
  focus?: boolean;
}) {
  const record = post.record as AppBskyFeedPost.Record;
  const embed = post.embed;
  const images =
    embed?.$type === 'app.bsky.embed.images#view' ? (embed as AppBskyEmbedImages.View).images : [];
  const rkey = post.uri.split('/').pop() ?? '';
  const bskyUrl = `https://bsky.app/profile/${post.author.did}/post/${rkey}`;

  const body = (
    <>
      <header className="post-hd">
        {post.author.avatar ? (
          <img src={post.author.avatar} alt="" className="post-avatar" />
        ) : (
          <div className="post-avatar empty-avatar" />
        )}
        <div className="post-id">
          <span className="post-name">{post.author.displayName ?? post.author.handle}</span>
          <span className="post-handle">@{post.author.handle}</span>
        </div>
        {reason === 'pin' ? <span className="post-reason">📌 pinned</span> : null}
        {reason === 'repost' ? <span className="post-reason">↻ reposted</span> : null}
        <a
          href={bskyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="post-time"
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
        >
          {fmtRel(record.createdAt)}
        </a>
      </header>
      {record.text ? <p className="post-text">{record.text}</p> : null}
      {images.length > 0 ? <Images images={images} /> : null}
      <footer className="post-ft">
        <span title="replies">↩ {post.replyCount ?? 0}</span>
        <span title="reposts">↻ {post.repostCount ?? 0}</span>
        <span title="likes">♥ {post.likeCount ?? 0}</span>
      </footer>
    </>
  );

  const cls = 'post' + (compact ? ' compact' : '') + (focus ? ' focus' : '');
  if (href) {
    return (
      <Link to={href as never} className={cls + ' linkable'}>
        {body}
      </Link>
    );
  }
  return <article className={cls}>{body}</article>;
}

function Images({ images }: { images: AppBskyEmbedImages.ViewImage[] }) {
  const count = Math.min(images.length, 4);
  const gridClass = count === 1 ? 'img-1' : count === 2 ? 'img-2' : count === 3 ? 'img-3' : 'img-4';
  return (
    <div className={`post-images ${gridClass}`}>
      {images.slice(0, 4).map((img) => (
        <a key={img.thumb} href={img.fullsize} target="_blank" rel="noopener noreferrer" className="post-img-link">
          <img src={img.thumb} alt={img.alt} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="prog">
      <div className="prog-line">
        <span className="prog-lbl">{label}</span>
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
  .shell-feed { max-width: 760px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .feed-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .feed-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .feed-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .feed-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .feed-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .feed-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
  .feed-input {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .feed-input:focus { outline: none; border-color: var(--color-accent-dim); }
  .feed-input::placeholder { color: var(--color-fg-ghost); }
  .feed-go {
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
  .feed-go:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .feed-go:disabled { opacity: 0.4; cursor: not-allowed; }

  /* profile card */
  .profile {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .profile-banner {
    height: 120px;
    background-size: cover;
    background-position: center;
    background-color: var(--color-bg-raised);
    border-bottom: 1px solid var(--color-border);
  }
  .profile-banner.empty-banner {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .profile-body {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    align-items: start;
  }
  .profile-avatar {
    width: 80px; height: 80px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    margin-top: -52px;
    object-fit: cover;
  }
  .profile-avatar.empty-avatar {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .profile-meta { min-width: 0; }
  .profile-name {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1.05;
    overflow-wrap: break-word;
  }
  .profile-name .dot { color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); }
  .profile-handle {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .profile-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin-top: var(--sp-3);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  .profile-stats {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    align-items: center;
  }
  .profile-stats b { color: var(--color-accent); font-weight: 400; }
  .profile-link {
    margin-left: auto;
    color: var(--color-fg-faint);
    text-decoration: none;
  }
  .profile-link:hover { color: var(--color-accent); }

  /* gate */
  .gate {
    margin-top: var(--sp-4);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .gate-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-warn) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-warn);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .gate-body { padding: var(--sp-4) var(--sp-5); font-size: var(--fs-sm); color: var(--color-fg-dim); line-height: 1.55; }
  .gate-body .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-warn);
    font-family: var(--font-mono);
  }
  .gate-btn {
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: transparent;
    color: var(--color-warn);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 6px 14px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .gate-btn:hover { background: color-mix(in oklch, var(--color-warn) 10%, transparent); }

  /* posts */
  .posts { display: flex; flex-direction: column; margin-top: var(--sp-5); }
  .post {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .post:last-child { border-bottom: 0; }
  .post-hd {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .post-avatar {
    width: 36px; height: 36px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
    object-fit: cover;
    flex-shrink: 0;
  }
  .post-avatar.empty-avatar {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .post-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .post-name {
    color: var(--color-fg);
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .post-handle {
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .post-reason {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding: 2px 8px;
    border: 1px solid var(--color-border);
  }
  .post-time {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
    margin-left: auto;
    flex-shrink: 0;
  }
  .post-time:hover { color: var(--color-accent); }
  .post-text {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    margin: 0;
  }

  .post-images {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-border);
  }
  .post-images.img-1 { grid-template-columns: 1fr; }
  .post-images.img-2 { grid-template-columns: 1fr 1fr; }
  .post-images.img-3 { grid-template-columns: 1fr 1fr 1fr; }
  .post-images.img-4 { grid-template-columns: 1fr 1fr; }
  .post-img-link { display: block; line-height: 0; }
  .post-img-link img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 400px;
    object-fit: cover;
  }

  .post-ft {
    display: flex;
    gap: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  /* progress / loading */
  .prog {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .prog-line { display: flex; justify-content: space-between; color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
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

  /* error */
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

  /* empty */
  .empty {
    margin-top: var(--sp-8);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); word-break: break-all; }

  /* load more */
  .load-more { display: flex; justify-content: center; padding: var(--sp-5) 0; }
  .load-more-btn {
    padding: 8px 22px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .load-more-btn:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .load-more-btn:disabled { opacity: 0.5; cursor: wait; }
  .end-line {
    text-align: center;
    padding: var(--sp-6) 0 var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
  }

  .feed-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  /* linkable post cards */
  a.post.linkable { text-decoration: none; color: inherit; }
  a.post.linkable:hover { background: var(--color-bg-raised); }
  a.post.linkable:hover .post-name { color: var(--color-accent); }

  /* thread view */
  .back-row {
    display: inline-block;
    margin-top: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
  }
  .back-row:hover { color: var(--color-accent); }

  .thread-parents {
    margin-top: var(--sp-4);
    padding-left: var(--sp-3);
    border-left: 2px solid var(--color-border-bright);
    opacity: 0.75;
  }
  .thread-focus {
    margin-top: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .thread-focus .post { border-bottom: 0; padding: 0; }

  .thread-replies {
    margin-top: var(--sp-6);
    padding-top: var(--sp-4);
    border-top: 1px solid var(--color-border);
  }
  .replies-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
    margin-bottom: var(--sp-3);
  }
  .replies-count { color: var(--color-accent); margin-left: 6px; }

  .thread-reply { position: relative; }
  .thread-reply .post.compact { padding: var(--sp-3) 0; }
  .thread-children {
    border-left: 1px dashed var(--color-border);
    padding-left: var(--sp-3);
  }

  .post.compact .post-text { font-size: var(--fs-sm); }
  .post.compact .post-images img { max-height: 240px; }
`;
