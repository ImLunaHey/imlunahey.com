import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Character ramps ordered dark → light. The ascii output maps each cell's
// average luminance to one of these glyphs. More characters = finer gradient,
// at the cost of legibility when the grid is small.
const RAMPS: { id: string; label: string; chars: string }[] = [
  { id: 'standard', label: 'standard', chars: ' .:-=+*#%@' },
  { id: 'dense', label: 'dense', chars: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { id: 'blocks', label: 'unicode blocks', chars: ' ░▒▓█' },
  { id: 'bars', label: 'unicode bars', chars: ' ▁▂▃▄▅▆▇█' },
  { id: 'binary', label: 'binary', chars: ' 01' },
  { id: 'braille', label: 'braille', chars: ' ⠁⠃⠇⡇⣇⣧⣷⣿' },
];

function asciiFromCanvas(
  canvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  ramp: string,
  contrast: number,
  invert: boolean,
): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const cellW = width / cols;
  const cellH = height / rows;

  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const sx = Math.floor(x * cellW);
      const sy = Math.floor(y * cellH);
      const ex = Math.min(width, Math.floor((x + 1) * cellW));
      const ey = Math.min(height, Math.floor((y + 1) * cellH));
      let sum = 0, n = 0;
      for (let py = sy; py < ey; py++) {
        for (let px = sx; px < ex; px++) {
          const i = (py * width + px) * 4;
          // rec. 709 luma
          sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
          n++;
        }
      }
      let lum = n ? sum / n : 0;
      lum = (lum - 128) * contrast + 128;
      lum = Math.max(0, Math.min(255, lum));
      if (invert) lum = 255 - lum;
      const idx = Math.min(ramp.length - 1, Math.floor((lum / 255) * ramp.length));
      line += ramp[idx];
    }
    out.push(line);
  }
  return out.join('\n');
}

export default function AsciiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rampId, setRampId] = useState('standard');
  const [cols, setCols] = useState(100);
  const [contrast, setContrast] = useState(1.1);
  const [invert, setInvert] = useState(false);
  const [ascii, setAscii] = useState<string>('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const ramp = useMemo(() => RAMPS.find((r) => r.id === rampId)?.chars ?? RAMPS[0].chars, [rampId]);

  const onPick = useCallback(async (f: File) => {
    setFile(f);
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(URL.createObjectURL(f));
  }, [imgUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void onPick(f);
  }, [onPick]);

  // render to canvas whenever the file changes or size controls change
  useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // keep aspect ratio: rows chosen so character cells are ~2:1 tall
      const aspect = img.width / img.height;
      const charAspect = 0.5; // a typical monospace glyph is ~half as wide as tall
      const rows = Math.max(8, Math.round(cols / aspect * charAspect));
      const cellPx = 8;
      canvas.width = cols * cellPx;
      canvas.height = rows * cellPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setImgSize({ w: img.width, h: img.height });
      setAscii(asciiFromCanvas(canvas, cols, rows, ramp, contrast, invert));
    };
    img.src = imgUrl;
  }, [imgUrl, cols, ramp, contrast, invert]);

  const copy = () => {
    navigator.clipboard.writeText(ascii);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ascii">
        <header className="page-hd">
          <div className="label">~/labs/ascii</div>
          <h1>ascii<span className="dot">.</span></h1>
          <p className="sub">
            drop a photo — rec.709 luma is averaged per cell, then mapped through a character ramp of your choice.
            all client-side, copy the result as plain text.
          </p>
        </header>

        <section
          className={`drop ${file ? 'has' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }}
          />
          {file && imgUrl ? (
            <div className="drop-info">
              <img src={imgUrl} className="drop-preview" alt="" />
              <div>
                <div className="drop-name">{file.name}</div>
                <div className="drop-meta">
                  {imgSize ? `${imgSize.w} × ${imgSize.h}` : ''} · {(file.size / 1024).toFixed(1)} kb
                </div>
              </div>
            </div>
          ) : (
            <div className="drop-empty">
              <div className="drop-glyph">◪</div>
              <div>drop an image, or click to pick</div>
            </div>
          )}
        </section>

        {file ? (
          <>
            <section className="controls">
              <label className="ctrl">
                <span className="ctrl-k">width · {cols} chars</span>
                <input type="range" min={20} max={240} step={2} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
              </label>
              <label className="ctrl">
                <span className="ctrl-k">contrast · {contrast.toFixed(2)}</span>
                <input type="range" min={0.5} max={3} step={0.05} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
              </label>
              <label className="ctrl">
                <span className="ctrl-k">ramp</span>
                <select value={rampId} onChange={(e) => setRampId(e.target.value)}>
                  {RAMPS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="ctrl ctrl-check">
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                invert
              </label>
              <button className="copy-btn" onClick={copy}>{copied ? 'copied ✓' : 'copy →'}</button>
            </section>

            <canvas ref={canvasRef} hidden />

            <pre className="out">{ascii}</pre>
          </>
        ) : null}

        <footer className="labs-footer">
          <span>ramps · <span className="t-accent">7 glyph scales, all pure unicode</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-ascii { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .drop { margin-top: var(--sp-6); border: 2px dashed var(--color-border); background: var(--color-bg-panel); padding: var(--sp-6); cursor: pointer; transition: border-color .12s; }
  .drop.has { border-style: solid; }
  .drop:hover { border-color: var(--color-accent-dim); }
  .drop-empty { text-align: center; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .drop-glyph { font-size: 56px; color: var(--color-accent-dim); margin-bottom: var(--sp-2); }
  .drop-info { display: flex; align-items: center; gap: var(--sp-4); }
  .drop-preview { width: 72px; height: 72px; object-fit: cover; border: 1px solid var(--color-border); }
  .drop-name { color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .drop-meta { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; }

  .controls { margin-top: var(--sp-4); display: flex; gap: var(--sp-4); flex-wrap: wrap; align-items: end; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .ctrl { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .ctrl-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .ctrl select { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-fg); padding: 4px 8px; font-family: inherit; font-size: var(--fs-sm); }
  .ctrl input[type="range"] { accent-color: var(--color-accent); width: 180px; }
  .ctrl-check { flex-direction: row; gap: 6px; align-items: center; color: var(--color-fg-dim); }
  .ctrl-check input { accent-color: var(--color-accent); }
  .copy-btn { margin-left: auto; background: var(--color-accent); color: var(--color-bg); border: 0; padding: 8px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .copy-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .out {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.05;
    color: var(--color-fg);
    white-space: pre;
    overflow: auto;
    max-height: 80vh;
  }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
