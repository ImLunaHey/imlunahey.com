import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { CanvasSink, Input, InputVideoTrack } from 'mediabunny';

/**
 * Trim any video to a range and save the clip. Uses MediaBunny's
 * Conversion with trim: { start, end } — the clip is re-muxed (and
 * re-encoded only if needed) in-browser via WebCodecs, then offered
 * as a download.
 */

type Loaded = {
  file: File;
  input: Input;
  track: InputVideoTrack;
  sink: CanvasSink;
  duration: number;
  width: number;
  height: number;
};

async function loadFile(file: File): Promise<Loaded> {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) { input.dispose(); throw new Error('no video track in that file'); }
  const duration = await input.computeDuration();
  const sink = new CanvasSink(track, { poolSize: 2 });
  return { file, input, track, sink, duration, width: track.displayWidth, height: track.displayHeight };
}

async function clip(file: File, start: number, end: number, onProgress: (p: number) => void): Promise<Blob> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start, end },
    });
    conversion.onProgress = onProgress;
    if (!conversion.isValid) {
      throw new Error(`conversion not valid: ${conversion.discardedTracks.map((d) => d.reason).join(', ')}`);
    }
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) throw new Error('no output produced');
    return new Blob([buffer], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}

function paintToTarget(src: HTMLCanvasElement | OffscreenCanvas, target: HTMLCanvasElement) {
  target.width = src.width;
  target.height = src.height;
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(src, 0, 0);
}

function fmt(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return (h > 0 ? String(h) + ':' : '') + `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export default function ClipperPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [focus, setFocus] = useState<'start' | 'end'>('start');

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (loaded) loaded.input.dispose();
      if (result) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const handleFile = async (f: File) => {
    setErr('');
    if (loaded) loaded.input.dispose();
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    setLoaded(null);
    setLoading(true);
    try {
      const next = await loadFile(f);
      setLoaded(next);
      setStart(0);
      setEnd(next.duration);
      setFocus('start');
      setTimeout(() => void paintFrame(next, 0), 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const paintFrame = async (l: Loaded, t: number) => {
    const seq = ++seqRef.current;
    const wrapped = await l.sink.getCanvas(t);
    if (seq !== seqRef.current || !wrapped || !canvasRef.current) return;
    paintToTarget(wrapped.canvas, canvasRef.current);
  };

  const setStartAt = (t: number) => {
    if (!loaded) return;
    const v = Math.min(Math.max(0, t), end - 0.05);
    setStart(v);
    setFocus('start');
    void paintFrame(loaded, v);
  };
  const setEndAt = (t: number) => {
    if (!loaded) return;
    const v = Math.max(Math.min(loaded.duration, t), start + 0.05);
    setEnd(v);
    setFocus('end');
    void paintFrame(loaded, v);
  };

  const run = async () => {
    if (!loaded) return;
    setErr('');
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    setBusy(true);
    setProgress(0);
    try {
      const blob = await clip(loaded.file, start, end, (p) => setProgress(p));
      const base = loaded.file.name.replace(/\.[^.]+$/, '');
      const name = `${base}-${start.toFixed(2)}-${end.toFixed(2)}.mp4`;
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size });
      setProgress(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cl">
        <header className="page-hd">
          <div className="label">~/labs/clipper</div>
          <h1>clipper<span className="dot">.</span></h1>
          <p className="sub">
            trim any video to a range and save the clip. output is mp4, re-muxed (and re-encoded only if needed) in-browser
            via <code className="inline">mediabunny</code> + webcodecs. nothing uploads.
          </p>
        </header>

        {!loaded ? (
          <section
            className={'drop' + (dragOver ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mkv,.webm,.mp4,.mov,.ts"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              style={{ display: 'none' }}
            />
            <div className="drop-main">{loading ? 'opening…' : 'drop a video file here'}</div>
            <button type="button" onClick={() => fileInputRef.current?.click()}>pick file…</button>
          </section>
        ) : (
          <>
            <section className="viewer">
              <canvas ref={canvasRef} className="canvas" />
              <div className="v-meta">
                <span className="v-name">{loaded.file.name}</span>
                <span className="v-dim">{loaded.width}×{loaded.height}</span>
                <span className="v-dur">duration {fmt(loaded.duration)}</span>
              </div>
            </section>

            <section className="ranges">
              <label className={'rng' + (focus === 'start' ? ' focus' : '')}>
                <span className="rng-k">start <b>{fmt(start)}</b></span>
                <input
                  type="range"
                  min={0}
                  max={loaded.duration}
                  step={Math.max(loaded.duration / 10000, 0.001)}
                  value={start}
                  onChange={(e) => setStartAt(Number(e.target.value))}
                />
              </label>
              <label className={'rng' + (focus === 'end' ? ' focus' : '')}>
                <span className="rng-k">end <b>{fmt(end)}</b></span>
                <input
                  type="range"
                  min={0}
                  max={loaded.duration}
                  step={Math.max(loaded.duration / 10000, 0.001)}
                  value={end}
                  onChange={(e) => setEndAt(Number(e.target.value))}
                />
              </label>
              <div className="rng-out">clip length <b>{fmt(Math.max(0, end - start))}</b></div>
            </section>

            <section className="controls">
              <button type="button" className="primary" onClick={run} disabled={busy || end - start < 0.1}>
                {busy ? `rendering… ${Math.round(progress * 100)}%` : 'clip →'}
              </button>
              {busy ? (
                <div className="progress"><div className="progress-bar" style={{ width: `${progress * 100}%` }} /></div>
              ) : null}
            </section>

            {result ? (
              <section className="result">
                <div className="r-meta">
                  <span className="r-name">{result.name}</span>
                  <span className="r-size">{bytes(result.size)}</span>
                </div>
                <video src={result.url} controls className="r-video" />
                <a href={result.url} download={result.name} className="r-dl">download ↓</a>
              </section>
            ) : null}
          </>
        )}

        {err ? <div className="err">{err}</div> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">mediabunny · webcodecs · local only</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

const CSS = `
  .shell-cl { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .drop { margin-top: var(--sp-5); border: 2px dashed var(--color-border); background: var(--color-bg-panel); padding: var(--sp-6) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; }
  .drop.over { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .drop-main { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .drop button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .drop button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .viewer { margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .canvas { display: block; width: 100%; height: auto; max-height: 60vh; object-fit: contain; background: #000; }
  .v-meta { display: flex; flex-wrap: wrap; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .v-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .ranges { margin-top: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .rng { display: grid; grid-template-columns: 180px 1fr; gap: var(--sp-3); align-items: center; padding: 4px 0; border-left: 3px solid transparent; padding-left: 8px; }
  .rng.focus { border-left-color: var(--color-accent); }
  .rng-k { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .rng-k b { color: var(--color-accent); font-variant-numeric: tabular-nums; font-weight: 400; font-size: var(--fs-md); margin-left: 6px; }
  .rng input[type=range] { accent-color: var(--color-accent); }
  .rng-out { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-align: right; padding-top: var(--sp-2); border-top: 1px dashed var(--color-border); margin-top: var(--sp-2); }
  .rng-out b { color: var(--color-fg); font-weight: 400; font-variant-numeric: tabular-nums; margin-left: 6px; }

  .controls { margin-top: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .primary { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 10px var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .primary[disabled] { opacity: 0.5; cursor: not-allowed; }
  .primary:hover:not([disabled]) { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .progress { margin-top: var(--sp-2); height: 4px; background: var(--color-bg); border: 1px solid var(--color-border); }
  .progress-bar { height: 100%; background: var(--color-accent); transition: width 150ms ease; }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .result { margin-top: var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .r-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .r-name { color: var(--color-fg); }
  .r-size { color: var(--color-fg-faint); }
  .r-video { width: 100%; background: #000; max-height: 50vh; }
  .r-dl { display: inline-block; background: var(--color-accent); color: var(--color-bg); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); text-decoration: none; font-weight: 500; align-self: flex-start; }
  .r-dl:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); text-decoration: none; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
