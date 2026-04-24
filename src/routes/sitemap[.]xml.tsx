import { createFileRoute } from '@tanstack/react-router';
import { ogEntries } from '../lib/og';
import { SITE, BSKY_ACCOUNTS } from '../data';
import { resolveIdentity } from '../server/atproto';

// Dynamic sitemap. Enumerates every static/OG-registered page plus blog
// entries fetched live from whitewind, so new posts are discoverable
// without a redeploy. Edge-cached for 1h so crawlers don't hammer the pds.

type BlogRecord = {
  uri: string;
  // visibility is 'public' | 'url' | 'author' per the lexicon (with 'public'
  // the default when omitted). anything other than public/unset is excluded
  // from the sitemap so unlisted/author-only drafts don't end up indexed.
  value: { createdAt?: string; visibility?: 'public' | 'url' | 'author'; title?: string };
};

async function fetchBlogRkeys(): Promise<Array<{ rkey: string; updated: string }>> {
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
      .map((rec) => ({
        rkey: rec.uri.split('/').pop() ?? '',
        updated: rec.value.createdAt ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const origin = `https://${SITE.domain}`;
        const now = new Date().toISOString();

        const urls: Array<{ loc: string; lastmod: string; priority?: number }> = [];

        // static + every registered page / lab (og entries carries the slug).
        // WIP pages are skipped so crawlers don't surface half-finished work —
        // kept in sync with CommandPalette's NAV_ITEMS exclusions.
        const WIP_SLUGS = new Set(['bookmarks', 'health', 'homelab', 'library']);
        for (const [slug, entry] of ogEntries()) {
          if (WIP_SLUGS.has(slug)) continue;
          urls.push({
            loc: origin + entry.slug,
            lastmod: now,
            priority: slug === 'home' ? 1.0 : slug.startsWith('lab/') ? 0.6 : 0.8,
          });
        }

        // live blog posts
        const rkeys = await fetchBlogRkeys();
        for (const { rkey, updated } of rkeys) {
          urls.push({
            loc: `${origin}/blog/${rkey}`,
            lastmod: updated,
            priority: 0.7,
          });
        }

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url>\n` +
                `    <loc>${xmlEscape(u.loc)}</loc>\n` +
                `    <lastmod>${xmlEscape(u.lastmod)}</lastmod>\n` +
                (u.priority != null ? `    <priority>${u.priority.toFixed(1)}</priority>\n` : '') +
                `  </url>`,
            )
            .join('\n') +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      },
    },
  },
});
