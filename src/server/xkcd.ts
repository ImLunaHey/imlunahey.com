import { createServerFn } from '@tanstack/react-start';

/**
 * xkcd.com doesn't set Access-Control-Allow-Origin on its JSON
 * endpoints, so browsers can't hit them directly. This is a tiny
 * server-side proxy that forwards to xkcd and returns the JSON.
 *
 * Endpoints:
 *   /info.0.json         — latest comic
 *   /{n}/info.0.json     — specific comic (n is 1-based)
 */

const UA = 'imlunahey.com/1.0 (+https://imlunahey.com/labs/xkcd)';

export type XkcdComic = {
  num: number;
  title: string;
  safe_title: string;
  img: string;
  alt: string;
  transcript?: string;
  day: string;
  month: string;
  year: string;
};

export const fetchXkcd = createServerFn({ method: 'GET' })
  .inputValidator((data: { num?: number }) => data)
  .handler(async ({ data }): Promise<XkcdComic> => {
    const url = data.num && data.num > 0
      ? `https://xkcd.com/${data.num}/info.0.json`
      : 'https://xkcd.com/info.0.json';
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`xkcd ${r.status}`);
    return (await r.json()) as XkcdComic;
  });
