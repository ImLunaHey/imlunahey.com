import { describe, it, expect } from 'vitest';
import { buildOgSvg } from './og';

describe('buildOgSvg', () => {
  it('produces a well-formed svg for a known slug', () => {
    const svg = buildOgSvg('home');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });

  it('is stable for a pinned slug — poisoning the cdn cache would bite', () => {
    // OG images are rasterised server-side and cached by cloudflare for
    // up to a day. the SVG source is the input to that cache; any
    // accidental change to the template would produce a new image on
    // every edge a few seconds later. snapshot so unintentional drift
    // is caught in review.
    expect(buildOgSvg('lab/wordle')).toMatchSnapshot();
  });

  it('escapes html-unsafe characters in user-provided entry content', () => {
    const entry = {
      title: '<script>alert("xss")</script>',
      subtitle: 'a & b',
      glyph: '<>',
      slug: '/labs/"quoted"',
    };
    const svg = buildOgSvg(entry);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('a &amp; b');
    expect(svg).toContain('&lt;&gt;');
    expect(svg).toContain('&quot;quoted&quot;');
  });

  it('falls back to home entry on an unknown slug string', () => {
    // unreachable at the type level, but the runtime guard exists; the
    // assertion ensures no crash + the home title leaks through so
    // bad URLs rasterise rather than 500.
    const svg = buildOgSvg('lab/not-a-real-slug' as Parameters<typeof buildOgSvg>[0]);
    expect(svg).toContain('luna');
  });
});
