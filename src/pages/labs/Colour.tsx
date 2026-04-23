import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Rgb = { r: number; g: number; b: number; a: number };

// ─── sRGB ⇄ linear ───────────────────────────────────────────────────────

const sRgbToLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const linearToSRgb = (c: number) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

// ─── parsers ─────────────────────────────────────────────────────────────

function parseHex(s: string): Rgb | null {
  const t = s.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(t)) {
    const r = parseInt(t[0] + t[0], 16);
    const g = parseInt(t[1] + t[1], 16);
    const b = parseInt(t[2] + t[2], 16);
    return { r, g, b, a: 1 };
  }
  if (/^[0-9a-f]{4}$/i.test(t)) {
    const r = parseInt(t[0] + t[0], 16);
    const g = parseInt(t[1] + t[1], 16);
    const b = parseInt(t[2] + t[2], 16);
    const a = parseInt(t[3] + t[3], 16) / 255;
    return { r, g, b, a };
  }
  if (/^[0-9a-f]{6}$/i.test(t)) {
    return { r: parseInt(t.slice(0, 2), 16), g: parseInt(t.slice(2, 4), 16), b: parseInt(t.slice(4, 6), 16), a: 1 };
  }
  if (/^[0-9a-f]{8}$/i.test(t)) {
    return {
      r: parseInt(t.slice(0, 2), 16),
      g: parseInt(t.slice(2, 4), 16),
      b: parseInt(t.slice(4, 6), 16),
      a: parseInt(t.slice(6, 8), 16) / 255,
    };
  }
  return null;
}

function parseRgb(s: string): Rgb | null {
  const m = /^rgba?\(\s*([0-9.]+)(%?)\s*[,\s]\s*([0-9.]+)(%?)\s*[,\s]\s*([0-9.]+)(%?)\s*(?:[,/]\s*([0-9.]+)(%?))?\s*\)$/i.exec(s.trim());
  if (!m) return null;
  const n = (v: string, pct: string) => pct ? (Number(v) / 100) * 255 : Number(v);
  return {
    r: n(m[1], m[2]),
    g: n(m[3], m[4]),
    b: n(m[5], m[6]),
    a: m[7] ? (m[8] ? Number(m[7]) / 100 : Number(m[7])) : 1,
  };
}

function parseHsl(s: string): Rgb | null {
  const m = /^hsla?\(\s*([0-9.]+)(deg|turn|rad|grad)?\s*[,\s]\s*([0-9.]+)%?\s*[,\s]\s*([0-9.]+)%?\s*(?:[,/]\s*([0-9.]+)(%?))?\s*\)$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  if (m[2] === 'turn') h *= 360;
  else if (m[2] === 'rad') h *= 180 / Math.PI;
  else if (m[2] === 'grad') h *= 0.9;
  const sPct = Number(m[3]) / 100;
  const l = Number(m[4]) / 100;
  const a = m[5] ? (m[6] ? Number(m[5]) / 100 : Number(m[5])) : 1;
  return { ...hslToRgb(h, sPct, l), a };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function parseCmyk(s: string): Rgb | null {
  const m = /^cmyk\(\s*([0-9.]+)%?\s*[,\s]\s*([0-9.]+)%?\s*[,\s]\s*([0-9.]+)%?\s*[,\s]\s*([0-9.]+)%?\s*(?:[,/]\s*([0-9.]+)(%?))?\s*\)$/i.exec(s.trim());
  if (!m) return null;
  const c = Number(m[1]) / 100;
  const mg = Number(m[2]) / 100;
  const y = Number(m[3]) / 100;
  const k = Number(m[4]) / 100;
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - mg) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  const a = m[5] ? (m[6] ? Number(m[5]) / 100 : Number(m[5])) : 1;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
}

function parseHsv(s: string): Rgb | null {
  const m = /^hsva?\(\s*([0-9.]+)(deg|turn|rad|grad)?\s*[,\s]\s*([0-9.]+)%?\s*[,\s]\s*([0-9.]+)%?\s*(?:[,/]\s*([0-9.]+)(%?))?\s*\)$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  if (m[2] === 'turn') h *= 360;
  else if (m[2] === 'rad') h *= 180 / Math.PI;
  else if (m[2] === 'grad') h *= 0.9;
  const sat = Number(m[3]) / 100;
  const v = Number(m[4]) / 100;
  const a = m[5] ? (m[6] ? Number(m[5]) / 100 : Number(m[5])) : 1;
  return { ...hsvToRgb(h, sat, v), a };
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

// ─── Oklch ⇄ sRGB ────────────────────────────────────────────────────────

function rgbToOklch({ r, g, b }: Rgb): { l: number; c: number; h: number } {
  const lr = sRgbToLinear(r / 255), lg = sRgbToLinear(g / 255), lb = sRgbToLinear(b / 255);
  const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(L), m_ = Math.cbrt(M), s_ = Math.cbrt(S);
  const lab_L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const lab_a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const lab_b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(lab_a * lab_a + lab_b * lab_b);
  const Hraw = Math.atan2(lab_b, lab_a) * 180 / Math.PI;
  return { l: lab_L, c: C, h: (Hraw + 360) % 360 };
}

function oklchToRgb(L: number, C: number, Hdeg: number): Rgb {
  const h = Hdeg * Math.PI / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const lmsL = l_ * l_ * l_;
  const lmsM = m_ * m_ * m_;
  const lmsS = s_ * s_ * s_;
  const lr = +4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS;
  const lg = -1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS;
  const lb = -0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.7076147010 * lmsS;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    r: Math.round(clamp(linearToSRgb(clamp(lr))) * 255),
    g: Math.round(clamp(linearToSRgb(clamp(lg))) * 255),
    b: Math.round(clamp(linearToSRgb(clamp(lb))) * 255),
    a: 1,
  };
}

// ─── parse any ───────────────────────────────────────────────────────────

function parseAny(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('#') || /^[0-9a-f]{3,8}$/.test(s)) return parseHex(s);
  if (s.startsWith('rgb')) return parseRgb(s);
  if (s.startsWith('hsl')) return parseHsl(s);
  if (s.startsWith('hsv')) return parseHsv(s);
  if (s.startsWith('cmyk')) return parseCmyk(s);
  // oklch(l c h / a)
  const ok = /^oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)\s*(?:\/\s*([0-9.]+)%?)?\s*\)$/i.exec(s);
  if (ok) {
    let L = Number(ok[1]);
    if (s.includes('%')) L /= 100;
    const rgb = oklchToRgb(L, Number(ok[2]), Number(ok[3]));
    if (ok[4]) rgb.a = ok[4].includes('.') ? Number(ok[4]) : Number(ok[4]) / 100;
    return rgb;
  }
  // CSS named colors — delegate to DOM
  if (/^[a-z]+$/.test(s)) {
    try {
      const el = document.createElement('span');
      el.style.color = s;
      if (!el.style.color) return null;
      document.body.appendChild(el);
      const cs = getComputedStyle(el).color;
      document.body.removeChild(el);
      return parseRgb(cs);
    } catch { return null; }
  }
  return null;
}

// ─── formatters ──────────────────────────────────────────────────────────

function hex2(n: number): string { return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0'); }
function fmtHex({ r, g, b, a }: Rgb): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a < 1 ? `${base}${hex2(a * 255)}` : base;
}
function fmtRgb({ r, g, b, a }: Rgb): string {
  const rr = Math.round(r), gg = Math.round(g), bb = Math.round(b);
  return a < 1 ? `rgb(${rr} ${gg} ${bb} / ${a.toFixed(2)})` : `rgb(${rr} ${gg} ${bb})`;
}
function fmtHsl(rgb: Rgb): string {
  const { h, s, l } = rgbToHsl(rgb);
  const H = Math.round(h), S = Math.round(s * 100), L = Math.round(l * 100);
  return rgb.a < 1 ? `hsl(${H} ${S}% ${L}% / ${rgb.a.toFixed(2)})` : `hsl(${H} ${S}% ${L}%)`;
}
function fmtOklch(rgb: Rgb): string {
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
}
function fmtHsv(rgb: Rgb): string {
  const rn = rgb.r / 255, gn = rgb.g / 255, bn = rgb.b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d) % 6; break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `hsv(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(v * 100)}%)`;
}
function fmtCmyk({ r, g, b }: Rgb): string {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return 'cmyk(0% 0% 0% 100%)';
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return `cmyk(${Math.round(c * 100)}% ${Math.round(m * 100)}% ${Math.round(y * 100)}% ${Math.round(k * 100)}%)`;
}

function relLuminance({ r, g, b }: Rgb): number {
  const rr = sRgbToLinear(r / 255), gg = sRgbToLinear(g / 255), bb = sRgbToLinear(b / 255);
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function contrastAgainst(rgb: Rgb, bg: Rgb): number {
  const l1 = relLuminance(rgb);
  const l2 = relLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

// ─── component ───────────────────────────────────────────────────────────

export default function ColourPage() {
  const [input, setInput] = useState('oklch(0.86 0.19 145)');
  const rgb = useMemo(() => parseAny(input), [input]);

  const valid = rgb !== null;
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);

  const update = (newRgb: Rgb) => {
    setInput(fmtHex(newRgb));
  };

  const setHslComponent = (key: 'h' | 's' | 'l', value: number) => {
    if (!rgb || !hsl) return;
    const next = { ...hsl, [key]: value };
    const newRgb = hslToRgb(next.h, next.s, next.l);
    update({ ...newRgb, a: rgb.a });
  };

  const setRgbComponent = (key: 'r' | 'g' | 'b', value: number) => {
    if (!rgb) return;
    update({ ...rgb, [key]: value });
  };

  const formats = rgb ? [
    { name: 'hex', value: fmtHex(rgb) },
    { name: 'rgb', value: fmtRgb(rgb) },
    { name: 'hsl', value: fmtHsl(rgb) },
    { name: 'hsv', value: fmtHsv(rgb) },
    { name: 'oklch', value: fmtOklch(rgb) },
    { name: 'cmyk', value: fmtCmyk(rgb) },
  ] : [];

  const onDark = rgb ? contrastAgainst(rgb, { r: 10, g: 10, b: 10, a: 1 }) : 0;
  const onLight = rgb ? contrastAgainst(rgb, { r: 245, g: 245, b: 245, a: 1 }) : 0;
  const contrastGrade = (v: number) => v >= 7 ? 'AAA' : v >= 4.5 ? 'AA' : v >= 3 ? 'AA-large' : '✗';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cl">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">colour</span>
        </div>

        <header className="cl-hd">
          <h1>colour<span className="dot">.</span></h1>
          <p className="sub">
            type a colour in any format — hex, rgb, hsl, oklch, or a css named colour. see it rendered
            and converted to every other format, side-by-side. sliders below keep the input in sync.
          </p>
        </header>

        <form className="cl-input-row" onSubmit={(e) => e.preventDefault()}>
          <input
            className={`cl-input ${!valid && input ? 'err' : ''}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="oklch(0.86 0.19 145) · #ff00ff · rgb(255 0 255) · coral"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="cl-tag">{valid ? '✓ valid' : '✗ invalid'}</span>
        </form>

        <section className="cl-hero">
          <div
            className="cl-swatch"
            style={{
              background: valid && rgb ? fmtHex(rgb) : '#1a1a1a',
            }}
          >
            {valid && rgb ? (
              <>
                <div className="cl-swatch-contrast" style={{ color: onDark > onLight ? '#eee' : '#111' }}>
                  <span className="cl-swatch-hex">{fmtHex(rgb).toUpperCase()}</span>
                </div>
                <div className="cl-swatch-a11y">
                  <span>on dark · <b>{onDark.toFixed(2)}</b> <span className={`cl-ax cl-ax-${contrastGrade(onDark).toLowerCase()}`}>{contrastGrade(onDark)}</span></span>
                  <span>on light · <b>{onLight.toFixed(2)}</b> <span className={`cl-ax cl-ax-${contrastGrade(onLight).toLowerCase()}`}>{contrastGrade(onLight)}</span></span>
                </div>
              </>
            ) : (
              <div className="cl-swatch-empty">invalid colour</div>
            )}
          </div>

          <div className="cl-formats">
            {formats.map((f) => (
              <button
                key={f.name}
                className="cl-format"
                onClick={() => { try { navigator.clipboard.writeText(f.value); setInput(f.value); } catch { /* noop */ } }}
                title="click to copy + load"
              >
                <span className="cl-format-k">{f.name}</span>
                <span className="cl-format-v">{f.value}</span>
              </button>
            ))}
          </div>
        </section>

        {rgb ? (
          <section className="cl-sliders">
            <div className="cl-sliders-group">
              <div className="cl-sliders-hd">── rgb</div>
              {(['r', 'g', 'b'] as const).map((k) => (
                <div className="cl-slider-row" key={k}>
                  <span className="cl-slider-lbl">{k}</span>
                  <input
                    type="range" min={0} max={255} step={1}
                    value={Math.round(rgb[k])}
                    onChange={(e) => setRgbComponent(k, Number(e.target.value))}
                    className={`cl-slider cl-slider-${k}`}
                    style={{
                      background: `linear-gradient(to right, ${fmtHex({ ...rgb, [k]: 0 })}, ${fmtHex({ ...rgb, [k]: 255 })})`,
                    }}
                  />
                  <span className="cl-slider-val">{Math.round(rgb[k])}</span>
                </div>
              ))}
            </div>
            <div className="cl-sliders-group">
              <div className="cl-sliders-hd">── hsl</div>
              {hsl ? ([
                { k: 'h' as const, min: 0, max: 360, value: hsl.h, display: Math.round(hsl.h) + '°' },
                { k: 's' as const, min: 0, max: 1, step: 0.01, value: hsl.s, display: Math.round(hsl.s * 100) + '%' },
                { k: 'l' as const, min: 0, max: 1, step: 0.01, value: hsl.l, display: Math.round(hsl.l * 100) + '%' },
              ]).map((row) => (
                <div className="cl-slider-row" key={row.k}>
                  <span className="cl-slider-lbl">{row.k}</span>
                  <input
                    type="range" min={row.min} max={row.max} step={row.step ?? 1}
                    value={row.value}
                    onChange={(e) => setHslComponent(row.k, Number(e.target.value))}
                    className="cl-slider"
                  />
                  <span className="cl-slider-val">{row.display}</span>
                </div>
              )) : null}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

const CSS = `
  .shell-cl { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .cl-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .cl-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .cl-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .cl-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .cl-input-row {
    display: flex;
    margin: var(--sp-5) 0 var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .cl-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .cl-input.err { color: var(--color-alert); }
  .cl-tag {
    display: flex; align-items: center;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-accent);
    background: var(--color-bg-raised);
    border-left: 1px solid var(--color-border);
  }
  .cl-input.err + .cl-tag { color: var(--color-alert); }

  .cl-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    margin-bottom: var(--sp-5);
  }
  .cl-swatch {
    position: relative;
    aspect-ratio: 3/2;
    border: 1px solid var(--color-border);
    overflow: hidden;
    min-height: 220px;
    display: flex; flex-direction: column;
    justify-content: space-between;
    padding: var(--sp-4);
    transition: background 0.15s;
  }
  .cl-swatch-empty {
    color: var(--color-fg-faint);
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    margin: auto;
  }
  .cl-swatch-hex {
    font-family: var(--font-display);
    font-size: clamp(24px, 3.5vw, 36px);
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .cl-swatch-a11y {
    font-family: var(--font-mono);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: rgba(0, 0, 0, 0.7);
    background: rgba(255, 255, 255, 0.55);
    padding: 6px 10px;
    align-self: flex-start;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .cl-swatch-a11y b { color: #000; font-weight: 600; }
  .cl-ax {
    display: inline-block; padding: 0 4px; margin-left: 4px;
    border: 1px solid currentColor; font-size: 10px;
    color: #000;
  }
  .cl-ax-aaa { color: #006600; border-color: #006600; background: rgba(0, 200, 0, 0.2); }
  .cl-ax-aa { color: #226622; border-color: #226622; background: rgba(0, 200, 0, 0.1); }
  .cl-ax-\\✗ { color: #aa0000; border-color: #aa0000; }

  .cl-formats {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cl-format {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: var(--sp-3);
    align-items: baseline;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    font-family: var(--font-mono);
    text-align: left;
    font-size: var(--fs-sm);
    transition: border-color 0.1s;
  }
  .cl-format:hover { border-color: var(--color-accent-dim); }
  .cl-format-k {
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: var(--fs-xs);
  }
  .cl-format:hover .cl-format-k { color: var(--color-accent); }
  .cl-format-v { color: var(--color-fg); word-break: break-word; }

  .cl-sliders {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
    padding-bottom: var(--sp-10);
  }
  .cl-sliders-group {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
  }
  .cl-sliders-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .cl-slider-row {
    display: grid;
    grid-template-columns: 16px 1fr 60px;
    gap: var(--sp-3);
    align-items: center;
    padding: 4px 0;
  }
  .cl-slider-lbl {
    font-family: var(--font-mono);
    color: var(--color-fg-faint);
    text-transform: uppercase;
    font-size: var(--fs-xs);
  }
  .cl-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 10px;
    border: 1px solid var(--color-border);
    outline: 0;
    cursor: pointer;
  }
  .cl-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--color-bg);
    border: 2px solid var(--color-accent);
    border-radius: 50%;
    cursor: pointer;
  }
  .cl-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    background: var(--color-bg);
    border: 2px solid var(--color-accent);
    border-radius: 50%;
  }
  .cl-slider-val {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-accent);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 700px) {
    .cl-hero { grid-template-columns: 1fr; }
    .cl-sliders { grid-template-columns: 1fr; }
  }
`;
