import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { CanvasSink, Input, InputVideoTrack } from 'mediabunny';

/**
 * Seek to any point in a video and pull the decoded frame out as a
 * PNG — no ffmpeg, no upload. Uses Mediabunny's CanvasSink which
 * wraps the browser's VideoDecoder and paints into a canvas at exact
 * timestamps.
 *
 * Two modes:
 *   single frame · scrub + extract the current frame as png
 *   strip        · N evenly-spaced frames across the whole duration
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

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('canvas toBlob returned null')); }, 'image/png');
  });
}

function paintToTarget(src: HTMLCanvasElement | OffscreenCanvas, target: HTMLCanvasElement) {
  target.width = src.width;
  target.height = src.height;
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(src, 0, 0);
}

export default function FrameExtractorPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [time, setTime] = useState(0);
  const [frameTs, setFrameTs] = useState<number | null>(null);

  const [stripCount, setStripCount] = useState(10);
  const [strip, setStrip] = useState<Array<{ t: number; url: string }>>([]);
  const [stripBusy, setStripBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (loaded) loaded.input.dispose();
      for (const s of strip) URL.revokeObjectURL(s.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const seekTo = async (t: number) => {
    if (!loaded || !canvasRef.current) return;
    const seq = ++seekSeqRef.current;
    const wrapped = await loaded.sink.getCanvas(t);
    if (seq !== seekSeqRef.current || !wrapped) return;
    paintToTarget(wrapped.canvas, canvasRef.current);
    setFrameTs(wrapped.timestamp);
  };

  const handleFile = async (file: File) => {
    setErr('');
    if (loaded) loaded.input.dispose();
    for (const s of strip) URL.revokeObjectURL(s.url);
    setStrip([]);
    setLoaded(null);
    setLoading(true);
    try {
      const next = await loadFile(file);
      setLoaded(next);
      setTime(0);
      setFrameTs(null);
      // paint first frame
      setTimeout(() => void seekToAfterLoad(next, 0), 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const seekToAfterLoad = async (l: Loaded, t: number) => {
    if (!canvasRef.current) return;
    const wrapped = await l.sink.getCanvas(t);
    if (!wrapped) return;
    paintToTarget(wrapped.canvas, canvasRef.current);
    setFrameTs(wrapped.timestamp);
  };

  const onScrub = (t: number) => {
    setTime(t);
    void seekTo(t);
  };

  const onDownload = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loaded?.file.name ?? 'frame'}-${(frameTs ?? time).toFixed(3)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const buildStrip = async () => {
    if (!loaded) return;
    for (const s of strip) URL.revokeObjectURL(s.url);
    setStrip([]);
    setStripBusy(true);
    const count = Math.max(2, Math.min(stripCount, 32));
    const step = loaded.duration / count;
    const timestamps = Array.from({ length: count }, (_, i) => step * (i + 0.5));
    const out: Array<{ t: number; url: string }> = [];
    try {
      for await (const wrapped of loaded.sink.canvasesAtTimestamps(timestamps)) {
        if (!wrapped) continue;
        const blob = await canvasToBlob(wrapped.canvas);
        out.push({ t: wrapped.timestamp, url: URL.createObjectURL(blob) });
        setStrip([...out]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStripBusy(false);
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
      <main className="shell-fx">
        <header className="page-hd">
          <div className="label">~/labs/frame-extractor</div>
          <h1>frame extractor<span className="dot">.</span></h1>
          <p className="sub">
            scrub any video to any timestamp, pull the exact decoded frame as a png. or build a contact-sheet strip
            of evenly-spaced frames across the whole clip. decodes in-browser via <code className="inline">mediabunny</code> + webcodecs.
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
                <span className="v-dur">{loaded.duration.toFixed(3)}s</span>
              </div>
              <div className="scrub">
                <input
                  type="range"
                  min={0}
                  max={loaded.duration}
                  step={Math.max(loaded.duration / 10000, 0.001)}
                  value={time}
                  onChange={(e) => onScrub(Number(e.target.value))}
                />
                <span className="t-now">{time.toFixed(3)}s</span>
              </div>
              <div className="actions">
                <button type="button" onClick={onDownload}>download frame ↓</button>
                <span className="t-faint">
                  decoded frame: {frameTs !== null ? `${frameTs.toFixed(3)}s` : '—'}
                </span>
              </div>
            </section>

            <section className="strip-panel">
              <div className="strip-hd">
                <span>strip</span>
                <label className="strip-ct">
                  <span>count</span>
                  <input
                    type="number"
                    min={2}
                    max={32}
                    value={stripCount}
                    onChange={(e) => setStripCount(Number(e.target.value) || 10)}
                  />
                </label>
                <button type="button" onClick={buildStrip} disabled={stripBusy}>{stripBusy ? 'extracting…' : 'extract →'}</button>
              </div>
              {strip.length > 0 ? (
                <div className="strip-grid">
                  {strip.map((s, i) => (
                    <a key={i} href={s.url} download={`${loaded.file.name}-${s.t.toFixed(3)}.png`} className="s-cell">
                      <img src={s.url} alt={`${s.t.toFixed(2)}s`} />
                      <span className="s-ts">{s.t.toFixed(2)}s</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
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

const CSS = `
  .shell-fx { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
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
  .canvas { display: block; width: 100%; height: auto; max-height: 70vh; object-fit: contain; background: #000; }
  .v-meta { display: flex; flex-wrap: wrap; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .v-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .v-dim, .v-dur { color: var(--color-fg-faint); }
  .scrub { display: flex; gap: var(--sp-2); align-items: center; padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--color-border); }
  .scrub input[type=range] { flex: 1; accent-color: var(--color-accent); }
  .t-now { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); font-variant-numeric: tabular-nums; min-width: 80px; text-align: right; }
  .actions { display: flex; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--color-border); align-items: center; }
  .actions button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; font-weight: 500; }
  .actions button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .strip-panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .strip-hd { display: flex; gap: var(--sp-3); align-items: center; padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .strip-ct { display: inline-flex; align-items: center; gap: 6px; color: var(--color-fg-faint); }
  .strip-ct input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-fg); padding: 4px 6px; font-family: var(--font-mono); font-size: var(--fs-xs); width: 60px; outline: 0; }
  .strip-hd button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 4px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; margin-left: auto; }
  .strip-hd button[disabled] { opacity: 0.4; cursor: not-allowed; }
  .strip-hd button:hover:not([disabled]) { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .strip-grid { padding: var(--sp-3); display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--sp-2); }
  .s-cell { display: block; text-decoration: none; color: inherit; }
  .s-cell img { width: 100%; display: block; border: 1px solid var(--color-border); background: #000; aspect-ratio: 16 / 9; object-fit: contain; }
  .s-ts { display: block; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); margin-top: 4px; text-align: center; }
  .s-cell:hover img { border-color: var(--color-accent-dim); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
