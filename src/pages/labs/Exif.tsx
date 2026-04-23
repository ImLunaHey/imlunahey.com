import { Link } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';

// ─── minimal exif parser ───────────────────────────────────────────────────
// Handles jpeg (APP1 "Exif\0\0" segment) and png (eXIf + tEXt / iTXt chunks).
// No deps. Covers the tags people actually care about — camera, lens, datetime,
// exposure, gps — plus a generic dump of everything else we find.

type TagValue = string | number | number[] | [number, number][] | null;
type Tag = { tag: number; name: string; value: TagValue; ifd: string };

const TAG_NAMES: Record<number, string> = {
  0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x011a: 'XResolution',
  0x011b: 'YResolution', 0x0128: 'ResolutionUnit', 0x0131: 'Software',
  0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright',
  0x8769: 'ExifIFD', 0x8825: 'GPSIFD',
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8822: 'ExposureProgram',
  0x8827: 'ISOSpeedRatings', 0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9204: 'ExposureBiasValue',
  0x9206: 'SubjectDistance', 0x9207: 'MeteringMode', 0x9208: 'LightSource',
  0x9209: 'Flash', 0x920a: 'FocalLength', 0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension', 0xa217: 'SensingMethod', 0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance', 0xa404: 'DigitalZoomRatio', 0xa405: 'FocalLengthIn35mm',
  0xa406: 'SceneCaptureType', 0xa432: 'LensSpecification', 0xa433: 'LensMake',
  0xa434: 'LensModel', 0xa435: 'LensSerialNumber',
  // GPS
  0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x0010: 'GPSImgDirectionRef',
  0x0011: 'GPSImgDirection', 0x001d: 'GPSDateStamp',
};

function readTagsFromTiff(view: DataView, tiffStart: number, littleEndian: boolean): Tag[] {
  const out: Tag[] = [];
  const ifd0 = view.getUint32(tiffStart + 4, littleEndian);
  readIfd(view, tiffStart, tiffStart + ifd0, littleEndian, 'IFD0', out);
  return out;
}

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, littleEndian: boolean, name: string, out: Tag[]) {
  if (ifdOffset <= 0 || ifdOffset >= view.byteLength - 2) return;
  const count = view.getUint16(ifdOffset, littleEndian);
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const n = view.getUint32(entry + 4, littleEndian);
    const value = readValue(view, tiffStart, entry + 8, type, n, littleEndian);

    // recurse into sub-ifds
    if (tag === 0x8769 && typeof value === 'number') {
      readIfd(view, tiffStart, tiffStart + value, littleEndian, 'ExifIFD', out);
      continue;
    }
    if (tag === 0x8825 && typeof value === 'number') {
      readIfd(view, tiffStart, tiffStart + value, littleEndian, 'GPSIFD', out);
      continue;
    }

    out.push({ tag, name: TAG_NAMES[tag] ?? `Unknown(0x${tag.toString(16)})`, value, ifd: name });
  }
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readValue(view: DataView, tiffStart: number, valueOffset: number, type: number, count: number, le: boolean): TagValue {
  const size = TYPE_SIZE[type];
  if (!size) return null;
  const totalBytes = size * count;
  const actualOffset = totalBytes <= 4 ? valueOffset : tiffStart + view.getUint32(valueOffset, le);
  if (actualOffset + totalBytes > view.byteLength) return null;

  if (type === 2) {
    // ASCII
    let s = '';
    for (let i = 0; i < count; i++) {
      const b = view.getUint8(actualOffset + i);
      if (b === 0) break;
      s += String.fromCharCode(b);
    }
    return s;
  }
  if (type === 1 || type === 7) {
    // BYTE / UNDEFINED
    if (count === 1) return view.getUint8(actualOffset);
    const arr: number[] = [];
    for (let i = 0; i < Math.min(count, 16); i++) arr.push(view.getUint8(actualOffset + i));
    return arr;
  }
  if (type === 3) {
    // SHORT
    if (count === 1) return view.getUint16(actualOffset, le);
    const arr: number[] = [];
    for (let i = 0; i < Math.min(count, 16); i++) arr.push(view.getUint16(actualOffset + i * 2, le));
    return arr;
  }
  if (type === 4) {
    // LONG
    if (count === 1) return view.getUint32(actualOffset, le);
    const arr: number[] = [];
    for (let i = 0; i < Math.min(count, 16); i++) arr.push(view.getUint32(actualOffset + i * 4, le));
    return arr;
  }
  if (type === 5 || type === 10) {
    // RATIONAL / SRATIONAL
    const signed = type === 10;
    const pairs: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const num = signed ? view.getInt32(actualOffset + i * 8, le) : view.getUint32(actualOffset + i * 8, le);
      const den = signed ? view.getInt32(actualOffset + i * 8 + 4, le) : view.getUint32(actualOffset + i * 8 + 4, le);
      pairs.push([num, den]);
    }
    return pairs;
  }
  return null;
}

function parseJpegExif(buf: ArrayBuffer): Tag[] | null {
  const view = new DataView(buf);
  if (view.getUint16(0) !== 0xffd8) return null; // SOI
  let p = 2;
  while (p < view.byteLength) {
    if (view.getUint8(p) !== 0xff) break;
    const marker = view.getUint8(p + 1);
    const len = view.getUint16(p + 2);
    if (marker === 0xe1) {
      // APP1 — check for "Exif\0\0"
      const sig = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
      if (sig === 'Exif') {
        const tiff = p + 10;
        const endian = view.getUint16(tiff);
        const le = endian === 0x4949;
        return readTagsFromTiff(view, tiff, le);
      }
    }
    if (marker === 0xda) break; // SOS
    p += 2 + len;
  }
  return [];
}

type PngText = { key: string; value: string };

function parsePngMeta(buf: ArrayBuffer): { exif: Tag[]; text: PngText[] } | null {
  const view = new DataView(buf);
  if (view.byteLength < 8) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (view.getUint8(i) !== sig[i]) return null;

  const exif: Tag[] = [];
  const text: PngText[] = [];
  let p = 8;
  const dec = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');

  while (p < view.byteLength) {
    if (p + 8 > view.byteLength) break;
    const len = view.getUint32(p);
    const type = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
    const dataStart = p + 8;
    if (dataStart + len > view.byteLength) break;

    if (type === 'eXIf') {
      const tiff = dataStart;
      const endian = view.getUint16(tiff);
      const le = endian === 0x4949;
      exif.push(...readTagsFromTiff(view, tiff, le));
    } else if (type === 'tEXt') {
      const bytes = new Uint8Array(buf, dataStart, len);
      const nul = bytes.indexOf(0);
      if (nul > 0) {
        const key = dec.decode(bytes.subarray(0, nul));
        const value = dec.decode(bytes.subarray(nul + 1));
        text.push({ key, value });
      }
    } else if (type === 'iTXt') {
      const bytes = new Uint8Array(buf, dataStart, len);
      const nul = bytes.indexOf(0);
      if (nul > 0) {
        const key = utf8.decode(bytes.subarray(0, nul));
        // skip compression flag, method, language tag, translated keyword
        let q = nul + 1 + 2;
        const nul2 = bytes.indexOf(0, q);
        const nul3 = nul2 >= 0 ? bytes.indexOf(0, nul2 + 1) : -1;
        if (nul3 > 0) {
          const value = utf8.decode(bytes.subarray(nul3 + 1));
          text.push({ key, value });
        }
      }
    }
    if (type === 'IEND') break;
    p = dataStart + len + 4; // + crc
  }

  return { exif, text };
}

// ─── jpeg stripper — remove APP1/APP13 (exif/iptc/photoshop) segments ───────

function stripJpeg(buf: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buf);
  if (view.getUint16(0) !== 0xffd8) return buf;
  const out: number[] = [0xff, 0xd8];
  let p = 2;
  while (p < view.byteLength) {
    if (view.getUint8(p) !== 0xff) { out.push(view.getUint8(p)); p++; continue; }
    const marker = view.getUint8(p + 1);
    if (marker === 0xda) {
      // SOS — dump the rest verbatim
      for (let i = p; i < view.byteLength; i++) out.push(view.getUint8(i));
      break;
    }
    const len = view.getUint16(p + 2);
    // drop APPn except APP0 (jfif) which some tools expect
    const isMetadata = marker === 0xe1 || marker === 0xe2 || marker === 0xed || marker === 0xee;
    const isComment = marker === 0xfe;
    if (isMetadata || isComment) {
      p += 2 + len;
      continue;
    }
    for (let i = p; i < p + 2 + len; i++) out.push(view.getUint8(i));
    p += 2 + len;
  }
  return new Uint8Array(out).buffer;
}

function stripPng(buf: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buf);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (view.getUint8(i) !== sig[i]) return buf;
  const out: number[] = [];
  for (let i = 0; i < 8; i++) out.push(view.getUint8(i));
  let p = 8;
  const DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'iCCP']);
  while (p < view.byteLength) {
    if (p + 8 > view.byteLength) break;
    const len = view.getUint32(p);
    const type = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
    const chunkLen = 8 + len + 4;
    if (!DROP.has(type)) {
      for (let i = p; i < p + chunkLen; i++) out.push(view.getUint8(i));
    }
    p += chunkLen;
    if (type === 'IEND') break;
  }
  return new Uint8Array(out).buffer;
}

// ─── display helpers ──────────────────────────────────────────────────────

function formatRational(pairs: [number, number][]): string {
  if (pairs.length === 1) {
    const [n, d] = pairs[0];
    if (d === 0) return `${n}/0`;
    const r = n / d;
    return Number.isInteger(r) ? String(r) : r.toFixed(r < 1 ? 4 : 2);
  }
  return pairs.map(([n, d]) => (d ? n / d : 0).toFixed(4)).join(', ');
}

function formatValue(t: Tag): string {
  if (t.value === null) return '—';
  if (typeof t.value === 'string') return t.value;
  if (typeof t.value === 'number') return String(t.value);
  if (Array.isArray(t.value) && t.value.length > 0 && Array.isArray(t.value[0])) {
    return formatRational(t.value as [number, number][]);
  }
  return (t.value as number[]).join(', ');
}

function rationalsToDegrees(pairs: [number, number][]): number | null {
  if (pairs.length !== 3) return null;
  const [d, m, s] = pairs.map(([n, den]) => (den ? n / den : 0));
  return d + m / 60 + s / 3600;
}

function extractGps(tags: Tag[]): { lat: number; lon: number } | null {
  const gps = tags.filter((t) => t.ifd === 'GPSIFD');
  const latRef = gps.find((t) => t.tag === 0x0001)?.value as string | undefined;
  const lonRef = gps.find((t) => t.tag === 0x0003)?.value as string | undefined;
  const latVal = gps.find((t) => t.tag === 0x0002)?.value as [number, number][] | undefined;
  const lonVal = gps.find((t) => t.tag === 0x0004)?.value as [number, number][] | undefined;
  if (!latVal || !lonVal) return null;
  let lat = rationalsToDegrees(latVal);
  let lon = rationalsToDegrees(lonVal);
  if (lat == null || lon == null) return null;
  if (latRef === 'S') lat = -lat;
  if (lonRef === 'W') lon = -lon;
  return { lat, lon };
}

type FileState = {
  file: File;
  buf: ArrayBuffer;
  url: string;
  exif: Tag[];
  pngText: PngText[];
};

export default function ExifPage() {
  const [state, setState] = useState<FileState | null>(null);
  const [dropping, setDropping] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback(async (file: File) => {
    setErr(null);
    const buf = await file.arrayBuffer();
    let exif: Tag[] = [];
    let pngText: PngText[] = [];
    try {
      if (/jpe?g$/i.test(file.name) || file.type.includes('jpeg')) {
        exif = parseJpegExif(buf) ?? [];
      } else if (/png$/i.test(file.name) || file.type.includes('png')) {
        const parsed = parsePngMeta(buf);
        if (parsed) { exif = parsed.exif; pngText = parsed.text; }
      } else {
        setErr('only jpeg and png supported — other formats coming');
      }
    } catch (e) {
      setErr(`parse failed: ${(e as Error).message}`);
    }
    const url = URL.createObjectURL(new Blob([buf], { type: file.type || 'image/jpeg' }));
    if (state?.url) URL.revokeObjectURL(state.url);
    setState({ file, buf, url, exif, pngText });
  }, [state?.url]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files[0];
    if (f) void onPick(f);
  }, [onPick]);

  const download = useCallback(() => {
    if (!state) return;
    const isPng = /png$/i.test(state.file.name) || state.file.type.includes('png');
    const stripped = isPng ? stripPng(state.buf) : stripJpeg(state.buf);
    const blob = new Blob([stripped], { type: state.file.type || 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = state.file.name.replace(/\.[^.]+$/, '');
    const ext = state.file.name.match(/\.[^.]+$/)?.[0] ?? '.jpg';
    a.download = `${baseName}-stripped${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const gps = useMemo(() => (state ? extractGps(state.exif) : null), [state]);

  const grouped = useMemo(() => {
    if (!state) return {} as Record<string, Tag[]>;
    const g: Record<string, Tag[]> = {};
    for (const t of state.exif) (g[t.ifd] ??= []).push(t);
    return g;
  }, [state]);

  const totalTags = state ? state.exif.length + state.pngText.length : 0;
  const hasPrivate = !!(gps || state?.exif.find((t) => t.name === 'Make' || t.name === 'Model' || t.name === 'DateTimeOriginal' || t.name === 'Artist'));

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-exif">
        <header className="page-hd">
          <div className="label">~/labs/exif</div>
          <h1>exif<span className="dot">.</span></h1>
          <p className="sub">
            drop a jpeg or png — see every metadata tag the file is leaking. camera, lens, timestamps,
            and location (if geotagged). download a stripped copy with one click. entirely client-side —
            your files never leave this tab.
          </p>
        </header>

        <section
          className={`drop ${dropping ? 'on' : ''} ${state ? 'has' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
          onDragLeave={() => setDropping(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }}
          />
          {state ? (
            <div className="drop-info">
              <img src={state.url} alt="" className="drop-preview" />
              <div>
                <div className="drop-name">{state.file.name}</div>
                <div className="drop-meta">
                  {(state.file.size / 1024).toFixed(1)} kb · {state.file.type || 'image'}
                </div>
              </div>
            </div>
          ) : (
            <div className="drop-empty">
              <div className="drop-glyph">◱</div>
              <div>drop a jpeg or png here, or click to pick</div>
            </div>
          )}
        </section>

        {err ? <div className="err">{err}</div> : null}

        {state ? (
          <>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-k">tags</span>
                <b>{totalTags}</b>
              </div>
              <div className="stat">
                <span className="stat-k">privacy</span>
                <b className={hasPrivate ? 't-alert' : 't-accent'}>
                  {hasPrivate ? 'leaking' : 'clean'}
                </b>
              </div>
              <div className="stat">
                <span className="stat-k">gps</span>
                <b className={gps ? 't-alert' : 't-accent'}>{gps ? 'present' : 'none'}</b>
              </div>
              <button className="strip-btn" onClick={download}>
                strip all metadata →
              </button>
            </div>

            {gps ? (
              <section className="panel">
                <div className="panel-hd">geo · exact capture location in the file</div>
                <div className="gps">
                  <div className="gps-coord">
                    <span className="t-faint">lat</span> {gps.lat.toFixed(6)}
                  </div>
                  <div className="gps-coord">
                    <span className="t-faint">lon</span> {gps.lon.toFixed(6)}
                  </div>
                  <a
                    className="gps-link"
                    href={`https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lon}&zoom=15`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    open in osm →
                  </a>
                </div>
              </section>
            ) : null}

            {Object.entries(grouped).map(([ifd, tags]) => (
              <section key={ifd} className="panel">
                <div className="panel-hd">{ifd.toLowerCase()} · {tags.length} tags</div>
                <table className="tag-table">
                  <tbody>
                    {tags.map((t, i) => (
                      <tr key={`${t.tag}-${i}`}>
                        <td className="tag-name">{t.name}</td>
                        <td className="tag-val">{formatValue(t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}

            {state.pngText.length > 0 ? (
              <section className="panel">
                <div className="panel-hd">png text · {state.pngText.length} entries</div>
                <table className="tag-table">
                  <tbody>
                    {state.pngText.map((t, i) => (
                      <tr key={i}>
                        <td className="tag-name">{t.key}</td>
                        <td className="tag-val">{t.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            {totalTags === 0 ? (
              <div className="clean">
                <div className="clean-glyph">✓</div>
                <div>no metadata found. file is already clean.</div>
              </div>
            ) : null}
          </>
        ) : null}

        <footer className="labs-footer">
          <span>src · <span className="t-accent">fully client-side, no uploads</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-exif { max-width: 920px; margin: 0 auto; padding: 0 var(--sp-6); }
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
    transition: border-color .12s, background .12s;
  }
  .drop.on { border-color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 4%, transparent); }
  .drop:hover { border-color: var(--color-accent-dim); }
  .drop.has { border-style: solid; }
  .drop-empty { text-align: center; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .drop-glyph { font-size: 56px; color: var(--color-accent-dim); margin-bottom: var(--sp-2); }
  .drop-info { display: flex; align-items: center; gap: var(--sp-4); }
  .drop-preview { width: 72px; height: 72px; object-fit: cover; border: 1px solid var(--color-border); }
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
    grid-template-columns: repeat(3, auto) 1fr;
    gap: var(--sp-4);
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stat-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); }
  .strip-btn {
    justify-self: end;
    background: var(--color-accent);
    color: var(--color-bg);
    border: 0;
    padding: 10px var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    font-weight: 500;
  }
  .strip-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .panel {
    margin-top: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .panel-hd {
    padding: 10px var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tag-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .tag-table td { padding: 6px var(--sp-4); border-bottom: 1px dashed var(--color-border); vertical-align: top; }
  .tag-table tr:last-child td { border-bottom: 0; }
  .tag-name { color: var(--color-fg-dim); width: 220px; white-space: nowrap; }
  .tag-val { color: var(--color-fg); word-break: break-word; }

  .gps { display: flex; gap: var(--sp-4); padding: var(--sp-3) var(--sp-4); align-items: center; font-family: var(--font-mono); font-size: var(--fs-sm); }
  .gps-coord { color: var(--color-fg); }
  .gps-link { margin-left: auto; color: var(--color-accent); font-size: var(--fs-xs); }

  .clean {
    margin-top: var(--sp-5);
    padding: var(--sp-6);
    text-align: center;
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }
  .clean-glyph { font-size: 40px; color: var(--color-accent); margin-bottom: var(--sp-2); }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
