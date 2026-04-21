import { AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/client/lexicons';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import { useBlogEntry } from '../hooks/use-blog-entry';
import { useBlogEntryComments } from '../hooks/use-blog-entry-comments';
import { useProfile } from '../hooks/use-profile';
import { useReadTime } from '../hooks/use-read-time';
import { useViewCount } from '../hooks/use-view-count';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { RelativeTime } from '../components/RelativeTime';
import { SITE } from '../data';
import { getBlogEntries } from '../server/whitewind';

const AUTHOR_DID = 'did:plc:k6acu4chiwkixvdedcmdgmal';

const Comment = ({ comment }: { comment: AppBskyFeedDefs.ThreadViewPost }) => {
  const record = comment.post.record as AppBskyFeedPost.Record;
  const images = comment.post.embed?.$type === 'app.bsky.embed.images#view' ? comment.post.embed.images : [];
  const replies =
    comment.replies
      ?.filter((reply) => reply.$type === 'app.bsky.feed.defs#threadViewPost')
      .sort((a, b) => {
        return (
          new Date((a.post.record as AppBskyFeedPost.Record).createdAt).getTime() -
          new Date((b.post.record as AppBskyFeedPost.Record).createdAt).getTime()
        );
      }) ?? [];

  return (
    <>
      <div className="comment">
        <div className="comment-head">
          <img src={comment.post.author.avatar} className="avatar" loading="lazy" alt="" />
          <a href={`https://bsky.app/profile/${comment.post.author.did}`} className="name">
            {comment.post.author.displayName ?? comment.post.author.handle}
          </a>
          <span className="handle">@{comment.post.author.handle}</span>
          <span className="when">
            <RelativeTime date={new Date(record.createdAt)} />
          </span>
        </div>
        <div className="comment-body">{record.text}</div>
        {images.length > 0 ? (
          <div className="comment-images">
            {images.map((image) => (
              <img
                key={image.thumb}
                src={image.fullsize}
                loading="lazy"
                alt={image.alt}
                width={image.aspectRatio?.width}
                height={image.aspectRatio?.height}
              />
            ))}
          </div>
        ) : null}
      </div>
      {replies.length > 0 ? (
        <div className="comment-replies">
          {replies.map((reply) => {
            const child = reply.$type === 'app.bsky.feed.defs#threadViewPost' ? reply : null;
            if (!child) return null;
            return <Comment key={child.post.uri} comment={child} />;
          })}
        </div>
      ) : null}
    </>
  );
};

const Comments = ({ uri }: { uri: string }) => {
  const { data: comments, isLoading } = useBlogEntryComments({ uri });
  const parts = uri.split('//')[1]?.split('/') ?? [];
  const actor = parts[0];
  const rkey = parts[2];
  const postUrl = actor && rkey ? `https://bsky.app/profile/${actor}/post/${rkey}` : null;

  if (isLoading || !comments || comments.length === 0) return null;

  return (
    <section className="comments">
      <div className="comments-head">
        <span className="t-faint" style={{ letterSpacing: '0.08em' }}>
          ── replies
        </span>
        {postUrl ? (
          <a href={postUrl} className="glow-link">
            join the conversation →
          </a>
        ) : null}
      </div>
      {comments.map((comment) => (
        <Comment key={comment.post.uri} comment={comment} />
      ))}
    </section>
  );
};

const Entry = ({ rkey }: { rkey: string }) => {
  const { data: blogEntry, isLoading: blogEntryLoading, isError: blogEntryError } = useBlogEntry({
    author: AUTHOR_DID,
    rkey,
  });
  const { data: readTime } = useReadTime({ rkey });
  const { data: views } = useViewCount({ rkey });
  const { data: profile } = useProfile({ actor: AUTHOR_DID });
  const { data: blog } = useQuery({ queryKey: ['blog'], queryFn: () => getBlogEntries() });

  if (blogEntryError) return <Navigate replace to={'/not-found' as never} />;
  if (blogEntryLoading) {
    return (
      <div className="loading">
        <span className="t-faint">[..]</span> fetching post
        <span className="cursor" />
      </div>
    );
  }
  if (!blogEntry) return null;

  const title = blogEntry.value.title;
  const createdAt = blogEntry.value.createdAt;
  const dateStr = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '';

  return (
    <main className="shell-post">
      <header className="post-hd">
        <Link to="/blog" className="back glow-link">
          ← /writing
        </Link>
        <h1>
          {title}
          <span className="dot">.</span>
        </h1>
        <div className="meta">
          {dateStr ? <span>{dateStr}</span> : null}
          {readTime?.text ? <span>{readTime.text}</span> : null}
          {views ? <span>{views} views</span> : null}
          <span style={{ marginLeft: 'auto' }}>
            by <b>{profile?.displayName ?? SITE.name}</b>
          </span>
        </div>
      </header>

      <article>
        <MarkdownPreview content={blogEntry.value.content} />
      </article>

      <div className="whoami">
        <div className="cmd">whoami</div>
        <dl className="vitals">
          <dt>name</dt>
          <dd>
            <span className="acc">{SITE.name}</span>
          </dd>
          <dt>handle</dt>
          <dd>@{SITE.handle}.com</dd>
          <dt>location</dt>
          <dd>{SITE.location}</dd>
          <dt>pronouns</dt>
          <dd>{SITE.pronouns}</dd>
          <dt>reach</dt>
          <dd>
            <span className="acc">{SITE.email}</span>
          </dd>
        </dl>
      </div>

      {blog
        ? (() => {
            const related = blog.entries.filter((e) => e.rkey !== rkey).slice(0, 3);
            if (related.length === 0) return null;
            return (
              <div className="related">
                <div className="related-head">── also reading</div>
                {related.map((r) => (
                  <Link key={r.rkey} to={`/blog/${r.rkey}` as never}>
                    <span className="dt">{r.createdAt.slice(0, 10)}</span>
                    <span>{r.title}</span>
                    <span className="rt">{r.readMin}m</span>
                  </Link>
                ))}
              </div>
            );
          })()
        : null}

      <div className="reply-prompt">
        leave a thought · reply on bluesky to{' '}
        <a
          href={`https://bsky.app/profile/${SITE.handle}.com`}
          target="_blank"
          rel="noopener noreferrer"
          className="t-accent"
        >
          @{SITE.handle}.com
        </a>
        <span className="cursor" />
      </div>

      {blogEntry.value.comments ? <Comments uri={blogEntry.value.comments} /> : null}

      <footer className="post-footer">
        <span>
          src: <span className="t-accent">lunahey.com/xrpc/com.whtwnd.blog.getEntry?rkey={rkey}</span>
        </span>
        <span>
          ←{' '}
          <Link to="/blog" className="t-accent">
            all writing
          </Link>
        </span>
      </footer>
    </main>
  );
};

export default function BlogEntryPage() {
  const params = useParams({ strict: false }) as { rkey?: string };
  const rkey = params.rkey;

  if (!rkey) return <Navigate replace to={'/not-found' as never} />;

  return (
    <>
      <style>{CSS}</style>
      <Entry rkey={rkey} />
    </>
  );
}

const CSS = `
  .shell-post { max-width: 760px; margin: 0 auto; padding: 0 var(--sp-6); }

  .loading { padding: var(--sp-10) 0; text-align: center; color: var(--color-fg-faint); font-family: var(--font-mono); }

  .post-hd {
    padding: var(--sp-8) 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .post-hd .back {
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: inline-block;
    margin-bottom: var(--sp-4);
    text-decoration: none;
  }
  .post-hd .back:hover { color: var(--color-accent); }
  .post-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 6.5vw, 84px);
    font-weight: 500; letter-spacing: -0.03em;
    color: var(--color-fg); line-height: 0.98;
  }
  .post-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .post-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5); font-size: var(--fs-xs); color: var(--color-fg-faint);
    align-items: center;
  }
  .post-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .kind-chip { padding: 1px 8px; border: 1px solid var(--color-border-bright); font-size: 10px; text-transform: lowercase; }
  .kind-chip.essay  { border-color: oklch(0.55 0.13 270); color: oklch(0.8 0.14 270); }
  .kind-chip.devlog { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .kind-chip.short  { border-color: oklch(0.55 0.13 60); color: oklch(0.85 0.14 60); }

  .shell-post article {
    padding: var(--sp-8) 0 0;
    font-family: var(--font-mono);
    font-size: 15px;
    line-height: 1.75;
    color: var(--color-fg);
  }
  .shell-post article p { margin-bottom: var(--sp-4); text-wrap: pretty; }
  .shell-post article h1 {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    margin: var(--sp-8) 0 var(--sp-4);
    line-height: 1.1;
  }
  .shell-post article h2 {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    margin: var(--sp-8) 0 var(--sp-4);
    line-height: 1.1;
  }
  .shell-post article h2::before {
    content: "## ";
    color: var(--color-accent-dim);
    font-family: var(--font-mono);
    font-size: 18px;
  }
  .shell-post article h3 {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 500;
    color: var(--color-fg);
    margin: var(--sp-6) 0 var(--sp-3);
  }
  .shell-post article em { color: var(--color-fg-dim); font-style: italic; }
  .shell-post article a { color: var(--color-accent); border-bottom: 1px dashed var(--color-accent-dim); }
  .shell-post article a:hover { border-bottom-style: solid; text-shadow: 0 0 8px var(--accent-glow); }
  .shell-post article code {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px; font-size: 12px; color: var(--color-accent);
    font-family: var(--font-mono);
  }
  .shell-post article pre {
    /* sugar-high palette — same phosphor tokens as CodeBlock + readme */
    --sh-identifier: var(--color-fg);
    --sh-keyword:    oklch(0.78 0.16 315);
    --sh-string:     oklch(0.82 0.13 85);
    --sh-class:      oklch(0.85 0.14 65);
    --sh-property:   oklch(0.78 0.11 210);
    --sh-entity:     var(--color-accent);
    --sh-jsxliterals:oklch(0.78 0.11 210);
    --sh-sign:       var(--color-fg-faint);
    --sh-comment:    var(--color-fg-faint);
    --sh-break:      var(--color-fg);
    --sh-space:      transparent;

    margin: var(--sp-5) 0 var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-fg);
  }
  .shell-post article pre code { background: transparent; border: 0; padding: 0; color: inherit; font-size: inherit; }
  .shell-post article img {
    display: block;
    max-width: 100%;
    margin: var(--sp-5) 0;
    border: 1px solid var(--color-border);
  }

  .whoami {
    margin-top: var(--sp-3);
    padding: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .whoami .cmd { color: var(--color-fg); margin-bottom: 8px; }
  .whoami .cmd::before { content: "$ "; color: var(--color-accent); }
  .whoami .vitals {
    display: grid; grid-template-columns: 100px 1fr; gap: 4px 16px;
    font-size: var(--fs-xs); color: var(--color-fg-dim);
  }
  .whoami .vitals dt { color: var(--color-fg-faint); }
  .whoami .vitals dd .acc { color: var(--color-accent); }

  .related {
    padding: var(--sp-6) 0;
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-8);
  }
  .related-head { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-3); letter-spacing: 0.08em; }
  .related a {
    display: grid; grid-template-columns: 100px 1fr auto; gap: var(--sp-4);
    padding: 10px 0; border-bottom: 1px dashed var(--color-border);
    color: var(--color-fg); font-size: var(--fs-sm); align-items: baseline;
    text-decoration: none;
  }
  .related a:last-child { border-bottom: 0; }
  .related a:hover { color: var(--color-accent); text-decoration: none; }
  .related a .dt { color: var(--color-fg-faint); font-size: var(--fs-xs); font-family: var(--font-mono); }
  .related a .rt { color: var(--color-fg-faint); font-size: var(--fs-xs); white-space: nowrap; }

  .reply-prompt {
    margin-top: var(--sp-6);
    padding: var(--sp-4);
    border: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg-dim);
  }
  .reply-prompt::before { content: "> "; color: var(--color-accent); }

  .comments { padding: var(--sp-6) 0; border-top: 1px solid var(--color-border); margin-top: var(--sp-8); }
  .comments-head { display: flex; justify-content: space-between; margin-bottom: var(--sp-4); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .comment {
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .comment-head { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: 6px; font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .comment-head .avatar { width: 20px; height: 20px; border-radius: 9999px; }
  .comment-head .name { color: var(--color-fg); text-decoration: none; }
  .comment-head .name:hover { color: var(--color-accent); }
  .comment-head .handle { color: var(--color-fg-faint); }
  .comment-head .when { margin-left: auto; color: var(--color-fg-faint); }
  .comment-body { font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.6; }
  .comment-images { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .comment-images img { max-width: 180px; border: 1px solid var(--color-border); }
  .comment-replies { padding-left: var(--sp-4); border-left: 1px dashed var(--color-border); margin-left: 6px; }

  @media (max-width: 560px) {
    .shell-post { padding: 0 var(--sp-4); }
    .post-hd { padding-top: var(--sp-6); }

    /* whoami dl: drop the fixed label column so values have room */
    .whoami .vitals { grid-template-columns: auto 1fr; gap: 4px var(--sp-3); }

    /* related: date + read-time on top row, title on its own row below */
    .related a {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "dt rt"
        "tt tt";
      gap: 2px var(--sp-3);
    }
    .related a .dt { grid-area: dt; }
    .related a .rt { grid-area: rt; }
    .related a > span:not(.dt):not(.rt) { grid-area: tt; }

    /* comment header wraps when names/handles run long */
    .comment-head { flex-wrap: wrap; }
    .comment-head .when { margin-left: 0; }

    /* shrink article headings a touch so big ## titles don't overflow */
    .shell-post article h1 { font-size: 28px; }
    .shell-post article h2 { font-size: 24px; }
    .shell-post article h2::before { font-size: 15px; }
    .shell-post article h3 { font-size: 20px; }
    .shell-post article pre { padding: var(--sp-3); font-size: 12px; }
    .shell-post article { font-size: 14px; line-height: 1.7; }

    .comment-images img { max-width: 140px; }
  }

  .post-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-8);
    padding: var(--sp-5) 0 var(--sp-8);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex; justify-content: space-between;
    gap: var(--sp-4); flex-wrap: wrap;
  }
`;
