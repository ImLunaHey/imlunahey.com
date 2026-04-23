import { createServerFn } from '@tanstack/react-start';

const UA = 'imlunahey.com/1.0 (+https://imlunahey.com/labs/bsky-composer) image-proxy';
const MAX_BYTES = 1_000_000; // 1MB — bluesky blob limit is ~1MB for images

export type FetchedImage = {
  url: string;
  mimeType: string;
  /** base64 of the image bytes — transport-friendly for rpc */
  base64: string;
  byteLength: number;
};

export const fetchImageBytes = createServerFn({ method: 'GET' })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }): Promise<FetchedImage> => {
    const { url } = data;
    if (!/^https?:\/\//.test(url)) throw new Error('url must start with http:// or https://');
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) throw new Error(`not an image: ${mimeType}`);
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) throw new Error(`image too large: ${ab.byteLength} bytes (max ${MAX_BYTES})`);
    // base64 encode — Buffer is available via nodejs_compat
    const base64 = Buffer.from(ab).toString('base64');
    return { url, mimeType, base64, byteLength: ab.byteLength };
  });
