import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';

/**
 * Pull the audio track out of any video and save it as mp3 or wav.
 * Uses MediaBunny's Conversion API with video=discard so only the audio
 * is written to the output. Runs entirely in-browser.
 */

type Target = 'mp3' | 'wav';

async function extractAudio(file: File, target: Target, onProgress: (p: number) => void): Promise<Blob> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp3OutputFormat, Output, WavOutputFormat, QUALITY_HIGH } =
    await import('mediabunny');

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const format = target === 'wav' ? new WavOutputFormat() : new Mp3OutputFormat();
    const output = new Output({ format, target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: target === 'mp3' ? { codec: 'mp3', bitrate: QUALITY_HIGH } : { codec: 'pcm-s16' },
    });
    conversion.onProgress = onProgress;
    if (!conversion.isValid) {
      throw new Error(`conversion not valid: ${conversion.discardedTracks.map((d) => d.reason).join(', ')}`);
    }
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) throw new Error('no output produced');
    const mime = target === 'wav' ? 'audio/wav' : 'audio/mpeg';
    return new Blob([buffer], { type: mime });
  } finally {
    input.dispose();
  }
}

export default function AudioExtractorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<Target>('mp3');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File) => {
    setErr('');
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setErr('');
    setBusy(true);
    setProgress(0);
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    try {
      const blob = await extractAudio(file, target, (p) => setProgress(p));
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const ext = target === 'wav' ? 'wav' : 'mp3';
      const name = `${baseName}.${ext}`;
      const url = URL.createObjectURL(blob);
      setResult({ url, name, size: blob.size });
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
    if (f) pickFile(f);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ax">
        <header className="page-hd">
          <div className="label">~/labs/audio-extractor</div>
          <h1>audio extractor<span className="dot">.</span></h1>
          <p className="sub">
            pull the audio out of any video — mp4, mov, webm, mkv — and save it as mp3 or wav.
            runs entirely in-browser via <code className="inline">mediabunny</code>. nothing uploads.
          </p>
        </header>

        <section
          className={'drop' + (dragOver ? ' over' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,.mkv,.webm,.mp4,.mov,.ts,.mp3,.wav,.ogg,.flac,.aac,.m4a"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            style={{ display: 'none' }}
          />
          <div className="drop-main">
            {file ? <b>{file.name}</b> : 'drop a video (or audio) file here'}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>pick file…</button>
        </section>

        {file ? (
          <section className="controls">
            <div className="ctl-row">
              <span className="k">format</span>
              <div className="tabs">
                <button type="button" className={'tab' + (target === 'mp3' ? ' active' : '')} onClick={() => setTarget('mp3')}>mp3</button>
                <button type="button" className={'tab' + (target === 'wav' ? ' active' : '')} onClick={() => setTarget('wav')}>wav (lossless)</button>
              </div>
              <button type="button" className="primary" onClick={run} disabled={busy}>
                {busy ? `extracting… ${Math.round(progress * 100)}%` : 'extract →'}
              </button>
            </div>
            {busy ? (
              <div className="progress"><div className="progress-bar" style={{ width: `${progress * 100}%` }} /></div>
            ) : null}
          </section>
        ) : null}

        {err ? <div className="err">{err}</div> : null}

        {result ? (
          <section className="result">
            <div className="r-meta">
              <span className="r-name">{result.name}</span>
              <span className="r-size">{bytes(result.size)}</span>
            </div>
            <div className="r-actions">
              <audio src={result.url} controls className="r-audio" />
              <a href={result.url} download={result.name} className="r-dl">download ↓</a>
            </div>
          </section>
        ) : null}

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
  .shell-ax { max-width: 820px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .drop { margin-top: var(--sp-5); border: 2px dashed var(--color-border); background: var(--color-bg-panel); padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; }
  .drop.over { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .drop-main { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); word-break: break-all; }
  .drop-main b { color: var(--color-accent); }
  .drop button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .drop button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .controls { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .ctl-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); }
  .k { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .tabs { display: flex; border: 1px solid var(--color-border); background: var(--color-bg); }
  .tab { background: transparent; border: 0; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 6px var(--sp-3); cursor: pointer; border-right: 1px solid var(--color-border); }
  .tab:last-child { border-right: 0; }
  .tab.active { background: var(--color-accent); color: var(--color-bg); }
  .tab:hover:not(.active) { color: var(--color-fg); }
  .primary { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; font-weight: 500; margin-left: auto; }
  .primary[disabled] { opacity: 0.5; cursor: not-allowed; }
  .primary:hover:not([disabled]) { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .progress { margin-top: var(--sp-2); height: 4px; background: var(--color-bg); border: 1px solid var(--color-border); }
  .progress-bar { height: 100%; background: var(--color-accent); transition: width 150ms ease; }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .result { margin-top: var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); padding: var(--sp-3) var(--sp-4); }
  .r-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: var(--sp-2); }
  .r-name { color: var(--color-fg); }
  .r-size { color: var(--color-fg-faint); }
  .r-actions { display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap; }
  .r-audio { flex: 1; min-width: 280px; }
  .r-dl { background: var(--color-accent); color: var(--color-bg); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); text-decoration: none; font-weight: 500; }
  .r-dl:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); text-decoration: none; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
