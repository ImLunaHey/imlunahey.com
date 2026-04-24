import { SITE } from '../data';
import { ogEntry, type OgSlug } from './og';

export type OgMetaInput = {
  slug: OgSlug;
  title: string;
  description: string;
  /** Canonical url for the page. Defaults to the site root. */
  url?: string;
};

/** Returns the array of <meta> tags for TanStack Router's `head.meta` to emit
 *  og:* + twitter:* + canonical description. Points at /og/<slug> for the image. */
export function ogMeta(input: OgMetaInput): Array<Record<string, string>> {
  const { slug, title, description } = input;
  const url = input.url ?? `https://${SITE.domain}`;
  const image = `https://${SITE.domain}/og/${slug}`;
  return [
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE.domain },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: `@${SITE.handle}` },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];
}

/** Convenience: returns a full TanStack head() payload for a slug, pulling
 *  title + description from the shared registry. Each route just does:
 *    head: () => pageMeta('blog')
 *
 *  Also emits a <link rel="canonical"> so Ahrefs / Google consolidate
 *  query-string variants (e.g. /labs/mp?q=SW1A%201AA vs /labs/mp?q=EC1A)
 *  and trailing-slash variants into one indexable URL instead of flagging
 *  them as "duplicate pages without canonical".
 *
 *  Dynamic detail routes (e.g. /blog/$rkey, /projects/$name) should pass
 *  `{ path: '/blog/abc123' }` so the canonical matches the actual URL
 *  instead of pointing at the parent — otherwise Ahrefs/Google see the
 *  unique content but a shared canonical and flag it. For lab detail
 *  pages whose content isn't meant to be independently indexable
 *  (e.g. `/labs/crypto/$id`), inherit the parent canonical by default.
 */
export function pageMeta(
  slug: OgSlug,
  overrides: { path?: string; title?: string; description?: string } = {},
): {
  meta: Array<Record<string, string>>;
  links: Array<Record<string, string>>;
} {
  const e = ogEntry(slug);
  const bareTitle = overrides.title ?? e.title.replace(/\.$/, '');
  // prefer the long-form `description` field on the og entry (backfilled
  // for pages we care about ranking); fall back to the visual subtitle.
  const description = overrides.description ?? e.description ?? e.subtitle;
  const canonicalUrl = `https://${SITE.domain}${overrides.path ?? e.slug}`;
  return {
    meta: [
      { title: `${bareTitle} · ${SITE.name}` },
      { name: 'description', content: description },
      ...ogMeta({
        slug,
        title: `${bareTitle} · ${SITE.name}`,
        description,
        url: canonicalUrl,
      }),
    ],
    links: [{ rel: 'canonical', href: canonicalUrl }],
  };
}
