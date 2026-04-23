import { Link } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';

// ─── crc-32 (zlib / png flavour) ───────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── chunk parsing ────────────────────────────────────────────────────────

type Chunk = {
  offset: number;
  length: number;
  type: string;
  data: Uint8Array;
  crc: number;
  crcValid: boolean;
  decoded?: Record<string, string | number>;
  note?: string;
};

const COLOR_TYPES: Record<number, string> = {
  0: 'Greyscale', 2: 'Truecolour (RGB)', 3: 'Indexed',
  4: 'Greyscale + alpha', 6: 'Truecolour + alpha (RGBA)',
};
const INTERLACE_TYPES: Record<number, string> = { 0: 'None', 1: 'Adam7' };
const FILTER_TYPES: Record<number, string> = { 0: 'Adaptive (5-method)' };
const COMPRESSION_TYPES: Record<number, string> = { 0: 'Deflate' };
const RENDERING_INTENT: Record<number, string> = {
  0: 'Perceptual', 1: 'Relative colorimetric', 2: 'Saturation', 3: 'Absolute colorimetric',
};

function decodeChunk(c: Chunk): { decoded?: Record<string, string | number>; note?: string } {
  const d = c.data;
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');

  switch (c.type) {
    case 'IHDR':
      if (d.length < 13) return {};
      return {
        decoded: {
          width: view.getUint32(0),
          height: view.getUint32(4),
          bitDepth: d[8],
          colorType: `${d[9]} · ${COLOR_TYPES[d[9]] ?? 'unknown'}`,
          compression: `${d[10]} · ${COMPRESSION_TYPES[d[10]] ?? 'unknown'}`,
          filter: `${d[11]} · ${FILTER_TYPES[d[11]] ?? 'unknown'}`,
          interlace: `${d[12]} · ${INTERLACE_TYPES[d[12]] ?? 'unknown'}`,
        },
      };
    case 'PLTE':
      return { note: `${d.length / 3} palette entries (${d.length} bytes)` };
    case 'IDAT':
      return { note: `compressed image data · ${d.length.toLocaleString()} bytes` };
    case 'IEND':
      return { note: 'end marker' };
    case 'tEXt': {
      const nul = d.indexOf(0);
      if (nul <= 0) return {};
      return {
        decoded: {
          keyword: latin1.decode(d.subarray(0, nul)),
          text: latin1.decode(d.subarray(nul + 1)),
        },
      };
    }
    case 'iTXt': {
      const nul = d.indexOf(0);
      if (nul <= 0) return {};
      const compFlag = d[nul + 1];
      // skip compression method (1 byte)
      const langStart = nul + 3;
      const langEnd = d.indexOf(0, langStart);
      if (langEnd < 0) return {};
      const transStart = langEnd + 1;
      const transEnd = d.indexOf(0, transStart);
      if (transEnd < 0) return {};
      const textBytes = d.subarray(transEnd + 1);
      const text = compFlag === 0 ? utf8.decode(textBytes) : '<compressed>';
      return {
        decoded: {
          keyword: utf8.decode(d.subarray(0, nul)),
          lang: utf8.decode(d.subarray(langStart, langEnd)) || '(none)',
          translated: utf8.decode(d.subarray(transStart, transEnd)) || '(none)',
          compressed: compFlag ? 'yes' : 'no',
          text,
        },
      };
    }
    case 'zTXt': {
      const nul = d.indexOf(0);
      if (nul <= 0) return {};
      return {
        decoded: {
          keyword: latin1.decode(d.subarray(0, nul)),
          compression: d[nul + 1],
          text: `<${d.length - nul - 2} compressed bytes>`,
        },
      };
    }
    case 'tIME':
      if (d.length < 7) return {};
      return {
        decoded: {
          timestamp: `${view.getUint16(0)}-${String(d[2]).padStart(2, '0')}-${String(d[3]).padStart(2, '0')} ${String(d[4]).padStart(2, '0')}:${String(d[5]).padStart(2, '0')}:${String(d[6]).padStart(2, '0')}`,
        },
      };
    case 'pHYs':
      if (d.length < 9) return {};
      return {
        decoded: {
          xPixelsPerUnit: view.getUint32(0),
          yPixelsPerUnit: view.getUint32(4),
          unit: d[8] === 1 ? 'metre' : 'unknown',
        },
      };
    case 'gAMA':
      if (d.length < 4) return {};
      return { decoded: { gamma: view.getUint32(0) / 100000 } };
    case 'sRGB':
      return { decoded: { renderingIntent: `${d[0]} · ${RENDERING_INTENT[d[0]] ?? 'unknown'}` } };
    case 'cHRM':
      if (d.length < 32) return {};
      return {
        decoded: {
          whitePoint: `${(view.getUint32(0) / 100000).toFixed(4)}, ${(view.getUint32(4) / 100000).toFixed(4)}`,
          red: `${(view.getUint32(8) / 100000).toFixed(4)}, ${(view.getUint32(12) / 100000).toFixed(4)}`,
          green: `${(view.getUint32(16) / 100000).toFixed(4)}, ${(view.getUint32(20) / 100000).toFixed(4)}`,
          blue: `${(view.getUint32(24) / 100000).toFixed(4)}, ${(view.getUint32(28) / 100000).toFixed(4)}`,
        },
      };
    case 'bKGD': {
      if (d.length === 1) return { decoded: { paletteIndex: d[0] } };
      if (d.length === 2) return { decoded: { grey: view.getUint16(0) } };
      if (d.length === 6) return { decoded: { red: view.getUint16(0), green: view.getUint16(2), blue: view.getUint16(4) } };
      return {};
    }
    case 'tRNS':
      return { note: `${d.length} transparency bytes` };
    case 'iCCP': {
      const nul = d.indexOf(0);
      if (nul <= 0) return {};
      return {
        decoded: {
          profileName: latin1.decode(d.subarray(0, nul)),
          compression: d[nul + 1],
          compressedSize: d.length - nul - 2,
        },
      };
    }
    case 'eXIf':
      return { note: `exif block · ${d.length} bytes (see exif lab)` };
    case 'acTL':
      if (d.length < 8) return {};
      return {
        decoded: {
          numFrames: view.getUint32(0),
          numPlays: view.getUint32(4),
        },
      };
    default:
      return {};
  }
}

type Parsed = {
  fileSize: number;
  sigValid: boolean;
  chunks: Chunk[];
  error?: string;
};

function parsePng(buf: ArrayBuffer): Parsed {
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const sigValid = buf.byteLength >= 8 && SIG.every((b, i) => u8[i] === b);
  if (!sigValid) return { fileSize: buf.byteLength, sigValid: false, chunks: [], error: 'not a png file' };

  const chunks: Chunk[] = [];
  let p = 8;
  while (p < buf.byteLength) {
    if (p + 8 > buf.byteLength) break;
    const length = view.getUint32(p);
    const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    const dataStart = p + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.byteLength) break;
    const data = u8.subarray(dataStart, dataEnd);
    const crc = view.getUint32(dataEnd);
    const computed = crc32(u8.subarray(p + 4, dataEnd));
    const chunk: Chunk = {
      offset: p,
      length,
      type,
      data,
      crc,
      crcValid: computed === crc,
    };
    const { decoded, note } = decodeChunk(chunk);
    if (decoded) chunk.decoded = decoded;
    if (note) chunk.note = note;
    chunks.push(chunk);
    p = dataEnd + 4;
    if (type === 'IEND') break;
  }

  return { fileSize: buf.byteLength, sigValid, chunks };
}

// chunk category (for the colored badge)
function chunkKind(type: string): 'critical' | 'ancillary' | 'unknown' {
  if ('IHDR,PLTE,IDAT,IEND'.includes(type)) return 'critical';
  // first letter uppercase = critical (reserved), lowercase = ancillary
  if (type[0] >= 'a' && type[0] <= 'z') return 'ancillary';
  return 'unknown';
}

function hexPreview(bytes: Uint8Array, max = 48): string {
  const slice = bytes.subarray(0, max);
  const hex: string[] = [];
  for (let i = 0; i < slice.length; i++) hex.push(slice[i].toString(16).padStart(2, '0'));
  return hex.join(' ') + (bytes.length > max ? ' …' : '');
}

export default function PngChunksPage() {
  const [state, setState] = useState<{ file: File; parsed: Parsed; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback(async (f: File) => {
    setErr(null);
    const buf = await f.arrayBuffer();
    const parsed = parsePng(buf);
    if (!parsed.sigValid) setErr(parsed.error ?? 'could not parse file');
    if (state?.url) URL.revokeObjectURL(state.url);
    setState({ file: f, parsed, url: URL.createObjectURL(new Blob([buf], { type: 'image/png' })) });
  }, [state?.url]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void onPick(f);
  }, [onPick]);

  const stats = useMemo(() => {
    if (!state) return null;
    const { chunks, fileSize } = state.parsed;
    const idat = chunks.filter((c) => c.type === 'IDAT');
    const compressed = idat.reduce((s, c) => s + c.length, 0);
    const kinds = new Set(chunks.map((c) => c.type));
    const bad = chunks.filter((c) => !c.crcValid).length;
    return {
      chunkCount: chunks.length,
      uniqueTypes: kinds.size,
      idatCount: idat.length,
      compressedBytes: compressed,
      fileSize,
      badCrcs: bad,
    };
  }, [state]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-png">
        <header className="page-hd">
          <div className="label">~/labs/png-chunks</div>
          <h1>png chunks<span className="dot">.</span></h1>
          <p className="sub">
            drop a png — see every chunk the file is built from. type, offset, length, decoded fields,
            and crc validation for each one. ihdr broken out, idat totals, text chunks surfaced.
          </p>
        </header>

        <section
          className={`drop ${state ? 'has' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }}
          />
          {state ? (
            <div className="drop-info">
              <img src={state.url} alt="" className="drop-preview" />
              <div>
                <div className="drop-name">{state.file.name}</div>
                <div className="drop-meta">{state.parsed.fileSize.toLocaleString()} bytes</div>
              </div>
            </div>
          ) : (
            <div className="drop-empty">
              <div className="drop-glyph">▱</div>
              <div>drop a png here, or click to pick</div>
            </div>
          )}
        </section>

        {err ? <div className="err">{err}</div> : null}

        {stats ? (
          <div className="stat-row">
            <div className="stat"><span className="stat-k">chunks</span><b>{stats.chunkCount}</b></div>
            <div className="stat"><span className="stat-k">types</span><b>{stats.uniqueTypes}</b></div>
            <div className="stat"><span className="stat-k">idat</span><b>{stats.idatCount} · {(stats.compressedBytes / 1024).toFixed(1)} kb</b></div>
            <div className="stat">
              <span className="stat-k">crc</span>
              <b className={stats.badCrcs ? 't-alert' : 't-accent'}>
                {stats.badCrcs ? `${stats.badCrcs} bad` : 'all valid'}
              </b>
            </div>
            <div className="stat">
              <span className="stat-k">compression ratio</span>
              <b>
                {(() => {
                  if (!state || !state.parsed.chunks.length) return '—';
                  const ihdr = state.parsed.chunks.find((c) => c.type === 'IHDR')?.decoded;
                  if (!ihdr) return '—';
                  const rawPixels = (ihdr.width as number) * (ihdr.height as number) * 4;
                  return `${(stats.compressedBytes / rawPixels * 100).toFixed(1)}% of raw rgba`;
                })()}
              </b>
            </div>
          </div>
        ) : null}

        {state ? (
          <section className="chunks">
            {state.parsed.chunks.map((c, i) => {
              const kind = chunkKind(c.type);
              return (
                <div key={i} className="chunk">
                  <div className="chunk-hd">
                    <span className={`chunk-kind k-${kind}`}>{kind}</span>
                    <span className="chunk-type">{c.type}</span>
                    <span className="chunk-off">@ 0x{c.offset.toString(16).padStart(8, '0')}</span>
                    <span className="chunk-len">{c.length.toLocaleString()} bytes</span>
                    <span className={`chunk-crc ${c.crcValid ? 'ok' : 'bad'}`}>
                      crc {c.crcValid ? '✓' : '✗'} 0x{c.crc.toString(16).padStart(8, '0')}
                    </span>
                  </div>
                  {c.decoded ? (
                    <table className="chunk-fields">
                      <tbody>
                        {Object.entries(c.decoded).map(([k, v]) => (
                          <tr key={k}>
                            <td className="fk">{k}</td>
                            <td className="fv">{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {c.note ? <div className="chunk-note">{c.note}</div> : null}
                  {!c.decoded && !c.note && c.length > 0 ? (
                    <div className="chunk-hex">{hexPreview(c.data)}</div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        <footer className="labs-footer">
          <span>spec · <span className="t-accent">iso 15948 · png 1.2</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-png { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
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
  .drop-glyph { font-size: 56px; color: var(--color-accent-dim); margin-bottom: var(--sp-2); }
  .drop-info { display: flex; align-items: center; gap: var(--sp-4); }
  .drop-preview { width: 72px; height: 72px; object-fit: contain; border: 1px solid var(--color-border); background: repeating-conic-gradient(var(--color-bg) 0 25%, var(--color-bg-panel) 0 50%) 50% / 16px 16px; }
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

  .stat-row {
    margin-top: var(--sp-5);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stat-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); }

  .chunks {
    margin-top: var(--sp-5);
    display: flex; flex-direction: column; gap: var(--sp-2);
  }
  .chunk {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .chunk-hd {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 8px var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
  }
  .chunk-kind {
    padding: 1px 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    border: 1px solid;
  }
  .k-critical { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .k-ancillary { color: var(--color-fg-faint); border-color: var(--color-border); }
  .k-unknown { color: var(--color-alert); border-color: var(--color-alert); }
  .chunk-type { color: var(--color-fg); font-weight: 500; letter-spacing: 0.04em; font-size: var(--fs-sm); }
  .chunk-off { color: var(--color-fg-faint); }
  .chunk-len { color: var(--color-accent); }
  .chunk-crc { margin-left: auto; font-size: 10px; }
  .chunk-crc.ok { color: var(--color-fg-faint); }
  .chunk-crc.bad { color: var(--color-alert); }

  .chunk-fields { width: 100%; border-collapse: collapse; }
  .chunk-fields td { padding: 4px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border-bottom: 1px dashed var(--color-border); }
  .chunk-fields tr:last-child td { border-bottom: 0; }
  .fk { color: var(--color-fg-dim); width: 160px; white-space: nowrap; }
  .fv { color: var(--color-fg); word-break: break-word; }

  .chunk-note, .chunk-hex {
    padding: 8px var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .chunk-hex { word-break: break-all; color: var(--color-fg-dim); }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
