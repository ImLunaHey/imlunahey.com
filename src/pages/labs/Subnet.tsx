import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Info = {
  address: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  hostCount: number;
  totalCount: number;
  class: string;
  privateRange: boolean;
  cidr: string;
  addrBin: string;
  maskBin: string;
  netBin: string;
};

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error('invalid ipv4 address');
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 0xff).join('.');
}

function intToBin(n: number): string {
  return [24, 16, 8, 0]
    .map((s) => ((n >>> s) & 0xff).toString(2).padStart(8, '0'))
    .join('.');
}

function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

function classOf(firstOctet: number): string {
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (multicast)';
  return 'E (reserved)';
}

function isPrivate(n: number): boolean {
  const a = (n >>> 24) & 0xff;
  const b = (n >>> 16) & 0xff;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

function compute(input: string): Info {
  const clean = input.trim();
  if (!clean) throw new Error('empty');
  let addr: string;
  let prefix: number;
  if (clean.includes('/')) {
    const [a, p] = clean.split('/');
    addr = a;
    prefix = Number(p);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      throw new Error('prefix must be 0–32');
    }
  } else {
    addr = clean;
    prefix = 32;
  }
  const addrN = ipToInt(addr);
  const maskN = prefixToMask(prefix);
  const netN = (addrN & maskN) >>> 0;
  const bcastN = (netN | (~maskN >>> 0)) >>> 0;
  const hostBits = 32 - prefix;
  const totalCount = prefix === 32 ? 1 : Math.pow(2, hostBits);
  let hostCount: number;
  let firstHost: string, lastHost: string;
  if (prefix >= 31) {
    hostCount = totalCount;
    firstHost = intToIp(netN);
    lastHost = intToIp(bcastN);
  } else {
    hostCount = totalCount - 2;
    firstHost = intToIp(netN + 1);
    lastHost = intToIp(bcastN - 1);
  }

  return {
    address: addr,
    prefix,
    mask: intToIp(maskN),
    wildcard: intToIp((~maskN) >>> 0),
    network: intToIp(netN),
    broadcast: intToIp(bcastN),
    firstHost,
    lastHost,
    hostCount,
    totalCount,
    class: classOf((addrN >>> 24) & 0xff),
    privateRange: isPrivate(addrN),
    cidr: `${intToIp(netN)}/${prefix}`,
    addrBin: intToBin(addrN),
    maskBin: intToBin(maskN),
    netBin: intToBin(netN),
  };
}

const PRESETS = [
  '192.168.1.1/24',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '169.254.0.0/16',
  '8.8.8.8/32',
  '192.0.2.0/24',
];

export default function SubnetPage() {
  const [input, setInput] = useState('192.168.1.1/24');
  const result = useMemo<{ ok: true; info: Info } | { ok: false; error: string }>(() => {
    try { return { ok: true, info: compute(input) }; }
    catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'parse failed' }; }
  }, [input]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-sn">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">subnet</span>
        </div>

        <header className="sn-hd">
          <h1>subnet<span className="dot">.</span></h1>
          <p className="sub">
            cidr → network, broadcast, first/last host, total count, class, and a bitwise breakdown.
            ipv4 only. paste <code>192.168.1.1/24</code> or just an ip address.
          </p>
        </header>

        <form className="sn-input-row" onSubmit={(e) => e.preventDefault()}>
          <input
            className="sn-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="192.168.1.0/24"
            autoComplete="off"
            spellCheck={false}
          />
        </form>

        <div className="sn-presets">
          <span className="sn-lbl">try</span>
          {PRESETS.map((p) => (
            <button key={p} className="sn-chip" onClick={() => setInput(p)}>{p}</button>
          ))}
        </div>

        {!result.ok ? (
          <div className="sn-err">✗ {result.error}</div>
        ) : (
          <>
            <section className="sn-hero">
              <BigStat label="cidr" value={result.info.cidr} accent />
              <BigStat label="usable hosts" value={result.info.hostCount.toLocaleString()} />
              <BigStat label="total addresses" value={result.info.totalCount.toLocaleString()} />
              <BigStat label="class" value={result.info.class} />
            </section>

            <section className="sn-grid">
              <Row k="address" v={result.info.address} onCopy={copy} />
              <Row k="prefix" v={`/${result.info.prefix}`} onCopy={copy} />
              <Row k="netmask" v={result.info.mask} onCopy={copy} />
              <Row k="wildcard" v={result.info.wildcard} onCopy={copy} />
              <Row k="network address" v={result.info.network} onCopy={copy} />
              <Row k="broadcast" v={result.info.broadcast} onCopy={copy} />
              <Row k="first host" v={result.info.firstHost} onCopy={copy} />
              <Row k="last host" v={result.info.lastHost} onCopy={copy} />
              <Row k="private range" v={result.info.privateRange ? '✓ yes' : 'no'} />
            </section>

            <section className="sn-binary">
              <header className="sn-bin-hd">── bitwise</header>
              <div className="sn-bin-rows">
                <div className="sn-bin-row">
                  <span className="sn-bin-k">addr</span>
                  <code>{splitBin(result.info.addrBin, result.info.prefix)}</code>
                </div>
                <div className="sn-bin-row">
                  <span className="sn-bin-k">mask</span>
                  <code>{splitBin(result.info.maskBin, result.info.prefix)}</code>
                </div>
                <div className="sn-bin-row">
                  <span className="sn-bin-k">net</span>
                  <code>{splitBin(result.info.netBin, result.info.prefix)}</code>
                </div>
              </div>
              <p className="sn-bin-note">
                bits on the left of the divider are the <b className="t-accent">network</b> portion;
                bits on the right are the <b className="t-warn">host</b> portion.
              </p>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function splitBin(bin: string, prefix: number): React.ReactNode {
  // each octet is 8 bits separated by "." → 35 chars total. We need to colour bits up to `prefix` one way and rest another
  const bits = bin.replace(/\./g, '');
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < 32; i++) {
    if (i > 0 && i % 8 === 0) nodes.push(<span key={`sep-${i}`} className="sn-sep">.</span>);
    nodes.push(
      <span key={i} className={i < prefix ? 'sn-net' : 'sn-host'}>{bits[i]}</span>,
    );
  }
  return <>{nodes}</>;
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="sn-stat">
      <div className="sn-stat-k">{label}</div>
      <div className={`sn-stat-v ${accent ? 'accent' : ''}`}>{value}</div>
    </div>
  );
}

function Row({ k, v, onCopy }: { k: string; v: string; onCopy?: (s: string) => void }) {
  return (
    <div className="sn-row">
      <span className="sn-row-k">{k}</span>
      <code className="sn-row-v">{v}</code>
      {onCopy ? <button className="sn-copy" onClick={() => onCopy(v)}>copy</button> : <span />}
    </div>
  );
}

const CSS = `
  .shell-sn { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .sn-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .sn-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .sn-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .sn-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }
  .sn-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .sn-input-row {
    display: flex; margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .sn-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-accent);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
  }
  .sn-presets {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
    margin: var(--sp-3) 0 var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .sn-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .sn-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
  }
  .sn-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .sn-err {
    padding: var(--sp-3);
    color: var(--color-alert);
    border: 1px solid var(--color-alert-dim);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .sn-hero {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .sn-stat {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: 4px;
  }
  .sn-stat-k { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .sn-stat-v {
    font-family: var(--font-display);
    font-size: clamp(18px, 2.4vw, 26px);
    font-weight: 500;
    color: var(--color-fg);
    line-height: 1.15;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .sn-stat-v.accent { color: var(--color-accent); text-shadow: 0 0 10px var(--accent-glow); }

  .sn-grid {
    display: flex; flex-direction: column; gap: 2px;
    margin-bottom: var(--sp-4);
  }
  .sn-row {
    display: grid;
    grid-template-columns: 180px 1fr 48px;
    gap: var(--sp-3);
    align-items: center;
    padding: 6px var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .sn-row-k { color: var(--color-fg-faint); text-transform: lowercase; }
  .sn-row-v { color: var(--color-fg); }
  .sn-copy {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-faint);
    border: 1px solid var(--color-border-bright); padding: 2px 8px;
    cursor: pointer; text-transform: lowercase;
  }
  .sn-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .sn-binary {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    margin-bottom: var(--sp-10);
  }
  .sn-bin-hd { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
  .sn-bin-rows { display: flex; flex-direction: column; gap: 4px; }
  .sn-bin-row { display: grid; grid-template-columns: 60px 1fr; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-sm); align-items: center; }
  .sn-bin-k { color: var(--color-fg-faint); text-transform: lowercase; }
  .sn-bin-row code { color: var(--color-fg); letter-spacing: 0.04em; word-break: break-all; }
  .sn-net { color: var(--color-accent); text-shadow: 0 0 4px var(--accent-glow); }
  .sn-host { color: var(--color-warn); }
  .sn-sep { color: var(--color-fg-faint); margin: 0 1px; }
  .sn-bin-note {
    margin-top: var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); line-height: 1.5;
  }
  .sn-bin-note b { font-weight: 400; }
  .t-accent { color: var(--color-accent); }
  .t-warn { color: var(--color-warn); }

  @media (max-width: 600px) {
    .sn-row { grid-template-columns: 120px 1fr 42px; }
  }
`;
