import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

export type OgMeta = {
  url: string;
  finalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  canonical?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  favicon?: string;
  /** All og:* + twitter:* + plain meta name/property tags, raw. */
  raw: Record<string, string>;
};

const UA = 'imlunahey.com/1.0 (+https://imlunahey.com/labs/og-preview) og-preview-bot';

function absolutise(base: string, candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, base).toString();
  } catch {
    return candidate;
  }
}

function parseMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  // trim to head for safety + speed
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  // iterate meta tags
  const re = /<meta\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    const attrs = m[1];
    const propMatch = /\b(property|name|itemprop)\s*=\s*(['"])(.*?)\2/i.exec(attrs);
    const contentMatch = /\bcontent\s*=\s*(['"])(.*?)\1/is.exec(attrs);
    if (!propMatch || !contentMatch) continue;
    const key = propMatch[3].trim().toLowerCase();
    const val = decodeEntities(contentMatch[2].trim());
    if (key && val && out[key] === undefined) out[key] = val;
  }
  // also fish out <title> and <link rel=canonical>
  const title = /<title\b[^>]*>([^<]*)<\/title>/i.exec(head);
  if (title && !out.title) out.title = decodeEntities(title[1].trim());
  const canonical = /<link\b[^>]*rel\s*=\s*(['"])canonical\1[^>]*href\s*=\s*(['"])([^"']+)\2/i.exec(head);
  if (canonical) out['link:canonical'] = canonical[3];
  const shortcut = /<link\b[^>]*rel\s*=\s*(['"])(?:shortcut )?icon\1[^>]*href\s*=\s*(['"])([^"']+)\2/i.exec(head);
  if (shortcut) out['link:icon'] = shortcut[3];
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

export const getOgMeta = createServerFn({ method: 'GET' })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }): Promise<OgMeta> => {
    const { url } = data;
    if (!/^https?:\/\//.test(url)) throw new Error('url must start with http:// or https://');
    return cached(`og:${url}`, TTL.short, async () => {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
      const finalUrl = res.url || url;
      const html = await res.text();
      const raw = parseMeta(html);
      return {
        url,
        finalUrl,
        title: raw['og:title'] ?? raw.title,
        description: raw['og:description'] ?? raw.description,
        image: absolutise(finalUrl, raw['og:image']),
        siteName: raw['og:site_name'],
        canonical: absolutise(finalUrl, raw['link:canonical']),
        twitterCard: raw['twitter:card'],
        twitterTitle: raw['twitter:title'],
        twitterDescription: raw['twitter:description'],
        twitterImage: absolutise(finalUrl, raw['twitter:image']),
        favicon: absolutise(finalUrl, raw['link:icon']) ?? absolutise(finalUrl, '/favicon.ico'),
        raw,
      };
    });
  });
