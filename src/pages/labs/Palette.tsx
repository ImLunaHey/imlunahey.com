import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type RGB = [number, number, number];
type Swatch = { rgb: RGB; hex: string; oklch: string; weight: number };

const K_OPTIONS = [3, 5, 8, 12] as const;
const SAMPLE_CAP = 8000;

function sample(img: HTMLImageElement, maxSamples = SAMPLE_CAP): RGB[] {
  const canvas = document.createElement('canvas');
  const total = img.naturalWidth * img.naturalHeight;
  const scale = total > maxSamples ? Math.sqrt(maxSamples / total) : 1;
  const w = Math.max(1, Math.floor(img.naturalWidth * scale));
  const h = Math.max(1, Math.floor(img.naturalHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas 2d context');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // drop near-transparent
    out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}

function kmeans(pixels: RGB[], k: number, maxIter = 16): { rgb: RGB; weight: number }[] {
  if (pixels.length === 0) return [];
  const kUse = Math.min(k, pixels.length);
  // k-means++ style init: pick the first pixel, then each subsequent farthest-from-existing
  const centers: RGB[] = [[...pixels[0]]];
  while (centers.length < kUse) {
    let best: RGB | null = null;
    let bestMinD = -1;
    for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 200))) {
      const p = pixels[i];
      let minD = Infinity;
      for (const c of centers) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestMinD) {
        bestMinD = minD;
        best = p;
      }
    }
    centers.push([...(best ?? pixels[centers.length % pixels.length])]);
  }

  const assignments = new Int32Array(pixels.length);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kUse; c++) {
        const cc = centers[c];
        const d = (p[0] - cc[0]) ** 2 + (p[1] - cc[1]) ** 2 + (p[2] - cc[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        changed = true;
        assignments[i] = best;
      }
    }
    if (!changed && iter > 0) break;
    const sums = Array.from({ length: kUse }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      sums[c][3] += 1;
    }
    for (let c = 0; c < kUse; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  const weights = new Array<number>(kUse).fill(0);
  for (const a of assignments) weights[a]++;
  return centers
    .map((rgb, i) => ({ rgb: rgb.map(Math.round) as RGB, weight: weights[i] }))
    .sort((a, b) => b.weight - a.weight);
}

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function rgbToOklab([r, g, b]: RGB): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.680_6995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793_617_785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428_592_205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808_675_766 * s_,
  ];
}

function rgbToOklchString(rgb: RGB): string {
  const [L, a, b] = rgbToOklab(rgb);
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`;
}

function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function relativeLuminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export default function PalettePage() {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState<number>(8);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: (files) => {
      const f = files[0];
      if (!f) return;
      if (url) URL.revokeObjectURL(url);
      setFile(f);
      setUrl(URL.createObjectURL(f));
      setError(null);
      setSwatches([]);
    },
  });

  const extract = () => {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    setBusy(true);
    setError(null);
    // defer so the spinner gets a chance to render
    setTimeout(() => {
      try {
        const pixels = sample(img);
        const clusters = kmeans(pixels, k);
        const total = clusters.reduce((s, c) => s + c.weight, 0) || 1;
        const next: Swatch[] = clusters.map((c) => ({
          rgb: c.rgb,
          hex: rgbToHex(c.rgb),
          oklch: rgbToOklchString(c.rgb),
          weight: c.weight / total,
        }));
        setSwatches(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    }, 16);
  };

  useEffect(() => {
    if (!url) return;
    // re-run when k changes or a new image loads
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      extract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, k]);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const cssBlock =
    swatches.length > 0
      ? ':root {\n' + swatches.map((s, i) => `  --c-${i + 1}: ${s.hex};`).join('\n') + '\n}'
      : '';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-p">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">palette</span>
        </div>

        <header className="p-hd">
          <h1>
            palette<span className="dot">.</span>
          </h1>
          <p className="sub">
            drop an image and extract its dominant colors via k-means clustering on sampled pixels — ~8k samples
            max so it stays snappy on large images. outputs hex + oklch and copies either on click.
          </p>
        </header>

        <div className="controls">
          <label
            {...getRootProps({ className: 'dz' + (isDragActive ? ' active' : '') + (url ? ' has-file' : '') })}
          >
            <input {...getInputProps()} />
            {url ? (
              <>
                <img ref={imgRef} src={url} alt="" className="dz-preview" onLoad={extract} />
                <div className="dz-name">{file?.name ?? 'image'}</div>
              </>
            ) : (
              <div className="dz-empty">
                <div className="dz-icon">⊞</div>
                <div className="dz-ttl">drop image or click to browse</div>
                <div className="dz-sub">png, jpg, webp, gif</div>
              </div>
            )}
          </label>

          <div className="ctrl-rail">
            <div className="k-label">colors</div>
            <div className="k-row">
              {K_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={'k-btn' + (k === n ? ' on' : '')}
                  onClick={() => setK(n)}
                  disabled={busy}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <section className="err">
            <div className="err-hd">// error</div>
            <div className="err-body">{error}</div>
          </section>
        ) : null}

        {busy && swatches.length === 0 ? (
          <section className="prog">
            <div className="prog-line">sampling pixels + clustering…</div>
            <div className="prog-bar">
              <div className="prog-bar-indeterminate" />
            </div>
          </section>
        ) : null}

        {swatches.length > 0 ? (
          <>
            <section className="band" aria-hidden>
              {swatches.map((s, i) => (
                <div
                  key={i}
                  className="band-seg"
                  style={{ background: s.hex, flex: s.weight }}
                  title={`${s.hex} · ${Math.round(s.weight * 100)}%`}
                />
              ))}
            </section>

            <section className="grid">
              {swatches.map((s, i) => (
                <SwatchCard key={i} swatch={s} copied={copied} onCopy={copy} />
              ))}
            </section>

            <section className="css-export">
              <div className="export-hd">
                <span>// css export</span>
                <button
                  type="button"
                  className={'copy' + (copied === cssBlock ? ' flash' : '')}
                  onClick={() => copy(cssBlock)}
                >
                  {copied === cssBlock ? 'copied' : 'copy all'}
                </button>
              </div>
              <pre className="export-body">{cssBlock}</pre>
            </section>
          </>
        ) : null}

        <footer className="p-footer">
          <span>
            src: <span className="t-accent">canvas2d imageData · k-means++ · oklab conversion</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">
              all labs
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function SwatchCard({
  swatch,
  copied,
  onCopy,
}: {
  swatch: Swatch;
  copied: string | null;
  onCopy: (s: string) => void;
}) {
  const lum = relativeLuminance(swatch.rgb);
  const fg = lum > 0.4 ? '#000' : '#fff';
  return (
    <article className="swatch" style={{ background: swatch.hex, color: fg }}>
      <div className="sw-weight">{Math.round(swatch.weight * 100)}%</div>
      <div className="sw-values">
        <button type="button" className={'sw-val' + (copied === swatch.hex ? ' flash' : '')} onClick={() => onCopy(swatch.hex)}>
          {swatch.hex}
        </button>
        <button type="button" className={'sw-val' + (copied === swatch.oklch ? ' flash' : '')} onClick={() => onCopy(swatch.oklch)}>
          {swatch.oklch}
        </button>
      </div>
    </article>
  );
}

const CSS = `
  .shell-p { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-6);
    margin-bottom: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .crumbs .last { color: var(--color-accent); }

  .p-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .p-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .p-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .p-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }

  .controls {
    display: grid;
    grid-template-columns: 1fr 160px;
    gap: var(--sp-4);
    margin-top: var(--sp-6);
    align-items: start;
  }
  @media (max-width: 640px) {
    .controls { grid-template-columns: 1fr; }
  }

  /* dropzone */
  .dz {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    min-height: 260px;
    padding: var(--sp-4);
    border: 1px dashed var(--color-border-bright);
    background: var(--color-bg-panel);
    cursor: pointer;
    overflow: hidden;
  }
  .dz:hover { border-color: var(--color-accent-dim); }
  .dz.active { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel)); }
  .dz.has-file { border-style: solid; border-color: var(--color-accent-dim); padding: 0; }
  .dz-empty {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    font-family: var(--font-mono);
    text-align: center;
  }
  .dz-icon { font-size: 40px; color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); line-height: 1; }
  .dz-ttl { font-size: var(--fs-sm); color: var(--color-fg); }
  .dz-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .dz-preview {
    display: block;
    max-width: 100%;
    max-height: 400px;
    margin: 0 auto;
    object-fit: contain;
  }
  .dz-name {
    position: absolute;
    top: 6px; left: 6px;
    padding: 2px 8px;
    background: color-mix(in oklch, var(--color-bg) 80%, transparent);
    border: 1px solid var(--color-border-bright);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    pointer-events: none;
  }

  .ctrl-rail {
    display: flex; flex-direction: column; gap: var(--sp-2);
    padding: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .k-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .k-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
  .k-btn {
    padding: 8px 0;
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .k-btn:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .k-btn.on { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 10%, var(--color-bg-panel)); }
  .k-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* band */
  .band {
    display: flex;
    height: 40px;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
  }
  .band-seg { min-width: 4px; }

  /* grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 6px;
    margin-top: 6px;
  }
  .swatch {
    padding: var(--sp-4);
    min-height: 120px;
    border: 1px solid var(--color-border);
    display: flex; flex-direction: column;
    justify-content: space-between;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .sw-weight { font-size: 10px; opacity: 0.8; letter-spacing: 0.14em; text-transform: uppercase; }
  .sw-values { display: flex; flex-direction: column; gap: 2px; }
  .sw-val {
    padding: 4px 8px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    font: inherit;
    font-family: var(--font-mono);
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    opacity: 0.75;
  }
  .sw-val:hover { opacity: 1; }
  .sw-val.flash { opacity: 1; background: rgba(255, 255, 255, 0.15); }

  /* css export */
  .css-export {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .export-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .copy {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit; font-size: 10px;
    padding: 2px 10px; cursor: pointer;
    font-family: var(--font-mono);
    text-transform: lowercase;
  }
  .copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }
  .export-body {
    margin: 0;
    padding: var(--sp-4) var(--sp-5);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-fg);
    white-space: pre;
    overflow-x: auto;
  }

  /* progress / error */
  .prog {
    margin-top: var(--sp-5);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .prog-line { margin-bottom: var(--sp-2); }
  .prog-bar { height: 4px; background: var(--color-border); overflow: hidden; }
  .prog-bar-indeterminate {
    height: 100%; width: 30%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
    animation: prog-slide 1.2s ease-in-out infinite;
  }
  @keyframes prog-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  .err {
    margin-top: var(--sp-5);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .err-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-alert) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-alert);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .err-body { padding: var(--sp-4) var(--sp-5); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .p-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
