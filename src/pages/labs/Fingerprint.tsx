import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { getClientHints } from '../../server/client-hints';

type Entropy = 'low' | 'med' | 'high' | 'uniq';

type Row = {
  key: string;
  value: string | number | boolean | null | undefined;
  entropy: Entropy;
  note?: string;
};

type Section = {
  title: string;
  rows: Row[];
};

const ENTROPY_BITS: Record<Entropy, number> = { low: 1, med: 3, high: 6, uniq: 10 };
const ENTROPY_LABEL: Record<Entropy, string> = {
  low: 'low',
  med: 'med',
  high: 'high',
  uniq: 'very high',
};

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getCanvasHash(): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('luna.fp 🦁🌳', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 45);
    return (await sha256Hex(canvas.toDataURL())).slice(0, 16);
  } catch {
    return null;
  }
}

function getWebGL(): { vendor: string; renderer: string } | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
    const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return { vendor, renderer };
  } catch {
    return null;
  }
}

async function getAudioHash(): Promise<string | null> {
  try {
    const Offline = (window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext);
    if (!Offline) return null;
    const ctx = new Offline(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -50;
    comp.knee.value = 40;
    comp.ratio.value = 12;
    comp.attack.value = 0;
    comp.release.value = 0.25;
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    const data = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
    return (await sha256Hex(sum.toFixed(8))).slice(0, 16);
  } catch {
    return null;
  }
}

const FONT_CANDIDATES = [
  'Arial', 'Helvetica', 'Helvetica Neue', 'Times New Roman', 'Times', 'Courier New', 'Courier',
  'Georgia', 'Verdana', 'Comic Sans MS', 'Impact', 'Palatino', 'Trebuchet MS', 'Tahoma',
  'Lucida Console', 'Menlo', 'Monaco', 'Consolas', 'SF Pro Text', 'SF Pro Display',
  'Segoe UI', 'Roboto', 'Inter', 'Ubuntu', 'DejaVu Sans', 'Liberation Sans',
  'Andale Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono',
];

function detectFonts(): string[] {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'] as const;
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const d = document.createElement('span');
    d.textContent = testString;
    d.style.fontSize = testSize;
    d.style.position = 'absolute';
    d.style.left = '-9999px';
    d.style.top = '-9999px';
    document.body.appendChild(d);
    const baseSizes: Record<string, { w: number; h: number }> = {};
    for (const b of baseFonts) {
      d.style.fontFamily = b;
      baseSizes[b] = { w: d.offsetWidth, h: d.offsetHeight };
    }
    const found: string[] = [];
    for (const font of FONT_CANDIDATES) {
      let matched = false;
      for (const b of baseFonts) {
        d.style.fontFamily = `'${font}',${b}`;
        if (d.offsetWidth !== baseSizes[b].w || d.offsetHeight !== baseSizes[b].h) {
          matched = true;
          break;
        }
      }
      if (matched) found.push(font);
    }
    document.body.removeChild(d);
    return found;
  } catch {
    return [];
  }
}

async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch { /* noop */ }
  return null;
}

async function getPermissionsSnapshot(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const names = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read', 'clipboard-write', 'persistent-storage'] as const;
  if (!navigator.permissions?.query) return out;
  await Promise.all(
    names.map(async (n) => {
      try {
        const r = await navigator.permissions.query({ name: n as PermissionName });
        out[n] = r.state;
      } catch { /* unsupported name on this browser */ }
    }),
  );
  return out;
}

type DeviceCounts = { audioinput: number; audiooutput: number; videoinput: number };

async function getMediaDevices(): Promise<DeviceCounts | null> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const devs = await navigator.mediaDevices.enumerateDevices();
    const out: DeviceCounts = { audioinput: 0, audiooutput: 0, videoinput: 0 };
    for (const d of devs) {
      if (d.kind === 'audioinput') out.audioinput++;
      else if (d.kind === 'audiooutput') out.audiooutput++;
      else if (d.kind === 'videoinput') out.videoinput++;
    }
    return out;
  } catch {
    return null;
  }
}

async function getSpeechVoices(): Promise<{ count: number; first?: string } | null> {
  try {
    if (typeof speechSynthesis === 'undefined') return null;
    const read = (): SpeechSynthesisVoice[] => speechSynthesis.getVoices();
    let voices = read();
    if (voices.length === 0) {
      voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const timer = setTimeout(() => resolve(read()), 400);
        speechSynthesis.addEventListener(
          'voiceschanged',
          () => { clearTimeout(timer); resolve(read()); },
          { once: true },
        );
      });
    }
    return { count: voices.length, first: voices[0]?.name };
  } catch {
    return null;
  }
}

type UAData = {
  architecture?: string;
  bitness?: string;
  model?: string;
  platform?: string;
  platformVersion?: string;
  uaFullVersion?: string;
  mobile?: boolean;
  brandsList?: string;
};

async function getUAData(): Promise<UAData | null> {
  try {
    const ua = (navigator as unknown as {
      userAgentData?: {
        mobile?: boolean;
        brands?: Array<{ brand: string; version: string }>;
        getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
      };
    }).userAgentData;
    if (!ua) return null;
    if (!ua.getHighEntropyValues) {
      return {
        mobile: ua.mobile,
        brandsList: ua.brands?.map((b) => `${b.brand} ${b.version}`).join(', '),
      };
    }
    const d = await ua.getHighEntropyValues([
      'architecture', 'bitness', 'model', 'platform', 'platformVersion', 'uaFullVersion',
    ]);
    return {
      architecture: d.architecture as string | undefined,
      bitness: d.bitness as string | undefined,
      model: d.model as string | undefined,
      platform: d.platform as string | undefined,
      platformVersion: d.platformVersion as string | undefined,
      uaFullVersion: d.uaFullVersion as string | undefined,
      mobile: ua.mobile,
      brandsList: ua.brands?.map((b) => `${b.brand} ${b.version}`).join(', '),
    };
  } catch {
    return null;
  }
}

function getWebGLExtended(): { maxTextureSize?: number; extensions?: number; hasWebGL2?: boolean } | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const gl2 = canvas.getContext('webgl2');
    return {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      extensions: (gl.getSupportedExtensions() ?? []).length,
      hasWebGL2: !!gl2,
    };
  } catch {
    return null;
  }
}

async function getWebGPUInfo(): Promise<{ vendor?: string; architecture?: string; device?: string } | null> {
  try {
    const gpu = (navigator as unknown as {
      gpu?: { requestAdapter: () => Promise<{ info?: { vendor?: string; architecture?: string; device?: string } } | null> };
    }).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { vendor: '(no adapter)' };
    if (!adapter.info) return { vendor: '(masked)' };
    return adapter.info;
  } catch {
    return null;
  }
}

function getPerfMemory(): { usedMb: number; limitMb: number } | null {
  try {
    const pm = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!pm) return null;
    return {
      usedMb: Math.round(pm.usedJSHeapSize / 1_048_576),
      limitMb: Math.round(pm.jsHeapSizeLimit / 1_048_576),
    };
  } catch {
    return null;
  }
}

async function getKeyboardLayoutCount(): Promise<number | null> {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap: () => Promise<Map<string, string>> } }).keyboard;
    if (!kb?.getLayoutMap) return null;
    const map = await kb.getLayoutMap();
    return map.size;
  } catch {
    return null;
  }
}

function formatBytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

export default function FingerprintPage() {
  const [canvas, setCanvas] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [webgl, setWebgl] = useState<{ vendor: string; renderer: string } | null>(null);
  const [webglExt, setWebglExt] = useState<ReturnType<typeof getWebGLExtended>>(null);
  const [webgpu, setWebgpu] = useState<Awaited<ReturnType<typeof getWebGPUInfo>>>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [devices, setDevices] = useState<DeviceCounts | null>(null);
  const [voices, setVoices] = useState<Awaited<ReturnType<typeof getSpeechVoices>>>(null);
  const [uaData, setUaData] = useState<UAData | null>(null);
  const [perfMem, setPerfMem] = useState<ReturnType<typeof getPerfMemory>>(null);
  const [kbLayout, setKbLayout] = useState<number | null>(null);
  const [computing, setComputing] = useState(true);
  const [tick, setTick] = useState(0); // used to force re-render of hash

  const { data: server } = useQuery({
    queryKey: ['client-hints'],
    queryFn: () => getClientHints(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, a, d, v, uad, gpu, perm, stor, kb] = await Promise.all([
        getCanvasHash(),
        getAudioHash(),
        getMediaDevices(),
        getSpeechVoices(),
        getUAData(),
        getWebGPUInfo(),
        getPermissionsSnapshot(),
        getStorageEstimate(),
        getKeyboardLayoutCount(),
      ]);
      if (!alive) return;
      setCanvas(c);
      setAudio(a);
      setWebgl(getWebGL());
      setWebglExt(getWebGLExtended());
      setWebgpu(gpu);
      setFonts(detectFonts());
      setStorage(stor);
      setPermissions(perm);
      setDevices(d);
      setVoices(v);
      setUaData(uad);
      setPerfMem(getPerfMemory());
      setKbLayout(kb);
      try {
        const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
        if (nav.getBattery) {
          const b = await nav.getBattery();
          if (alive) setBattery({ level: b.level, charging: b.charging });
        }
      } catch { /* unsupported */ }
      if (alive) setComputing(false);
    })();
    return () => { alive = false; };
  }, []);

  const sections = useMemo(() => {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const scr = typeof screen !== 'undefined' ? screen : undefined;
    const win = typeof window !== 'undefined' ? window : undefined;
    const doc = typeof document !== 'undefined' ? document : undefined;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;

    const mm = (q: string): boolean | null => {
      try { return win?.matchMedia?.(q).matches ?? null; } catch { return null; }
    };
    const has = (key: string, obj: unknown = win): boolean => {
      try { return obj != null && key in (obj as object); } catch { return false; }
    };
    const conn = (nav as unknown as {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean; type?: string };
    })?.connection;

    const dnt = (nav as unknown as { doNotTrack?: string }).doNotTrack ?? null;
    const gpc = (nav as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl ?? null;

    return [
      {
        title: 'network',
        rows: [
          { key: 'ip', value: server?.ip, entropy: 'uniq' },
          { key: 'country', value: server?.country, entropy: 'med' },
          { key: 'city', value: server?.city, entropy: 'high' },
          { key: 'region', value: server?.region, entropy: 'med' },
          { key: 'asn', value: server?.asn, entropy: 'med' },
          { key: 'cf colo', value: server?.colo, entropy: 'low', note: 'nearest cloudflare edge' },
          { key: 'cf ray', value: server?.cfRay, entropy: 'low' },
          { key: 'connection', value: conn?.effectiveType ?? null, entropy: 'low' },
          { key: 'downlink', value: conn?.downlink ? `${conn.downlink} Mbps` : null, entropy: 'low' },
          { key: 'rtt', value: conn?.rtt ? `${conn.rtt}ms` : null, entropy: 'low' },
          { key: 'save-data', value: conn?.saveData ?? null, entropy: 'low' },
        ],
      },
      {
        title: 'identity',
        rows: [
          { key: 'user-agent', value: nav?.userAgent ?? null, entropy: 'high' },
          { key: 'platform', value: nav?.platform ?? null, entropy: 'med' },
          { key: 'vendor', value: nav?.vendor ?? null, entropy: 'low' },
          { key: 'languages', value: nav?.languages?.join(', ') ?? null, entropy: 'med' },
          { key: 'timezone', value: tz, entropy: 'med' },
          { key: 'locale', value: locale, entropy: 'low' },
          { key: 'sec-ch-ua', value: server?.secChUa, entropy: 'med', note: 'structured ua' },
          { key: 'sec-ch-ua-platform', value: server?.secChUaPlatform, entropy: 'low' },
          { key: 'sec-ch-ua-mobile', value: server?.secChUaMobile, entropy: 'low' },
          { key: 'accept-language', value: server?.acceptLanguage, entropy: 'med' },
          { key: 'ua-data brands', value: uaData?.brandsList ?? null, entropy: 'med' },
          { key: 'ua-data arch', value: uaData?.architecture ?? null, entropy: 'med' },
          { key: 'ua-data bitness', value: uaData?.bitness ?? null, entropy: 'low' },
          { key: 'ua-data platform', value: uaData?.platform ? `${uaData.platform} ${uaData.platformVersion ?? ''}`.trim() : null, entropy: 'high' },
          { key: 'ua-data model', value: uaData?.model ?? null, entropy: 'high' },
          { key: 'ua-data full version', value: uaData?.uaFullVersion ?? null, entropy: 'med' },
          { key: 'ua-data mobile', value: uaData?.mobile ?? null, entropy: 'low' },
          { key: 'referrer', value: doc?.referrer || null, entropy: 'low' },
          { key: 'history length', value: win?.history?.length ?? null, entropy: 'low' },
        ],
      },
      {
        title: 'display',
        rows: [
          { key: 'viewport', value: win ? `${win.innerWidth}×${win.innerHeight}` : null, entropy: 'low' },
          { key: 'screen', value: scr ? `${scr.width}×${scr.height}` : null, entropy: 'med' },
          { key: 'available', value: scr ? `${scr.availWidth}×${scr.availHeight}` : null, entropy: 'med' },
          { key: 'pixel ratio', value: win?.devicePixelRatio ?? null, entropy: 'low' },
          { key: 'color depth', value: scr?.colorDepth ?? null, entropy: 'low' },
          { key: 'color gamut', value: mm('(color-gamut: rec2020)') ? 'rec2020' : mm('(color-gamut: p3)') ? 'p3' : 'srgb', entropy: 'low' },
          { key: 'hdr', value: mm('(dynamic-range: high)') ?? null, entropy: 'low' },
          { key: 'prefers dark', value: mm('(prefers-color-scheme: dark)'), entropy: 'low' },
          { key: 'prefers motion', value: mm('(prefers-reduced-motion: reduce)') ? 'reduce' : 'no-preference', entropy: 'low' },
          { key: 'prefers contrast', value: mm('(prefers-contrast: more)') ? 'more' : mm('(prefers-contrast: less)') ? 'less' : 'no-preference', entropy: 'low' },
          { key: 'prefers data', value: mm('(prefers-reduced-data: reduce)') ? 'reduce' : 'no-preference', entropy: 'low' },
          { key: 'forced colors', value: mm('(forced-colors: active)') ? 'active' : 'none', entropy: 'low' },
          { key: 'inverted colors', value: mm('(inverted-colors: inverted)') ? 'inverted' : 'none', entropy: 'low' },
          { key: 'pointer', value: mm('(pointer: fine)') ? 'fine' : mm('(pointer: coarse)') ? 'coarse' : 'none', entropy: 'low' },
          { key: 'hover', value: mm('(hover: hover)') ? 'hover' : 'none', entropy: 'low' },
          { key: 'orientation', value: scr?.orientation?.type ?? null, entropy: 'low' },
        ],
      },
      {
        title: 'hardware',
        rows: [
          { key: 'cpu threads', value: nav?.hardwareConcurrency ?? null, entropy: 'med' },
          {
            key: 'device memory',
            value: (nav as unknown as { deviceMemory?: number })?.deviceMemory
              ? `${(nav as unknown as { deviceMemory: number }).deviceMemory} GB`
              : null,
            entropy: 'med',
          },
          { key: 'max touch points', value: nav?.maxTouchPoints ?? 0, entropy: 'low' },
          { key: 'battery', value: battery ? `${Math.round(battery.level * 100)}% ${battery.charging ? '↯ charging' : ''}` : null, entropy: 'low' },
          { key: 'gamepads', value: nav?.getGamepads ? nav.getGamepads().filter(Boolean).length : null, entropy: 'low' },
          { key: 'keyboard layout', value: kbLayout ? `${kbLayout} keys` : null, entropy: 'low', note: 'navigator.keyboard.getLayoutMap()' },
          { key: 'js heap used', value: perfMem ? `${perfMem.usedMb} MB` : null, entropy: 'low' },
          { key: 'js heap limit', value: perfMem ? `${perfMem.limitMb} MB` : null, entropy: 'low' },
        ],
      },
      {
        title: 'graphics',
        rows: [
          { key: 'webgl vendor', value: webgl?.vendor ?? null, entropy: 'high' },
          { key: 'webgl renderer', value: webgl?.renderer ?? null, entropy: 'uniq', note: 'often reveals GPU model' },
          { key: 'webgl2 supported', value: webglExt?.hasWebGL2 ?? null, entropy: 'low' },
          { key: 'max texture size', value: webglExt?.maxTextureSize ?? null, entropy: 'low' },
          { key: 'webgl extensions', value: webglExt?.extensions ?? null, entropy: 'low' },
          { key: 'webgpu vendor', value: webgpu?.vendor ?? null, entropy: 'med' },
          { key: 'webgpu architecture', value: webgpu?.architecture ?? null, entropy: 'med' },
          { key: 'webgpu device', value: webgpu?.device ?? null, entropy: 'med' },
          { key: 'canvas hash', value: canvas, entropy: 'uniq', note: 'rendered-text fingerprint' },
          { key: 'audio hash', value: audio, entropy: 'high', note: 'offline audio context output' },
        ],
      },
      {
        title: 'fonts',
        rows: [
          { key: 'detected', value: fonts.length ? `${fonts.length} fonts` : null, entropy: 'high' },
          ...fonts.map((f) => ({ key: '·', value: f, entropy: 'low' as Entropy })),
        ],
      },
      {
        title: 'storage',
        rows: [
          { key: 'usage', value: storage ? formatBytes(storage.usage) : null, entropy: 'low' },
          { key: 'quota', value: storage ? formatBytes(storage.quota) : null, entropy: 'low' },
          { key: 'cookies enabled', value: nav?.cookieEnabled ?? null, entropy: 'low' },
          { key: 'pdf viewer', value: (nav as unknown as { pdfViewerEnabled?: boolean })?.pdfViewerEnabled ?? null, entropy: 'low' },
          { key: 'plugins', value: nav?.plugins?.length ?? 0, entropy: 'low' },
          { key: 'mime types', value: nav?.mimeTypes?.length ?? 0, entropy: 'low' },
        ],
      },
      {
        title: 'media & i/o',
        rows: [
          { key: 'audio input', value: devices ? `${devices.audioinput} devices` : null, entropy: 'low' },
          { key: 'audio output', value: devices ? `${devices.audiooutput} devices` : null, entropy: 'low' },
          { key: 'video input', value: devices ? `${devices.videoinput} devices` : null, entropy: 'low' },
          { key: 'tts voices', value: voices ? `${voices.count}${voices.first ? ` · ${voices.first}` : ''}` : null, entropy: 'high', note: 'os-installed speech synthesis voices' },
          { key: 'bluetooth', value: has('bluetooth', nav), entropy: 'low' },
          { key: 'web serial', value: has('serial', nav), entropy: 'low' },
          { key: 'web hid', value: has('hid', nav), entropy: 'low' },
          { key: 'web usb', value: has('usb', nav), entropy: 'low' },
          { key: 'screen capture', value: has('getDisplayMedia', nav?.mediaDevices), entropy: 'low' },
          { key: 'wake lock', value: has('wakeLock', nav), entropy: 'low' },
          { key: 'midi', value: has('requestMIDIAccess', nav), entropy: 'low' },
        ],
      },
      {
        title: 'browser features',
        rows: [
          { key: 'webauthn', value: has('PublicKeyCredential'), entropy: 'low' },
          { key: 'webgpu', value: has('gpu', nav), entropy: 'low' },
          { key: 'webassembly', value: has('WebAssembly'), entropy: 'low' },
          { key: 'service worker', value: has('serviceWorker', nav), entropy: 'low' },
          { key: 'shared worker', value: has('SharedWorker'), entropy: 'low' },
          { key: 'webrtc', value: has('RTCPeerConnection'), entropy: 'low' },
          { key: 'broadcast channel', value: has('BroadcastChannel'), entropy: 'low' },
          { key: 'origin private fs', value: has('getDirectory', nav?.storage), entropy: 'low' },
          { key: 'file system access', value: has('showOpenFilePicker'), entropy: 'low' },
          { key: 'web share', value: has('share', nav), entropy: 'low' },
          { key: 'clipboard async', value: has('clipboard', nav), entropy: 'low' },
          { key: 'view transitions', value: has('startViewTransition', doc), entropy: 'low' },
          { key: 'navigation api', value: has('navigation', win), entropy: 'low' },
          { key: 'popover api', value: has('showPopover', doc?.createElement('div')), entropy: 'low' },
          { key: 'webtransport', value: has('WebTransport'), entropy: 'low' },
          { key: 'offscreencanvas', value: has('OffscreenCanvas'), entropy: 'low' },
          { key: 'intl segmenter', value: has('Segmenter', Intl), entropy: 'low' },
          { key: 'intersection obs', value: has('IntersectionObserver'), entropy: 'low' },
          { key: 'resize obs', value: has('ResizeObserver'), entropy: 'low' },
          { key: 'streams', value: has('ReadableStream'), entropy: 'low' },
        ],
      },
      {
        title: 'privacy signals',
        rows: [
          { key: 'do-not-track', value: dnt, entropy: 'low', note: 'navigator.doNotTrack' },
          { key: 'global privacy control', value: gpc, entropy: 'low', note: 'navigator.globalPrivacyControl' },
          ...Object.entries(permissions).map(([k, v]) => ({ key: k, value: v, entropy: 'low' as Entropy })),
        ],
      },
    ] as Section[];
  }, [server, webgl, webglExt, webgpu, canvas, audio, fonts, storage, permissions, battery, devices, voices, uaData, perfMem, kbLayout]);

  const allRows = useMemo(() => sections.flatMap((s) => s.rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== '')), [sections]);
  const totalBits = useMemo(
    () => allRows.reduce((sum, r) => sum + ENTROPY_BITS[r.entropy], 0),
    [allRows],
  );

  const [fingerprint, setFingerprint] = useState<string | null>(null);
  useEffect(() => {
    if (computing) return;
    const basis = sections
      .flatMap((s) => s.rows)
      .filter((r) => r.value !== null && r.value !== undefined)
      .map((r) => `${r.key}=${String(r.value)}`)
      .join('|');
    void sha256Hex(basis).then((h) => setFingerprint(h));
    setTick((t) => t + 1);
  }, [computing, sections]);

  const copyJson = () => {
    const dump: Record<string, Record<string, unknown>> = {};
    for (const s of sections) {
      dump[s.title] = {};
      for (const r of s.rows) {
        if (r.value !== null && r.value !== undefined && r.value !== '') {
          dump[s.title][r.key] = r.value;
        }
      }
    }
    dump['fingerprint'] = { hash: fingerprint, bits: totalBits };
    try { navigator.clipboard.writeText(JSON.stringify(dump, null, 2)); } catch { /* noop */ }
  };

  const copyHash = () => { if (fingerprint) try { navigator.clipboard.writeText(fingerprint); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-fp">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">fingerprint</span>
        </div>

        <header className="fp-hd">
          <h1>fingerprint<span className="dot">.</span></h1>
          <p className="sub">
            everything your browser silently tells every site you visit. rendered entirely from your own
            device + a handful of request headers cloudflare adds. nothing stored, nothing phoned home.
          </p>
        </header>

        <section className="fp-hero">
          <div className="fp-hero-l">
            <div className="fp-hero-lbl">your fingerprint hash</div>
            <div className="fp-hero-hash" key={tick} title={fingerprint ?? ''}>
              {fingerprint ? (
                <>
                  <span className="fp-hash-a">{fingerprint.slice(0, 8)}</span>
                  <span className="fp-hash-b">{fingerprint.slice(8, 24)}</span>
                  <span className="fp-hash-a">{fingerprint.slice(24, 40)}</span>
                  <span className="fp-hash-b">{fingerprint.slice(40)}</span>
                </>
              ) : (
                <span className="skel" style={{ display: 'inline-block', width: '100%', height: 18 }} />
              )}
            </div>
            <div className="fp-hero-actions">
              <button className="fp-btn" onClick={copyHash}>copy hash</button>
              <button className="fp-btn" onClick={copyJson}>copy json</button>
            </div>
          </div>
          <div className="fp-hero-r">
            <div className="fp-hero-lbl">uniqueness</div>
            <EntropyMeter bits={totalBits} />
            <div className="fp-hero-r-sub">
              {totalBits < 15 ? 'very common' :
                totalBits < 25 ? 'common' :
                  totalBits < 40 ? 'uncommon' :
                    totalBits < 60 ? 'rare' : 'likely unique'}
              <span className="t-faint"> · {totalBits} bits estimated</span>
            </div>
          </div>
        </section>

        <section className="fp-grid">
          {sections.map((s) => (
            <SectionCard key={s.title} section={s} />
          ))}
        </section>

        <footer className="fp-footer">
          <p>
            this page only reads what every site already can. trackers combine these signals into a stable
            identifier; most fields are individually innocuous. the <b>canvas</b> and <b>webgl renderer</b>{' '}
            tend to be the strongest single discriminators. entropy numbers are heuristic, not measured.
          </p>
        </footer>
      </main>
    </>
  );
}

function SectionCard({ section }: { section: Section }) {
  const visible = section.rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== '');
  const bits = visible.reduce((s, r) => s + ENTROPY_BITS[r.entropy], 0);
  return (
    <article className="fp-card">
      <header className="fp-card-hd">
        <span className="fp-card-title">── {section.title}</span>
        <span className="fp-card-bits">~{bits}b</span>
      </header>
      <div className="fp-card-body">
        {visible.length === 0 ? (
          <div className="fp-empty">—</div>
        ) : (
          visible.map((r, i) => <RowItem key={`${r.key}-${i}`} row={r} />)
        )}
      </div>
    </article>
  );
}

function RowItem({ row }: { row: Row }) {
  return (
    <div className="fp-row">
      <div className="fp-row-k">{row.key}</div>
      <div className="fp-row-v" title={String(row.value)}>{fmt(row.value)}</div>
      <div className={`fp-row-e e-${row.entropy}`} title={row.note ?? ENTROPY_LABEL[row.entropy]}>
        {ENTROPY_LABEL[row.entropy]}
      </div>
    </div>
  );
}

function EntropyMeter({ bits }: { bits: number }) {
  const MAX = 60;
  const pct = Math.min(100, (bits / MAX) * 100);
  return (
    <div className="fp-meter">
      <div className="fp-meter-bar">
        <div className="fp-meter-fill" style={{ width: `${pct}%` }} />
        {[10, 25, 40].map((b) => (
          <span key={b} className="fp-meter-tick" style={{ left: `${(b / MAX) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

const CSS = `
  .shell-fp { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .fp-hd { padding: 48px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .fp-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .fp-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .fp-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .fp-hero {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--sp-6);
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .fp-hero-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--sp-2);
  }
  .fp-hero-hash {
    font-family: var(--font-mono);
    font-size: clamp(14px, 1.6vw, 18px);
    color: var(--color-fg);
    word-break: break-all;
    line-height: 1.4;
    min-height: 26px;
    margin-bottom: var(--sp-3);
    animation: fp-hash-in 0.4s ease-out;
  }
  @keyframes fp-hash-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fp-hash-a { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .fp-hash-b { color: var(--color-fg-dim); }

  .fp-hero-actions { display: flex; gap: var(--sp-2); }
  .fp-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 5px 12px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .fp-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .fp-meter-bar {
    position: relative;
    height: 16px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
    margin-bottom: var(--sp-2);
  }
  .fp-meter-fill {
    height: 100%;
    background: linear-gradient(to right,
      oklch(0.7 0.18 25),
      oklch(0.82 0.17 75),
      oklch(0.86 0.19 145));
    transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
    box-shadow: 0 0 12px var(--accent-glow);
  }
  .fp-meter-tick {
    position: absolute; top: 0; bottom: 0; width: 1px;
    background: rgba(0, 0, 0, 0.5);
  }
  .fp-hero-r-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }

  .fp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--sp-4);
    padding: var(--sp-6) 0;
  }

  .fp-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .fp-card-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .fp-card-title { text-transform: lowercase; letter-spacing: 0.04em; }
  .fp-card-bits { color: var(--color-accent-dim); }

  .fp-card-body { padding: var(--sp-2); }
  .fp-row {
    display: grid;
    grid-template-columns: 140px 1fr 60px;
    gap: var(--sp-2);
    align-items: center;
    padding: 4px 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    border-bottom: 1px dashed transparent;
  }
  .fp-row:hover {
    background: var(--color-bg-raised);
    border-bottom-color: var(--color-border);
  }
  .fp-row-k {
    color: var(--color-fg-faint);
    text-transform: lowercase;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .fp-row-v {
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
  }
  .fp-row-e {
    font-size: 9px;
    text-align: right;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 1px 4px;
    border: 1px solid transparent;
    justify-self: end;
    min-width: 48px;
  }
  .e-low { color: var(--color-fg-faint); border-color: var(--color-border); }
  .e-med { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 35%, transparent); }
  .e-high { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .e-uniq {
    color: #ec4899;
    border-color: color-mix(in srgb, #ec4899 40%, transparent);
    text-shadow: 0 0 6px color-mix(in srgb, #ec4899 40%, transparent);
  }

  .fp-empty {
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-align: center;
  }

  .fp-footer {
    padding: var(--sp-6) 0 var(--sp-10);
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-4);
  }
  .fp-footer p {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    max-width: 72ch;
    line-height: 1.65;
  }
  .fp-footer b { color: var(--color-accent); font-weight: 400; }

  @media (max-width: 640px) {
    .fp-hero { grid-template-columns: 1fr; }
    .shell-fp { padding: 0 var(--sp-4); }
    .fp-row { grid-template-columns: 110px 1fr 50px; }
  }
`;
