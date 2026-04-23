import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

export type ClientHints = {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  colo: string | null;
  asn: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  accept: string | null;
  acceptEncoding: string | null;
  secChUa: string | null;
  secChUaMobile: string | null;
  secChUaPlatform: string | null;
  cfRay: string | null;
};

function pick(h: Headers, name: string): string | null {
  return h.get(name) ?? null;
}

export const getClientHints = createServerFn({ method: 'GET' }).handler((): ClientHints => {
  const h = getRequestHeaders();
  return {
    ip: pick(h, 'cf-connecting-ip') ?? pick(h, 'x-forwarded-for') ?? pick(h, 'x-real-ip'),
    country: pick(h, 'cf-ipcountry'),
    region: pick(h, 'cf-region'),
    city: pick(h, 'cf-ipcity'),
    colo: pick(h, 'cf-colo'),
    asn: pick(h, 'cf-asn'),
    userAgent: pick(h, 'user-agent'),
    acceptLanguage: pick(h, 'accept-language'),
    accept: pick(h, 'accept'),
    acceptEncoding: pick(h, 'accept-encoding'),
    secChUa: pick(h, 'sec-ch-ua'),
    secChUaMobile: pick(h, 'sec-ch-ua-mobile'),
    secChUaPlatform: pick(h, 'sec-ch-ua-platform'),
    cfRay: pick(h, 'cf-ray'),
  };
});
