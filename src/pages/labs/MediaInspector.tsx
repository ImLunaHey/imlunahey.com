import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { InputAudioTrack, InputVideoTrack, MetadataTags } from 'mediabunny';

/**
 * Reads any media file locally with Mediabunny — no upload, no decode
 * happens outside the browser. Shows the full track inventory plus
 * container-level metadata tags (title, artist, cover art, etc.).
 *
 * The point: quickly answer "what's actually inside this file?" for
 * containers where the finder / file info dialog is unhelpful (webm,
 * matroska, mov variants, files with opaque extensions).
 */

type VideoInfo = {
  codec: string | null;
  codecParams: string | null;
  codedWidth: number;
  codedHeight: number;
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  languageCode: string;
  durationSec: number;
  avgFps?: number;
  avgBitrate?: number;
  hdr?: boolean;
  canDecode: boolean;
};

type AudioInfo = {
  codec: string | null;
  codecParams: string | null;
  sampleRate: number;
  numberOfChannels: number;
  languageCode: string;
  durationSec: number;
  avgBitrate?: number;
  canDecode: boolean;
};

type Summary = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  formatName: string;
  durationSec: number;
  videoTracks: VideoInfo[];
  audioTracks: AudioInfo[];
  tags: MetadataTags;
  coverUrls: string[];
};

function bytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

function kbps(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return '—';
  return `${Math.round(n / 1000).toLocaleString()} kbps`;
}

async function inspect(file: File): Promise<Summary> {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const [format, mimeType, durationSec, videoTracks, audioTracks, tags] = await Promise.all([
      input.getFormat(),
      input.getMimeType(),
      input.computeDuration(),
      input.getVideoTracks(),
      input.getAudioTracks(),
      input.getMetadataTags(),
    ]);

    const videos = await Promise.all(videoTracks.map(async (t: InputVideoTrack): Promise<VideoInfo> => {
      const [codecParams, trackDuration, canDecode, stats, hdr] = await Promise.all([
        t.getCodecParameterString(),
        t.computeDuration(),
        t.canDecode(),
        t.computePacketStats(200).catch(() => null),
        t.hasHighDynamicRange().catch(() => false),
      ]);
      return {
        codec: t.codec,
        codecParams,
        codedWidth: t.codedWidth,
        codedHeight: t.codedHeight,
        displayWidth: t.displayWidth,
        displayHeight: t.displayHeight,
        rotation: t.rotation,
        languageCode: t.languageCode,
        durationSec: trackDuration,
        avgFps: stats?.averagePacketRate,
        avgBitrate: stats?.averageBitrate,
        hdr,
        canDecode,
      };
    }));

    const audios = await Promise.all(audioTracks.map(async (t: InputAudioTrack): Promise<AudioInfo> => {
      const [codecParams, trackDuration, canDecode, stats] = await Promise.all([
        t.getCodecParameterString(),
        t.computeDuration(),
        t.canDecode(),
        t.computePacketStats(200).catch(() => null),
      ]);
      return {
        codec: t.codec,
        codecParams,
        sampleRate: t.sampleRate,
        numberOfChannels: t.numberOfChannels,
        languageCode: t.languageCode,
        durationSec: trackDuration,
        avgBitrate: stats?.averageBitrate,
        canDecode,
      };
    }));

    const coverUrls: string[] = [];
    if (tags.images) {
      for (const img of tags.images) {
        try {
          const blob = new Blob([img.data], { type: img.mimeType ?? 'image/png' });
          coverUrls.push(URL.createObjectURL(blob));
        } catch { /* skip */ }
      }
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      formatName: format.name,
      durationSec,
      videoTracks: videos,
      audioTracks: audios,
      tags,
      coverUrls,
    };
  } finally {
    input.dispose();
  }
}

export default function MediaInspectorPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Release object URLs when the summary changes.
  useEffect(() => {
    return () => {
      if (summary?.coverUrls) for (const u of summary.coverUrls) URL.revokeObjectURL(u);
    };
  }, [summary]);

  const handleFile = async (file: File) => {
    setErr('');
    setSummary(null);
    setLoading(true);
    try {
      const s = await inspect(file);
      setSummary(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-mi">
        <header className="page-hd">
          <div className="label">~/labs/media-inspector</div>
          <h1>media inspector<span className="dot">.</span></h1>
          <p className="sub">
            drop any video / audio file — mp4, mov, webm, mkv, mp3, wav, ogg, flac, adts, ts — and see every track plus container metadata.
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
            accept="video/*,audio/*,.mkv,.webm,.mp4,.mov,.mp3,.wav,.ogg,.flac,.aac,.m4a,.ts"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            style={{ display: 'none' }}
          />
          <div className="drop-main">
            {loading ? 'inspecting…' : summary ? <b>{summary.fileName}</b> : 'drop a media file here'}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>pick file…</button>
        </section>

        {err ? <div className="err">{err}</div> : null}

        {summary ? <Report summary={summary} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">mediabunny · local only</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Report({ summary }: { summary: Summary }) {
  const s = summary;
  return (
    <>
      <section className="stats">
        <div className="stat"><span className="k">size</span><b>{bytes(s.fileSize)}</b></div>
        <div className="stat"><span className="k">format</span><b>{s.formatName}</b></div>
        <div className="stat"><span className="k">mime</span><b className="t-mono">{s.mimeType}</b></div>
        <div className="stat"><span className="k">duration</span><b>{duration(s.durationSec)}</b></div>
        <div className="stat"><span className="k">tracks</span><b>{s.videoTracks.length}v · {s.audioTracks.length}a</b></div>
      </section>

      {s.videoTracks.length > 0 ? (
        <section className="panel">
          <h3 className="p-hd">video</h3>
          {s.videoTracks.map((v, i) => (
            <dl key={i} className="tf">
              <Row k="codec" v={v.codec ?? 'unknown'} sub={v.codecParams ?? undefined} />
              <Row k="coded" v={`${v.codedWidth} × ${v.codedHeight}`} />
              <Row k="display" v={`${v.displayWidth} × ${v.displayHeight}`} sub={v.rotation !== 0 ? `rotation ${v.rotation}°` : undefined} />
              <Row k="frame rate" v={v.avgFps ? `${v.avgFps.toFixed(2)} fps (avg)` : '—'} />
              <Row k="bitrate" v={kbps(v.avgBitrate)} />
              <Row k="hdr" v={v.hdr ? 'yes' : 'no'} />
              <Row k="language" v={v.languageCode} />
              <Row k="duration" v={duration(v.durationSec)} />
              <Row k="decodable" v={v.canDecode ? 'yes' : 'no'} />
            </dl>
          ))}
        </section>
      ) : null}

      {s.audioTracks.length > 0 ? (
        <section className="panel">
          <h3 className="p-hd">audio</h3>
          {s.audioTracks.map((a, i) => (
            <dl key={i} className="tf">
              <Row k="codec" v={a.codec ?? 'unknown'} sub={a.codecParams ?? undefined} />
              <Row k="sample rate" v={`${a.sampleRate.toLocaleString()} Hz`} />
              <Row k="channels" v={String(a.numberOfChannels)} />
              <Row k="bitrate" v={kbps(a.avgBitrate)} />
              <Row k="language" v={a.languageCode} />
              <Row k="duration" v={duration(a.durationSec)} />
              <Row k="decodable" v={a.canDecode ? 'yes' : 'no'} />
            </dl>
          ))}
        </section>
      ) : null}

      {(s.tags.title || s.tags.artist || s.tags.album || s.tags.genre || s.tags.date || s.tags.comment || s.coverUrls.length) ? (
        <section className="panel">
          <h3 className="p-hd">metadata tags</h3>
          <div className="meta-grid">
            {s.coverUrls.length > 0 ? (
              <div className="covers">
                {s.coverUrls.map((u, i) => <img key={i} src={u} alt="" />)}
              </div>
            ) : null}
            <dl className="tf">
              {s.tags.title ? <Row k="title" v={s.tags.title} /> : null}
              {s.tags.artist ? <Row k="artist" v={s.tags.artist} /> : null}
              {s.tags.album ? <Row k="album" v={s.tags.album} /> : null}
              {s.tags.albumArtist ? <Row k="album artist" v={s.tags.albumArtist} /> : null}
              {typeof s.tags.trackNumber === 'number' ? <Row k="track" v={String(s.tags.trackNumber) + (s.tags.tracksTotal ? ` / ${s.tags.tracksTotal}` : '')} /> : null}
              {typeof s.tags.discNumber === 'number' ? <Row k="disc" v={String(s.tags.discNumber) + (s.tags.discsTotal ? ` / ${s.tags.discsTotal}` : '')} /> : null}
              {s.tags.genre ? <Row k="genre" v={s.tags.genre} /> : null}
              {s.tags.date ? <Row k="date" v={s.tags.date instanceof Date ? s.tags.date.toISOString().slice(0, 10) : String(s.tags.date)} /> : null}
              {s.tags.comment ? <Row k="comment" v={s.tags.comment} /> : null}
              {s.tags.description ? <Row k="description" v={s.tags.description} /> : null}
              {s.tags.lyrics ? <Row k="lyrics" v={s.tags.lyrics} multiline /> : null}
            </dl>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Row({ k, v, sub, multiline }: { k: string; v: string; sub?: string; multiline?: boolean }) {
  return (
    <div className={'tf-row' + (multiline ? ' multiline' : '')}>
      <dt>{k}</dt>
      <dd>
        <span>{v}</span>
        {sub ? <span className="sub"> {sub}</span> : null}
      </dd>
    </div>
  );
}

const CSS = `
  .shell-mi { max-width: 960px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .drop { margin-top: var(--sp-5); border: 2px dashed var(--color-border); background: var(--color-bg-panel); padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); transition: border-color 120ms ease, background 120ms ease; text-align: center; }
  .drop.over { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .drop-main { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); word-break: break-all; }
  .drop-main b { color: var(--color-accent); }
  .drop button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .drop button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); min-width: 0; }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); color: var(--color-fg); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stat .t-mono { font-size: var(--fs-xs); color: var(--color-accent); }

  .panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .p-hd { padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--color-border); }

  .tf { padding: var(--sp-2) var(--sp-3); display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .tf + .tf { border-top: 1px dashed var(--color-border); margin-top: var(--sp-2); padding-top: var(--sp-2); }
  .tf-row { display: grid; grid-template-columns: 140px 1fr; gap: var(--sp-2); line-height: 1.55; }
  .tf-row.multiline dd { white-space: pre-wrap; }
  .tf-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .tf-row dd { color: var(--color-fg); word-break: break-all; }
  .tf-row dd .sub { color: var(--color-fg-faint); margin-left: 8px; font-size: 10px; }

  .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: var(--sp-3); padding: var(--sp-3); align-items: start; }
  @media (max-width: 720px) { .meta-grid { grid-template-columns: 1fr; } }
  .covers { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .covers img { width: 160px; height: 160px; object-fit: cover; border: 1px solid var(--color-border); background: var(--color-bg-raised); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
