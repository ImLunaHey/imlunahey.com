import { createFileRoute } from '@tanstack/react-router';
import BlogEntryPage from '../../../pages/BlogEntry';
import { pageMeta } from '../../../lib/og-meta';

const AUTHOR_DID = 'did:plc:k6acu4chiwkixvdedcmdgmal';

type BlogRecord = { value?: { title?: string; content?: string } };

/** Pull the first ~155 chars of prose from the post body for a
 *  meta description. Strips markdown syntax (headings, links, code
 *  fences, etc.) so the snippet looks like real copy, not markup. */
function excerpt(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return undefined;
  if (plain.length <= 160) return plain;
  return plain.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

async function fetchBlogRecord(rkey: string): Promise<BlogRecord | null> {
  try {
    const url = new URL('https://bsky.social/xrpc/com.atproto.repo.getRecord');
    url.searchParams.set('repo', AUTHOR_DID);
    url.searchParams.set('collection', 'com.whtwnd.blog.entry');
    url.searchParams.set('rkey', rkey);
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return null;
    return (await r.json()) as BlogRecord;
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/_main/blog/$rkey')({
  component: BlogEntryPage,
  // Loader runs on both server (SSR) and client. Fetching the blog
  // record here lets head() emit a real title + excerpt in the meta
  // tags — Ahrefs was flagging every post as a short-description
  // duplicate because the previous fallback was the generic blog
  // index copy. 5s timeout so a slow PDS doesn't stall SSR.
  loader: async ({ params }) => {
    const record = await fetchBlogRecord(params.rkey);
    return { record };
  },
  head: ({ params, loaderData }) => {
    const v = loaderData?.record?.value;
    return pageMeta('blog', {
      path: `/blog/${params.rkey}`,
      title: v?.title,
      description: excerpt(v?.content),
    });
  },
});
