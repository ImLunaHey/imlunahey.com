import { createFileRoute } from '@tanstack/react-router';
import { BSKY_ACCOUNTS, SITE } from '../data';
import { resolveIdentity } from '../server/atproto';

// RSS 2.0 feed of blog posts. Pulled live from whitewind so new
// posts appear without a redeploy. Edge-cached for 1h so readers
// and aggregators aren't hammering the pds.

type BlogRecord = {
  uri: string;
  value: {
    createdAt?: string;
    visibility?: 'public' | 'url' | 'author';
    title?: string;
    content?: string;
  };
};

async function fetchPublicPosts(): Promise<Array<{ rkey: string; record: BlogRecord['value'] }>> {
  try {
    const handle = BSKY_ACCOUNTS[0];
    if (!handle) return [];
    const identity = await resolveIdentity(handle);
    if (!identity) return [];
    const r = await fetch(
      `${identity.pds}/xrpc/com.atproto.repo.listRecords?repo=${identity.did}&collection=com.whtwnd.blog.entry&limit=100`,
    );
    if (!r.ok) return [];
    const data = (await r.json()) as { records: BlogRecord[] };
    return data.records
      .filter((rec) => (rec.value.visibility === 'public' || rec.value.visibility === undefined) && rec.value.title)
      .map((rec) => ({ rkey: rec.uri.split('/').pop() ?? '', record: rec.value }))
      .sort((a, b) => (b.record.createdAt ?? '').localeCompare(a.record.createdAt ?? ''));
  } catch {
    return [];
  }
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Strip markdown syntax down to plain text for the RSS description. */
function plainExcerpt(content: string | undefined, max = 320): string {
  if (!content) return '';
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return plain.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** RSS pubDate wants RFC 822, not ISO 8601. */
function rfc822(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toUTCString();
}

export const Route = createFileRoute('/rss.xml')({
  server: {
    handlers: {
      GET: async () => {
        const origin = `https://${SITE.domain}`;
        const posts = await fetchPublicPosts();
        const lastBuildDate = posts[0]?.record.createdAt ?? new Date().toISOString();

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n` +
          `  <channel>\n` +
          `    <title>${xmlEscape(SITE.name)} · writing</title>\n` +
          `    <link>${origin}/blog</link>\n` +
          `    <description>essays, devlogs, and half-finished notes on software engineering, the atproto ecosystem, web performance, and whatever else has my attention this week.</description>\n` +
          `    <language>en</language>\n` +
          `    <lastBuildDate>${rfc822(lastBuildDate)}</lastBuildDate>\n` +
          `    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>\n` +
          posts
            .map((p) => {
              const link = `${origin}/blog/${p.rkey}`;
              const title = p.record.title ?? p.rkey;
              const desc = plainExcerpt(p.record.content);
              return (
                `    <item>\n` +
                `      <title>${xmlEscape(title)}</title>\n` +
                `      <link>${link}</link>\n` +
                `      <guid isPermaLink="true">${link}</guid>\n` +
                `      <pubDate>${rfc822(p.record.createdAt)}</pubDate>\n` +
                (desc ? `      <description>${xmlEscape(desc)}</description>\n` : '') +
                `    </item>`
              );
            })
            .join('\n') +
          `\n  </channel>\n` +
          `</rss>\n`;

        return new Response(body, {
          headers: {
            'content-type': 'application/rss+xml; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      },
    },
  },
});
