import { createFileRoute } from '@tanstack/react-router';
import { SITE, SOCIALS, USES } from '../data';

// Dynamic humans.txt — the "last update" stamp is the author-date of
// HEAD at build time (see vite.config.ts `__BUILD_DATE__`), so it
// reflects when the deployed bundle was actually generated rather
// than today's wall clock. Content (gear, software, runtimes,
// socials) pulls straight from /uses so the two pages can never
// drift.
//
// https://humanstxt.org

declare const __BUILD_DATE__: string;

export const Route = createFileRoute('/humans.txt')({
  server: {
    handlers: {
      GET: () => {
        const socials = SOCIALS.filter((s) => s.url).map((s) => `  ${s.net}: ${s.handle}`).join('\n');

        const hardware = USES.hardware.map((h) => `    ${h.name}${h.tag ? ` · ${h.tag}` : ''}`).join('\n');
        const software = USES.software.map((s) => `    ${s.name} · ${s.tag}`).join('\n');
        const runtime = USES.runtime.map((r) => `    ${r.name} · ${r.tag}`).join('\n');

        const body =
          `/* TEAM */\n` +
          `  name: ${SITE.name}\n` +
          `  role: everything\n` +
          `  location: ${SITE.location}\n` +
          `  contact: ${SITE.email}\n` +
          socials + '\n\n' +
          `/* SITE */\n` +
          `  last update: ${__BUILD_DATE__}\n` +
          `  standards: html5, css, wcag 2.1 aa, indieweb\n` +
          `  language: typescript, react\n\n` +
          `/* HARDWARE */\n` +
          hardware + '\n\n' +
          `/* SOFTWARE */\n` +
          software + '\n\n' +
          `/* RUNTIME */\n` +
          runtime + '\n\n' +
          `/* THANKS */\n` +
          `  atproto, bluesky, whitewind, constellation, tanstack,\n` +
          `  vite, cloudflare workers, radix, lucide, mediabunny\n`;

        return new Response(body, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      },
    },
  },
});
