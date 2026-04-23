import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── fft (in-place radix-2 cooley-tukey) ───────────────────────────────────
// Operates on parallel real/imag arrays. N must be a power of 2.

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // butterflies
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const ang = (-2 * Math.PI) / size;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += size) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
        const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const nwRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nwRe;
      }
    }
  }
}

// ─── window fn (hann) + stft ──────────────────────────────────────────────

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

type Spec = {
  frames: number;
  bins: number;
  data: Float32Array; // frames * bins, dB
  maxDb: number;
  minDb: number;
  fftSize: number;
  hop: number;
  sampleRate: number;
  duration: number;
};

function stft(samples: Float32Array, sampleRate: number, fftSize: number, hop: number): Spec {
  const win = hannWindow(fftSize);
  const frames = Math.max(0, Math.floor((samples.length - fftSize) / hop) + 1);
  const bins = fftSize / 2;
  const data = new Float32Array(frames * bins);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  let maxDb = -Infinity;
  let minDb = Infinity;

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = samples[off + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const db = 20 * Math.log10(mag + 1e-9);
      data[f * bins + k] = db;
      if (db > maxDb) maxDb = db;
      if (db < minDb) minDb = db;
    }
  }

  return { frames, bins, data, maxDb, minDb, fftSize, hop, sampleRate, duration: samples.length / sampleRate };
}

// inferno-ish colormap — ~12 stops in srgb, interpolated.
const COLORMAP: [number, number, number][] = [
  [0, 0, 4], [20, 11, 52], [58, 9, 99], [96, 19, 110], [133, 33, 107],
  [169, 46, 94], [203, 65, 73], [230, 93, 47], [247, 131, 17], [252, 173, 18],
  [245, 219, 76], [252, 254, 164],
];

function colorMap(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  const idx = t * (COLORMAP.length - 1);
  const i = Math.floor(idx);
  const frac = idx - i;
  const a = COLORMAP[i];
  const b = COLORMAP[Math.min(i + 1, COLORMAP.length - 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

function renderSpec(canvas: HTMLCanvasElement, spec: Spec, logFreq: boolean, dynamicRange: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.createImageData(W, H);

  const top = spec.maxDb;
  const bottom = top - dynamicRange;

  // log-freq mapping: y = 0 is nyquist, y = H is 0 hz (bottom)
  const minLog = Math.log(20); // avoid 0
  const maxLog = Math.log(spec.sampleRate / 2);

  for (let x = 0; x < W; x++) {
    const f = Math.min(spec.frames - 1, Math.floor((x / W) * spec.frames));
    for (let y = 0; y < H; y++) {
      let k: number;
      if (logFreq) {
        const freq = Math.exp(minLog + (1 - y / H) * (maxLog - minLog));
        k = Math.min(spec.bins - 1, Math.max(0, Math.round((freq / (spec.sampleRate / 2)) * spec.bins)));
      } else {
        k = Math.min(spec.bins - 1, Math.floor((1 - y / H) * spec.bins));
      }
      const db = spec.data[f * spec.bins + k];
      const t = (db - bottom) / (top - bottom);
      const [r, g, b] = colorMap(t);
      const p = (y * W + x) * 4;
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function SpectrogramPage() {
  const [file, setFile] = useState<File | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [fftSize, setFftSize] = useState(2048);
  const [logFreq, setLogFreq] = useState(true);
  const [dynamicRange, setDynamicRange] = useState(80);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const onPick = useCallback(async (f: File, size = fftSize) => {
    setErr(null);
    setLoading(true);
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audio = await ctx.decodeAudioData(buf.slice(0));
      // mix to mono
      const len = audio.length;
      const mono = new Float32Array(len);
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const ch = audio.getChannelData(c);
        for (let i = 0; i < len; i++) mono[i] += ch[i];
      }
      if (audio.numberOfChannels > 1) {
        for (let i = 0; i < len; i++) mono[i] /= audio.numberOfChannels;
      }
      const hop = size / 4;
      // cap frames — for very long audio we'd never render pixel-for-pixel anyway
      const maxFrames = 4096;
      const effectiveHop = Math.max(hop, Math.ceil((len - size) / maxFrames));
      const s = stft(mono, audio.sampleRate, size, effectiveHop);
      setSpec(s);
      await ctx.close();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(f));
    } catch (e) {
      setErr(`decode failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [fftSize, audioUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void onPick(f);
  }, [onPick]);

  useEffect(() => {
    if (spec && canvasRef.current) renderSpec(canvasRef.current, spec, logFreq, dynamicRange);
  }, [spec, logFreq, dynamicRange]);

  // re-analyze on fft size change (only if we already have a file)
  useEffect(() => {
    if (file) void onPick(file, fftSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fftSize]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-spec">
        <header className="page-hd">
          <div className="label">~/labs/spectrogram</div>
          <h1>spectrogram<span className="dot">.</span></h1>
          <p className="sub">
            drop an audio file — mp3, wav, ogg, flac. we decode it with webaudio, run an in-browser fft,
            and render a log-frequency spectrogram with an inferno colormap. every sample stays in your tab.
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
            accept="audio/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }}
          />
          {file ? (
            <div className="drop-info">
              <div className="drop-glyph">♪</div>
              <div>
                <div className="drop-name">{file.name}</div>
                <div className="drop-meta">
                  {(file.size / 1024 / 1024).toFixed(2)} mb
                  {spec ? ` · ${spec.duration.toFixed(1)}s · ${spec.sampleRate} hz · ${spec.frames} frames` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="drop-empty">
              <div className="drop-glyph">♪</div>
              <div>drop audio here, or click to pick</div>
            </div>
          )}
        </section>

        {err ? <div className="err">{err}</div> : null}

        {loading ? <div className="loading">decoding + running fft…</div> : null}

        {spec ? (
          <>
            <div className="controls">
              <label className="ctrl">
                <span className="ctrl-k">fft size</span>
                <select
                  value={fftSize}
                  onChange={(e) => setFftSize(Number(e.target.value))}
                >
                  {[512, 1024, 2048, 4096, 8192].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="ctrl">
                <span className="ctrl-k">freq scale</span>
                <button
                  className={`toggle ${logFreq ? 'on' : ''}`}
                  onClick={() => setLogFreq((v) => !v)}
                >{logFreq ? 'log' : 'linear'}</button>
              </label>
              <label className="ctrl">
                <span className="ctrl-k">dynamic range · {dynamicRange} db</span>
                <input
                  type="range"
                  min={30}
                  max={120}
                  step={5}
                  value={dynamicRange}
                  onChange={(e) => setDynamicRange(Number(e.target.value))}
                />
              </label>
            </div>

            {audioUrl ? (
              <audio ref={audioRef} className="player" src={audioUrl} controls preload="metadata" />
            ) : null}

            <div className="spec-wrap">
              <div className="spec-y">
                <span>{Math.round(spec.sampleRate / 2 / 1000)}k</span>
                <span>{logFreq ? '1k' : `${Math.round(spec.sampleRate / 4 / 1000)}k`}</span>
                <span>{logFreq ? '100' : `${Math.round(spec.sampleRate / 4 / 2 / 1000)}k`}</span>
                <span>0</span>
              </div>
              <canvas ref={canvasRef} width={1200} height={400} className="spec" />
              <div className="spec-ylbl">freq (hz)</div>
            </div>
            <div className="spec-x">
              <span>0s</span>
              <span>{(spec.duration / 2).toFixed(1)}s</span>
              <span>{spec.duration.toFixed(1)}s</span>
            </div>
          </>
        ) : null}

        <footer className="labs-footer">
          <span>fft · <span className="t-accent">radix-2 cooley-tukey, hand-rolled</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-spec { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9;
  }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .drop {
    margin-top: var(--sp-6);
    border: 2px dashed var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-6);
    cursor: pointer;
    transition: border-color .12s;
  }
  .drop.has { border-style: solid; }
  .drop:hover { border-color: var(--color-accent-dim); }
  .drop-empty { text-align: center; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .drop-glyph { font-size: 48px; color: var(--color-accent-dim); margin-bottom: var(--sp-2); }
  .drop-info { display: flex; align-items: center; gap: var(--sp-4); }
  .drop-info .drop-glyph { margin: 0; font-size: 40px; }
  .drop-name { color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .drop-meta { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; }

  .err {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    border: 1px solid var(--color-alert);
    color: var(--color-alert);
    background: color-mix(in oklch, var(--color-alert) 6%, transparent);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  .loading {
    margin-top: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }

  .controls {
    margin-top: var(--sp-4);
    display: flex;
    gap: var(--sp-5);
    flex-wrap: wrap;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    align-items: center;
  }
  .ctrl { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .ctrl-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .ctrl select {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .toggle {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    padding: 4px 10px;
    font-family: inherit;
    font-size: var(--fs-sm);
    cursor: pointer;
    text-align: left;
  }
  .toggle.on { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .ctrl input[type="range"] { accent-color: var(--color-accent); width: 200px; }

  .player {
    margin-top: var(--sp-3);
    width: 100%;
    display: block;
  }

  .spec-wrap {
    margin-top: var(--sp-3);
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: var(--sp-2);
    position: relative;
  }
  .spec-y {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-align: right;
    padding: 4px 0;
  }
  .spec {
    width: 100%;
    height: 400px;
    display: block;
    border: 1px solid var(--color-border);
    image-rendering: pixelated;
  }
  .spec-ylbl {
    position: absolute;
    left: -4px;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    transform-origin: center;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    display: none;
  }
  .spec-x {
    display: flex; justify-content: space-between;
    padding-left: 48px;
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
  }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
