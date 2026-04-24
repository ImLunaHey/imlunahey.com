/**
 * Critical above-the-fold CSS — inlined into every HTML response so first
 * paint doesn't have to wait for the external stylesheet to download.
 *
 * Scope: design tokens (colours, type scale, spacing), base reset, html /
 * body defaults, link colours, the nav bar, and the CRT scanline overlay.
 * Everything visible on first paint.
 *
 * Deliberately excluded:
 *  - the .noise overlay (decorative data-url SVG, not first-paint critical)
 *  - panels, buttons, inputs, tables, skeletons (below the fold)
 *  - codemirror tweaks (page-specific)
 *  - text utilities used only in page content (kept a minimal set)
 *
 * This block is a subset copy of src/App.css — the full file still loads
 * via <link rel="stylesheet">, so the duplicated rules get reapplied
 * identically once it arrives. No visual flash, minor parse duplication.
 *
 * Keep this under ~4KB minified. If it grows, the added HTML size starts
 * to negate the round-trip savings.
 */
export const CRITICAL_CSS = `
:root {
  --color-bg: #000000;
  --color-bg-raised: #0a0a0a;
  --color-bg-panel: #070707;
  --color-border: #1a1a1a;
  --color-border-bright: #2a2a2a;
  --color-fg: #e6e6e6;
  --color-fg-dim: #9a9a9a;
  --color-fg-faint: #555555;
  --color-fg-ghost: #2a2a2a;
  --color-accent: oklch(0.86 0.19 145);
  --color-accent-dim: oklch(0.55 0.13 145);
  --color-accent-faint: oklch(0.35 0.08 145);
  --color-alert: oklch(0.72 0.19 25);
  --accent-glow: color-mix(in oklch, oklch(0.86 0.19 145) 40%, transparent);
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-display: 'Doto Variable', 'JetBrains Mono Variable', monospace;
  --fs-xs: 11px; --fs-sm: 12px; --fs-md: 13px; --fs-lg: 15px; --fs-xl: 18px;
  --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: clip;
}
a { color: var(--color-accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }
.crt { position: fixed; inset: 0; pointer-events: none; z-index: 1000; mix-blend-mode: overlay; }
.crt::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px); }
.crt::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%); }
.nav {
  display: flex; align-items: center; gap: var(--sp-5);
  padding: var(--sp-4) var(--sp-6);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  position: sticky; top: 0; z-index: 10;
  font-size: var(--fs-sm);
}
.nav .brand {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  color: var(--color-accent);
  text-shadow: 0 0 8px var(--accent-glow);
}
.nav .sp { flex: 1; }
.nav a { color: var(--color-fg-dim); text-decoration: none; }
.nav a:hover, .nav a.active { color: var(--color-accent); text-decoration: none; }
.t-accent { color: var(--color-accent); }
.t-faint { color: var(--color-fg-faint); }
.t-dim { color: var(--color-fg-dim); }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border: 1px solid var(--color-border-bright); font-size: var(--fs-xs); color: var(--color-fg-dim); text-transform: lowercase; }
.chip.accent { border-color: var(--color-accent-dim); color: var(--color-accent); }
@media (max-width: 760px) {
  .nav {
    gap: var(--sp-4); padding: var(--sp-3) var(--sp-4);
    overflow-x: auto; overflow-y: hidden;
    flex-wrap: nowrap; white-space: nowrap;
    scrollbar-width: none;
    mask-image: linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
  }
  .nav::-webkit-scrollbar { display: none; }
  .nav > * { flex-shrink: 0; }
  .nav .sp { display: none; }
  .nav .brand { font-size: var(--fs-lg); }
}
`;
