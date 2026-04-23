import { createServerFn } from '@tanstack/react-start';

export type InspectHop = {
  url: string;
  status: number;
  statusText: string;
  ms: number;
  headers: Array<[string, string]>;
  redirectTo?: string;
};

export type InspectResult = {
  final: InspectHop;
  hops: InspectHop[];
  bodyBytes: number;
  bodyPreview: string;
  contentType?: string;
};

const UA = 'imlunahey.com/1.0 (+https://imlunahey.com/labs/http-headers)';
const MAX_HOPS = 8;

export const inspectUrl = createServerFn({ method: 'GET' })
  .inputValidator((data: { url: string; method?: string }) => data)
  .handler(async ({ data }): Promise<InspectResult> => {
    const method = (data.method ?? 'GET').toUpperCase();
    if (!/^GET|HEAD$/i.test(method)) throw new Error('only GET and HEAD are allowed');
    let url = data.url.trim();
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;

    const hops: InspectHop[] = [];
    let currentUrl = url;

    for (let i = 0; i < MAX_HOPS; i++) {
      const t0 = performance.now();
      const res = await fetch(currentUrl, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': UA },
      });
      const ms = Math.round(performance.now() - t0);
      const headers: Array<[string, string]> = [];
      res.headers.forEach((v, k) => headers.push([k, v]));
      const loc = res.headers.get('location');
      const redirectTo = loc ?? undefined;
      const hop: InspectHop = {
        url: currentUrl,
        status: res.status,
        statusText: res.statusText,
        ms,
        headers,
        redirectTo,
      };
      hops.push(hop);

      if (res.status >= 300 && res.status < 400 && loc) {
        currentUrl = new URL(loc, currentUrl).toString();
        // consume body so the connection can be reused
        await res.text().catch(() => '');
        continue;
      }

      let bodyPreview = '';
      let bodyBytes = 0;
      const ct = res.headers.get('content-type') ?? undefined;
      const isText = !ct || /text|json|xml|javascript|html|yaml/i.test(ct);
      try {
        if (method !== 'HEAD' && isText) {
          const text = await res.text();
          bodyBytes = new TextEncoder().encode(text).length;
          bodyPreview = text.slice(0, 2000);
        } else if (method !== 'HEAD') {
          const buf = await res.arrayBuffer();
          bodyBytes = buf.byteLength;
          bodyPreview = '(binary · ' + buf.byteLength + ' bytes)';
        }
      } catch { /* noop */ }

      return { final: hop, hops, bodyBytes, bodyPreview, contentType: ct };
    }

    throw new Error(`exceeded ${MAX_HOPS} redirect hops`);
  });
