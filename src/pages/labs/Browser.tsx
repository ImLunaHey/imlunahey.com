import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

// Each feature is detected lazily so no-op browsers don't throw during
// module eval. Categories group related APIs for browsing / filtering.

type Feat = {
  name: string;
  detect: () => boolean;
  desc?: string;
};

type Group = { name: string; feats: Feat[] };

const has = (obj: unknown, key: string): boolean => {
  try { return obj != null && key in (obj as object); } catch { return false; }
};

const G: Group[] = [
  {
    name: 'javascript',
    feats: [
      { name: 'Promise', detect: () => typeof Promise !== 'undefined' },
      { name: 'async/await', detect: () => (async () => {}).constructor.name === 'AsyncFunction' },
      { name: 'BigInt', detect: () => typeof BigInt !== 'undefined' },
      { name: 'WeakRef', detect: () => typeof WeakRef !== 'undefined' },
      { name: 'FinalizationRegistry', detect: () => typeof FinalizationRegistry !== 'undefined' },
      { name: 'Intl.Segmenter', detect: () => has(Intl, 'Segmenter') },
      { name: 'Intl.DisplayNames', detect: () => has(Intl, 'DisplayNames') },
      { name: 'Intl.ListFormat', detect: () => has(Intl, 'ListFormat') },
      { name: 'Array.at', detect: () => typeof Array.prototype.at === 'function' },
      { name: 'Array.findLast', detect: () => typeof Array.prototype.findLast === 'function' },
      { name: 'Array.fromAsync', detect: () => typeof (Array as { fromAsync?: unknown }).fromAsync === 'function' },
      { name: 'Object.hasOwn', detect: () => typeof Object.hasOwn === 'function' },
      { name: 'structuredClone', detect: () => typeof structuredClone === 'function' },
      { name: 'AbortController', detect: () => typeof AbortController !== 'undefined' },
      { name: 'top-level await', detect: () => true /* module-only; assume yes on modern browsers */ },
    ],
  },
  {
    name: 'networking',
    feats: [
      { name: 'fetch', detect: () => typeof fetch !== 'undefined' },
      { name: 'Streams API', detect: () => typeof ReadableStream !== 'undefined' },
      { name: 'WebSocket', detect: () => typeof WebSocket !== 'undefined' },
      { name: 'WebTransport', detect: () => typeof (window as unknown as { WebTransport?: unknown }).WebTransport !== 'undefined' },
      { name: 'Server-Sent Events', detect: () => typeof EventSource !== 'undefined' },
      { name: 'Background Sync', detect: () => has(navigator, 'serviceWorker') && 'SyncManager' in window },
      { name: 'HTTP/3 (QUIC)', detect: () => !!(performance.getEntriesByType('navigation')[0] as { nextHopProtocol?: string } | undefined)?.nextHopProtocol?.includes('h3') },
    ],
  },
  {
    name: 'storage',
    feats: [
      { name: 'localStorage', detect: () => has(window, 'localStorage') },
      { name: 'sessionStorage', detect: () => has(window, 'sessionStorage') },
      { name: 'IndexedDB', detect: () => has(window, 'indexedDB') },
      { name: 'Cache API', detect: () => has(window, 'caches') },
      { name: 'OPFS (origin private fs)', detect: () => has(navigator, 'storage') && typeof (navigator.storage as { getDirectory?: unknown }).getDirectory === 'function' },
      { name: 'File System Access', detect: () => 'showOpenFilePicker' in window },
      { name: 'Storage estimate', detect: () => has(navigator, 'storage') && typeof (navigator.storage as { estimate?: unknown }).estimate === 'function' },
    ],
  },
  {
    name: 'graphics',
    feats: [
      { name: 'Canvas 2D', detect: () => !!document.createElement('canvas').getContext('2d') },
      { name: 'WebGL', detect: () => !!document.createElement('canvas').getContext('webgl') },
      { name: 'WebGL 2', detect: () => !!document.createElement('canvas').getContext('webgl2') },
      { name: 'WebGPU', detect: () => 'gpu' in navigator },
      { name: 'OffscreenCanvas', detect: () => typeof OffscreenCanvas !== 'undefined' },
      { name: 'Path2D', detect: () => typeof Path2D !== 'undefined' },
      { name: 'createImageBitmap', detect: () => typeof createImageBitmap === 'function' },
    ],
  },
  {
    name: 'media',
    feats: [
      { name: 'WebAudio', detect: () => typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined' },
      { name: 'MediaRecorder', detect: () => typeof MediaRecorder !== 'undefined' },
      { name: 'WebRTC', detect: () => typeof RTCPeerConnection !== 'undefined' },
      { name: 'getUserMedia', detect: () => has(navigator, 'mediaDevices') && typeof (navigator.mediaDevices as { getUserMedia?: unknown }).getUserMedia === 'function' },
      { name: 'getDisplayMedia', detect: () => has(navigator, 'mediaDevices') && typeof (navigator.mediaDevices as { getDisplayMedia?: unknown }).getDisplayMedia === 'function' },
      { name: 'Picture-in-Picture', detect: () => 'pictureInPictureEnabled' in document },
      { name: 'Web Speech (recognition)', detect: () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window },
      { name: 'Web Speech (synthesis)', detect: () => 'speechSynthesis' in window },
      { name: 'WebMIDI', detect: () => has(navigator, 'requestMIDIAccess') },
      { name: 'WebCodecs', detect: () => 'VideoEncoder' in window },
    ],
  },
  {
    name: 'security / identity',
    feats: [
      { name: 'SubtleCrypto', detect: () => has(crypto, 'subtle') },
      { name: 'crypto.randomUUID', detect: () => typeof crypto.randomUUID === 'function' },
      { name: 'WebAuthn', detect: () => has(window, 'PublicKeyCredential') },
      { name: 'Credential Management', detect: () => 'credentials' in navigator },
      { name: 'Trusted Types', detect: () => 'trustedTypes' in window },
      { name: 'Secure Context', detect: () => window.isSecureContext },
    ],
  },
  {
    name: 'device / sensors',
    feats: [
      { name: 'Geolocation', detect: () => 'geolocation' in navigator },
      { name: 'DeviceMotion', detect: () => 'DeviceMotionEvent' in window },
      { name: 'DeviceOrientation', detect: () => 'DeviceOrientationEvent' in window },
      { name: 'Gamepad', detect: () => typeof navigator.getGamepads === 'function' },
      { name: 'Battery', detect: () => has(navigator, 'getBattery') },
      { name: 'Vibration', detect: () => 'vibrate' in navigator },
      { name: 'Clipboard (read+write)', detect: () => has(navigator, 'clipboard') && typeof (navigator.clipboard as { readText?: unknown }).readText === 'function' },
      { name: 'WebUSB', detect: () => 'usb' in navigator },
      { name: 'WebSerial', detect: () => 'serial' in navigator },
      { name: 'WebHID', detect: () => 'hid' in navigator },
      { name: 'WebBluetooth', detect: () => 'bluetooth' in navigator },
      { name: 'WebNFC', detect: () => 'NDEFReader' in window },
      { name: 'Screen Orientation', detect: () => 'orientation' in screen },
      { name: 'Screen Wake Lock', detect: () => 'wakeLock' in navigator },
    ],
  },
  {
    name: 'ui platform',
    feats: [
      { name: 'PointerEvents', detect: () => 'PointerEvent' in window },
      { name: 'Intersection Observer', detect: () => 'IntersectionObserver' in window },
      { name: 'Resize Observer', detect: () => 'ResizeObserver' in window },
      { name: 'Mutation Observer', detect: () => 'MutationObserver' in window },
      { name: 'Page Visibility', detect: () => 'visibilityState' in document },
      { name: 'View Transitions', detect: () => 'startViewTransition' in document },
      { name: 'Popover API', detect: () => HTMLElement.prototype.hasOwnProperty('popover') },
      { name: 'Dialog element', detect: () => typeof HTMLDialogElement !== 'undefined' },
      { name: 'CustomElements', detect: () => 'customElements' in window },
      { name: 'ShadowDOM', detect: () => 'attachShadow' in Element.prototype },
      { name: 'Web Share', detect: () => 'share' in navigator },
      { name: 'File drag & drop', detect: () => 'DataTransferItemList' in window },
      { name: 'Pointer Lock', detect: () => 'requestPointerLock' in Element.prototype },
      { name: 'Fullscreen', detect: () => 'requestFullscreen' in Element.prototype },
    ],
  },
  {
    name: 'performance',
    feats: [
      { name: 'Performance Observer', detect: () => 'PerformanceObserver' in window },
      { name: 'Long Animation Frames (LoAF)', detect: () => !!(PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame') },
      { name: 'User Timing L3', detect: () => 'mark' in performance && 'measure' in performance },
      { name: 'Navigator.deviceMemory', detect: () => 'deviceMemory' in navigator },
      { name: 'Navigator.hardwareConcurrency', detect: () => 'hardwareConcurrency' in navigator },
      { name: 'Connection (NetInfo)', detect: () => 'connection' in navigator },
      { name: 'isInputPending', detect: () => 'scheduling' in navigator },
      { name: 'requestIdleCallback', detect: () => 'requestIdleCallback' in window },
    ],
  },
  {
    name: 'workers',
    feats: [
      { name: 'Web Workers', detect: () => typeof Worker !== 'undefined' },
      { name: 'Shared Workers', detect: () => typeof SharedWorker !== 'undefined' },
      { name: 'Service Worker', detect: () => 'serviceWorker' in navigator },
      { name: 'Worklet', detect: () => 'Worklet' in window },
      { name: 'SharedArrayBuffer', detect: () => typeof SharedArrayBuffer !== 'undefined' },
      { name: 'Atomics', detect: () => typeof Atomics !== 'undefined' },
    ],
  },
];

export default function BrowserPage() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return G.map((g) => ({
      ...g,
      feats: g.feats.map((f) => ({ ...f, ok: safeDetect(f) })),
    }))
      .map((g) => ({
        ...g,
        feats: q ? g.feats.filter((f) => f.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) : g.feats,
      }))
      .filter((g) => g.feats.length > 0);
  }, [query]);

  const totals = useMemo(() => {
    let total = 0, yes = 0;
    for (const g of G) {
      for (const f of g.feats) {
        total++;
        if (safeDetect(f)) yes++;
      }
    }
    return { total, yes };
  }, []);

  const uaShort = typeof navigator !== 'undefined'
    ? (navigator.userAgent.match(/(?:Chrome|Firefox|Safari|Edge|OPR|Opera|Brave)\/[\d.]+/)?.[0] ?? 'unknown')
    : 'n/a';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-browser">
        <header className="page-hd">
          <div className="label">~/labs/browser</div>
          <h1>browser<span className="dot">.</span></h1>
          <p className="sub">
            what your current browser can do, feature by feature — scoped to practical APIs you'd actually ship.
            live-detected on this exact tab, no caniuse lookup needed.
          </p>
          <div className="score-row">
            <div className="score">
              <b>{totals.yes}</b> <span>of {totals.total} supported</span>
            </div>
            <div className="bar-outer">
              <div className="bar-fill" style={{ width: `${(totals.yes / totals.total) * 100}%` }} />
            </div>
            <div className="ua">{uaShort}</div>
          </div>
        </header>

        <section className="filter-row">
          <input
            className="filter"
            placeholder="filter by feature or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </section>

        <section className="groups">
          {results.map((g) => {
            const supported = g.feats.filter((f) => f.ok).length;
            return (
              <div key={g.name} className="group">
                <div className="group-hd">
                  <span>{g.name}</span>
                  <span className="group-n">{supported} / {g.feats.length}</span>
                </div>
                <ul className="feat-list">
                  {g.feats.map((f) => (
                    <li key={f.name} className={`feat ${f.ok ? 'yes' : 'no'}`}>
                      <span className="mark">{f.ok ? '✓' : '·'}</span>
                      <span className="fname">{f.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <footer className="labs-footer">
          <span>apis · <span className="t-accent">{G.reduce((s, g) => s + g.feats.length, 0)} checked live</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function safeDetect(f: Feat): boolean {
  try { return !!f.detect(); } catch { return false; }
}

const CSS = `
  .shell-browser { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .score-row {
    margin-top: var(--sp-4);
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    flex-wrap: wrap;
  }
  .score { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .score b { color: var(--color-accent); font-size: var(--fs-xl); font-weight: 400; }
  .bar-outer {
    flex: 1;
    min-width: 200px;
    height: 8px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .bar-fill { height: 100%; background: var(--color-accent); box-shadow: 0 0 6px color-mix(in oklch, var(--color-accent) 40%, transparent); }
  .ua { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .filter-row { margin-top: var(--sp-4); }
  .filter {
    width: 100%;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 10px var(--sp-3);
    outline: 0;
  }
  .filter:focus { border-color: var(--color-accent-dim); }

  .groups { margin-top: var(--sp-5); display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--sp-3); }
  .group { border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .group-hd {
    display: flex; justify-content: space-between;
    padding: 8px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .group-n { color: var(--color-accent); }
  .feat-list { list-style: none; }
  .feat {
    display: grid;
    grid-template-columns: 20px 1fr;
    padding: 4px var(--sp-3);
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
  }
  .feat:last-child { border-bottom: 0; }
  .feat .mark { width: 16px; text-align: center; }
  .feat.yes .mark { color: var(--color-accent); }
  .feat.no .mark { color: var(--color-fg-faint); }
  .feat.yes .fname { color: var(--color-fg); }
  .feat.no .fname { color: var(--color-fg-faint); text-decoration: line-through; text-decoration-color: var(--color-border); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
