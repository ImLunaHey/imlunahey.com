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
    { property: 'og:image:type', content: 'image/svg+xml' },
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
 */
export function pageMeta(slug: OgSlug): { meta: Array<Record<string, string>> } {
  const e = ogEntry(slug);
  const bareTitle = e.title.replace(/\.$/, '');
  return {
    meta: [
      { title: `${bareTitle} · ${SITE.name}` },
      { name: 'description', content: e.subtitle },
      ...ogMeta({
        slug,
        title: `${bareTitle} · ${SITE.name}`,
        description: e.subtitle,
        url: `https://${SITE.domain}${e.slug}`,
      }),
    ],
  };
}
