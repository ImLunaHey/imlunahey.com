import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type Parsed = {
  browser: { name: string; version: string } | null;
  engine: { name: string; version: string } | null;
  os: { name: string; version: string } | null;
  device: { type: string; vendor?: string; model?: string } | null;
  bot: boolean;
};

/**
 * Hand-rolled UA parser. Not exhaustive — covers mainstream browsers/OSes +
 * the obvious bots. For rare user agents fall back to the 'unknown' label.
 */
function parseUA(ua: string): Parsed {
  if (!ua) return { browser: null, engine: null, os: null, device: null, bot: false };

  // ── bots ─────────────────────────────────────────────────────────────
  const BOT = /bot|crawl|spider|curl|wget|python-requests|httpie|node-fetch|facebookexternalhit|slackbot|discordbot|telegrambot|whatsapp/i;

  // ── browser (order matters: narrow names before generic fallbacks) ───
  const BROWSERS: Array<[RegExp, string]> = [
    [/edg(?:e|ios|a)?\/([\d.]+)/i, 'Edge'],
    [/opr\/([\d.]+)/i, 'Opera'],
    [/firefox\/([\d.]+)/i, 'Firefox'],
    [/fxios\/([\d.]+)/i, 'Firefox (iOS)'],
    [/crios\/([\d.]+)/i, 'Chrome (iOS)'],
    [/samsungbrowser\/([\d.]+)/i, 'Samsung Internet'],
    [/ucbrowser\/([\d.]+)/i, 'UC Browser'],
    [/brave\/([\d.]+)/i, 'Brave'],
    [/vivaldi\/([\d.]+)/i, 'Vivaldi'],
    [/duckduckgo\/([\d.]+)/i, 'DuckDuckGo'],
    [/chrome\/([\d.]+)/i, 'Chrome'],
    [/safari\/([\d.]+)/i, 'Safari'],
  ];
  let browser: Parsed['browser'] = null;
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) {
      let v = m[1];
      // For Safari, the actual version is in `Version/x.y`
      if (name === 'Safari') {
        const vm = /version\/([\d.]+)/i.exec(ua);
        if (vm) v = vm[1];
      }
      browser = { name, version: v };
      break;
    }
  }

  // ── engine ───────────────────────────────────────────────────────────
  const ENGINES: Array<[RegExp, string]> = [
    [/gecko\/([\d.]+)/i, 'Gecko'],
    [/applewebkit\/([\d.]+)/i, 'WebKit'],
    [/blink/i, 'Blink'],
    [/trident\/([\d.]+)/i, 'Trident'],
    [/presto\/([\d.]+)/i, 'Presto'],
  ];
  let engine: Parsed['engine'] = null;
  for (const [re, name] of ENGINES) {
    const m = re.exec(ua);
    if (m) { engine = { name, version: m[1] ?? '' }; break; }
  }
  // Chrome/Edge/etc all use Blink, which doesn't report itself — infer from WebKit + Chrome
  if (engine?.name === 'WebKit' && /chrome/i.test(ua)) engine = { name: 'Blink', version: '' };

  // ── os ───────────────────────────────────────────────────────────────
  let os: Parsed['os'] = null;
  const M = (r: RegExp) => r.exec(ua);
  let m: RegExpExecArray | null;
  if ((m = M(/windows nt ([\d.]+)/i))) os = { name: 'Windows', version: winVer(m[1]) };
  else if ((m = M(/mac os x ([\d_.]+)/i))) os = { name: 'macOS', version: m[1].replace(/_/g, '.') };
  else if (/mac/i.test(ua) && !/mobile/i.test(ua)) os = { name: 'macOS', version: '' };
  else if ((m = M(/iphone os ([\d_.]+)/i))) os = { name: 'iOS', version: m[1].replace(/_/g, '.') };
  else if ((m = M(/cpu os ([\d_.]+)/i))) os = { name: 'iPadOS', version: m[1].replace(/_/g, '.') };
  else if ((m = M(/android ([\d.]+)/i))) os = { name: 'Android', version: m[1] };
  else if (/ubuntu/i.test(ua)) os = { name: 'Ubuntu', version: '' };
  else if (/fedora/i.test(ua)) os = { name: 'Fedora', version: '' };
  else if (/arch/i.test(ua)) os = { name: 'Arch Linux', version: '' };
  else if (/linux/i.test(ua)) os = { name: 'Linux', version: '' };
  else if (/cros/i.test(ua)) os = { name: 'Chrome OS', version: '' };
  else if (/freebsd/i.test(ua)) os = { name: 'FreeBSD', version: '' };

  // ── device ───────────────────────────────────────────────────────────
  let device: Parsed['device'] = null;
  if (/iphone/i.test(ua)) device = { type: 'mobile', vendor: 'Apple', model: 'iPhone' };
  else if (/ipad/i.test(ua)) device = { type: 'tablet', vendor: 'Apple', model: 'iPad' };
  else if (/ipod/i.test(ua)) device = { type: 'mobile', vendor: 'Apple', model: 'iPod' };
  else if (/android.*mobile/i.test(ua)) device = { type: 'mobile', vendor: 'Android', model: modelFromUa(ua) };
  else if (/android/i.test(ua)) device = { type: 'tablet', vendor: 'Android', model: modelFromUa(ua) };
  else if (/windows phone/i.test(ua)) device = { type: 'mobile', vendor: 'Microsoft', model: 'Windows Phone' };
  else if (/kindle/i.test(ua)) device = { type: 'tablet', vendor: 'Amazon', model: 'Kindle' };
  else if (/tv|smart-tv|tizen|webos/i.test(ua)) device = { type: 'tv' };
  else if (/bot|crawl|spider/i.test(ua)) device = { type: 'bot' };
  else device = { type: 'desktop' };

  return { browser, engine, os, device, bot: BOT.test(ua) };
}

function winVer(nt: string): string {
  const map: Record<string, string> = {
    '5.1': 'XP', '6.0': 'Vista', '6.1': '7', '6.2': '8', '6.3': '8.1',
    '10.0': '10 / 11',
  };
  return map[nt] ?? nt;
}

function modelFromUa(ua: string): string {
  const m = /;\s*([A-Z0-9-]{4,})\s*\)/.exec(ua);
  return m?.[1] ?? '';
}

const PRESETS: Array<{ label: string; ua: string }> = [
  { label: 'chrome · mac', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
  { label: 'safari · iphone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { label: 'firefox · windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0' },
  { label: 'edge', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' },
  { label: 'googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'curl', ua: 'curl/8.4.0' },
];

export default function UaPage() {
  const [input, setInput] = useState('');
  const parsed = useMemo(() => parseUA(input), [input]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') setInput(navigator.userAgent);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ua">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">ua</span>
        </div>

        <header className="ua-hd">
          <h1>ua<span className="dot">.</span></h1>
          <p className="sub">
            paste any user-agent string — extract browser, engine, os, and device classification. the
            box is pre-filled with your own ua on load.
          </p>
        </header>

        <textarea
          className="ua-ta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder="Mozilla/5.0 (…)"
        />

        <div className="ua-presets">
          <span className="ua-lbl">try</span>
          {PRESETS.map((p) => (
            <button key={p.label} className="ua-chip" onClick={() => setInput(p.ua)}>{p.label}</button>
          ))}
        </div>

        <section className="ua-cards">
          <Card title="browser" value={parsed.browser ? `${parsed.browser.name} ${parsed.browser.version}` : 'unknown'} primary />
          <Card title="engine" value={parsed.engine ? `${parsed.engine.name} ${parsed.engine.version}`.trim() : 'unknown'} />
          <Card title="os" value={parsed.os ? `${parsed.os.name} ${parsed.os.version}`.trim() : 'unknown'} />
          <Card
            title="device"
            value={parsed.device
              ? `${parsed.device.type}${parsed.device.vendor ? ' · ' + parsed.device.vendor : ''}${parsed.device.model ? ' ' + parsed.device.model : ''}`
              : 'unknown'}
          />
        </section>

        {parsed.bot ? (
          <div className="ua-bot">✗ bot-like ua detected</div>
        ) : null}
      </main>
    </>
  );
}

function Card({ title, value, primary }: { title: string; value: string; primary?: boolean }) {
  return (
    <article className={`ua-card ${primary ? 'primary' : ''}`}>
      <div className="ua-card-k">{title}</div>
      <div className="ua-card-v">{value}</div>
    </article>
  );
}

const CSS = `
  .shell-ua { max-width: 1040px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .ua-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .ua-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .ua-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ua-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }

  .ua-ta {
    width: 100%;
    margin: var(--sp-5) 0 var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: vertical;
    outline: 0;
    word-break: break-all;
  }
  .ua-ta:focus { border-color: var(--color-accent-dim); }

  .ua-presets {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin-bottom: var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .ua-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .ua-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
    text-transform: lowercase;
  }
  .ua-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ua-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-3);
    padding-bottom: var(--sp-10);
  }
  .ua-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: 4px;
  }
  .ua-card.primary { border-color: var(--color-accent-dim); }
  .ua-card-k {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .ua-card-v {
    font-family: var(--font-display);
    font-size: clamp(20px, 2.2vw, 28px);
    font-weight: 500;
    color: var(--color-fg);
    line-height: 1.1;
    word-break: break-word;
  }
  .ua-card.primary .ua-card-v { color: var(--color-accent); text-shadow: 0 0 8px var(--accent-glow); }

  .ua-bot {
    padding: var(--sp-3);
    border: 1px solid var(--color-warn);
    background: color-mix(in oklch, var(--color-warn) 5%, transparent);
    color: var(--color-warn);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    margin-bottom: var(--sp-10);
  }
`;
