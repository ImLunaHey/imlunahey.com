import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';

/**
 * Format converter — mp4 ↔ webm ↔ mkv ↔ mov for video, mp3 ↔ wav ↔
 * ogg ↔ flac for audio. Uses MediaBunny's Conversion API which
 * re-muxes when codecs are compatible (fast) and only re-encodes when
 * the target format can't carry the source codec (slower).
 *
 * Runs entirely in-browser. Nothing uploads.
 */

type TargetKey =
  | 'mp4' | 'webm' | 'mkv' | 'mov'
  | 'mp3' | 'wav' | 'ogg' | 'flac';

type TargetSpec = {
  key: TargetKey;
  label: string;
  kind: 'video' | 'audio';
  ext: string;
  mime: string;
};

const TARGETS: TargetSpec[] = [
  { key: 'mp4', label: 'mp4', kind: 'video', ext: 'mp4', mime: 'video/mp4' },
  { key: 'webm', label: 'webm', kind: 'video', ext: 'webm', mime: 'video/webm' },
  { key: 'mkv', label: 'mkv', kind: 'video', ext: 'mkv', mime: 'video/x-matroska' },
  { key: 'mov', label: 'mov', kind: 'video', ext: 'mov', mime: 'video/quicktime' },
  { key: 'mp3', label: 'mp3', kind: 'audio', ext: 'mp3', mime: 'audio/mpeg' },
  { key: 'wav', label: 'wav', kind: 'audio', ext: 'wav', mime: 'audio/wav' },
  { key: 'ogg', label: 'ogg', kind: 'audio', ext: 'ogg', mime: 'audio/ogg' },
  { key: 'flac', label: 'flac', kind: 'audio', ext: 'flac', mime: 'audio/flac' },
];

type SourceInfo = {
  file: File;
  formatName: string;
  mimeType: string;
  durationSec: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number;
  height: number;
};

async function probe(file: File): Promise<SourceInfo> {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    // Use `.getAudioTracks().length` in addition to `getPrimaryAudioTrack()`
    // — some containers return a null primary track even when audio tracks
    // exist (codec detection corner cases). Either signal counts.
    const [format, mimeType, durationSec, videoTracks, audioTracks] = await Promise.all([
      input.getFormat(),
      input.getMimeType(),
      input.computeDuration(),
      input.getVideoTracks(),
      input.getAudioTracks(),
    ]);
    const video = videoTracks[0] ?? null;
    const audio = audioTracks[0] ?? null;
    return {
      file,
      formatName: format.name,
      mimeType,
      durationSec,
      hasVideo: videoTracks.length > 0,
      hasAudio: audioTracks.length > 0,
      videoCodec: video?.codec ?? null,
      audioCodec: audio?.codec ?? null,
      width: video?.displayWidth ?? 0,
      height: video?.displayHeight ?? 0,
    };
  } finally {
    input.dispose();
  }
}

async function convert(file: File, target: TargetSpec, onProgress: (p: number) => void): Promise<Blob> {
  const {
    ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output,
    Mp4OutputFormat, WebMOutputFormat, MkvOutputFormat, MovOutputFormat,
    Mp3OutputFormat, WavOutputFormat, OggOutputFormat, FlacOutputFormat,
    QUALITY_HIGH,
  } = await import('mediabunny');

  let format;
  let audioOnly = false;
  switch (target.key) {
    case 'mp4': format = new Mp4OutputFormat(); break;
    case 'webm': format = new WebMOutputFormat(); break;
    case 'mkv': format = new MkvOutputFormat(); break;
    case 'mov': format = new MovOutputFormat(); break;
    case 'mp3': format = new Mp3OutputFormat(); audioOnly = true; break;
    case 'wav': format = new WavOutputFormat(); audioOnly = true; break;
    case 'ogg': format = new OggOutputFormat(); audioOnly = true; break;
    case 'flac': format = new FlacOutputFormat(); audioOnly = true; break;
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const output = new Output({ format, target: new BufferTarget() });
    // codec hints per audio target so the encoder picks something the
    // container accepts. video targets keep the source codec when
    // compatible (fast re-mux) and only re-encode otherwise.
    const audio =
      target.key === 'mp3' ? { codec: 'mp3' as const, bitrate: QUALITY_HIGH }
      : target.key === 'ogg' ? { codec: 'opus' as const, bitrate: QUALITY_HIGH }
      : target.key === 'flac' ? { codec: 'flac' as const }
      : target.key === 'wav' ? { codec: 'pcm-s16' as const }
      : undefined;

    const conversion = await Conversion.init({
      input,
      output,
      video: audioOnly ? { discard: true } : undefined,
      audio,
    });
    conversion.onProgress = onProgress;
    if (!conversion.isValid) {
      throw new Error(`conversion not valid: ${conversion.discardedTracks.map((d) => `${d.track.type} · ${d.reason}`).join(', ') || 'no compatible tracks'}`);
    }
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) throw new Error('no output produced');
    return new Blob([buffer], { type: target.mime });
  } finally {
    input.dispose();
  }
}

function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export default function ConverterPage() {
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [target, setTarget] = useState<TargetKey>('mp4');
  const [err, setErr] = useState('');
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: number; mime: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const releaseResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const handleFile = async (file: File) => {
    setErr('');
    releaseResult();
    setSource(null);
    setProbing(true);
    try {
      const info = await probe(file);
      setSource(info);
      // default target: same kind as source, but different extension.
      // if it's a video input, default to mp4; audio input → mp3.
      const defaultTarget: TargetKey = info.hasVideo ? 'mp4' : info.hasAudio ? 'mp3' : 'mp4';
      setTarget(defaultTarget);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setProbing(false);
    }
  };

  const run = async () => {
    if (!source) return;
    const spec = TARGETS.find((t) => t.key === target);
    if (!spec) return;
    setErr('');
    releaseResult();
    setBusy(true);
    setProgress(0);
    try {
      const blob = await convert(source.file, spec, (p) => setProgress(p));
      const base = source.file.name.replace(/\.[^.]+$/, '');
      const name = `${base}.${spec.ext}`;
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size, mime: spec.mime });
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

  const videoTargets = TARGETS.filter((t) => t.kind === 'video');
  const audioTargets = TARGETS.filter((t) => t.kind === 'audio');

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cv">
        <header className="page-hd">
          <div className="label">~/labs/converter</div>
          <h1>converter<span className="dot">.</span></h1>
          <p className="sub">
            mp4 ↔ webm ↔ mkv ↔ mov, plus audio extraction to mp3 / wav / ogg / flac.
            re-muxes when codecs are compatible (fast), re-encodes only when the target container can&apos;t carry the source codec.
            in-browser via <code className="inline">mediabunny</code> + webcodecs. nothing uploads.
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            style={{ display: 'none' }}
          />
          <div className="drop-main">
            {probing ? 'probing…' : source ? <b>{source.file.name}</b> : 'drop a media file here'}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>pick file…</button>
        </section>

        {err ? <div className="err">{err}</div> : null}

        {source ? (
          <>
            <section className="stats">
              <div className="stat"><span className="k">from</span><b>{source.formatName}</b></div>
              <div className="stat"><span className="k">size</span><b>{bytes(source.file.size)}</b></div>
              <div className="stat"><span className="k">duration</span><b>{source.durationSec.toFixed(2)}s</b></div>
              {source.hasVideo ? <div className="stat"><span className="k">video</span><b>{source.videoCodec ?? '—'} · {source.width}×{source.height}</b></div> : null}
              {source.hasAudio ? <div className="stat"><span className="k">audio</span><b>{source.audioCodec ?? '—'}</b></div> : null}
            </section>

            <section className="targets">
              <div className="t-group">
                <div className="t-label">video</div>
                <div className="t-chips">
                  {videoTargets.map((t) => {
                    const disabled = !source.hasVideo;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={'chip' + (target === t.key ? ' active' : '')}
                        onClick={() => setTarget(t.key)}
                        disabled={disabled}
                        title={disabled ? 'source has no video track' : undefined}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="t-group">
                <div className="t-label">audio-only</div>
                <div className="t-chips">
                  {audioTargets.map((t) => {
                    const disabled = !source.hasAudio;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={'chip' + (target === t.key ? ' active' : '')}
                        onClick={() => setTarget(t.key)}
                        disabled={disabled}
                        title={disabled ? 'source has no audio track' : undefined}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="controls">
              <button type="button" className="primary" onClick={run} disabled={busy}>
                {busy ? `converting… ${Math.round(progress * 100)}%` : `convert → ${target}`}
              </button>
              {busy ? (
                <div className="progress"><div className="progress-bar" style={{ width: `${progress * 100}%` }} /></div>
              ) : null}
            </section>
          </>
        ) : null}

        {result ? <ResultCard result={result} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">mediabunny · webcodecs · local only</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function ResultCard({ result }: { result: { url: string; name: string; size: number; mime: string } }) {
  const isVideo = result.mime.startsWith('video/');
  const isAudio = result.mime.startsWith('audio/');
  return (
    <section className="result">
      <div className="r-meta">
        <span className="r-name">{result.name}</span>
        <span className="r-size">{bytes(result.size)}</span>
      </div>
      {isVideo ? <video src={result.url} controls className="r-video" /> : null}
      {isAudio ? <audio src={result.url} controls className="r-audio" /> : null}
      <a href={result.url} download={result.name} className="r-dl">download ↓</a>
    </section>
  );
}

const CSS = `
  .shell-cv { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .drop { margin-top: var(--sp-5); border: 2px dashed var(--color-border); background: var(--color-bg-panel); padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; }
  .drop.over { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .drop-main { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); word-break: break-all; }
  .drop-main b { color: var(--color-accent); }
  .drop button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .drop button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); min-width: 0; }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .targets { margin-top: var(--sp-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  @media (max-width: 720px) { .targets { grid-template-columns: 1fr; } }
  .t-group { border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-2) var(--sp-3); }
  .t-label { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .t-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 6px 14px; font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; }
  .chip:hover:not([disabled]):not(.active) { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .chip.active { background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); }
  .chip[disabled] { opacity: 0.3; cursor: not-allowed; }

  .controls { margin-top: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .primary { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 10px var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .primary[disabled] { opacity: 0.5; cursor: not-allowed; }
  .primary:hover:not([disabled]) { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .progress { margin-top: var(--sp-2); height: 4px; background: var(--color-bg); border: 1px solid var(--color-border); }
  .progress-bar { height: 100%; background: var(--color-accent); transition: width 150ms ease; }

  .result { margin-top: var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .r-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .r-name { color: var(--color-fg); }
  .r-size { color: var(--color-fg-faint); }
  .r-video { width: 100%; background: #000; max-height: 50vh; }
  .r-audio { width: 100%; }
  .r-dl { align-self: flex-start; background: var(--color-accent); color: var(--color-bg); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); text-decoration: none; font-weight: 500; }
  .r-dl:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); text-decoration: none; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
