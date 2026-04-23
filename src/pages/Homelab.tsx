import { Link } from '@tanstack/react-router';

// All data is mock for now — will later be pulled from uptime kuma, prometheus,
// and the nas itself. The shape matches what those sources already emit.

type Host = {
  name: string;
  role: string;
  hw: string;
  cpu: string;
  ram: string;
  storage: string;
  os: string;
  powerW: number;
  uptimeDays: number;
};

type Service = {
  name: string;
  host: string;
  kind: 'media' | 'storage' | 'infra' | 'automation' | 'web' | 'security';
  desc: string;
  status: 'up' | 'degraded' | 'down';
  latency_ms: number;
  uptime_pct: number;
  url?: string;
};

const HOSTS: Host[] = [
  {
    name: 'vault',
    role: 'primary nas',
    hw: 'synology ds1823xs+',
    cpu: 'amd ryzen v1780b · 4c/8t',
    ram: '32 GB ecc',
    storage: '8× 16TB exos · raid6 · 80 TiB usable',
    os: 'dsm 7.2',
    powerW: 78,
    uptimeDays: 412,
  },
  {
    name: 'forge',
    role: 'compute · docker host',
    hw: 'minisforum ms-01',
    cpu: 'intel i9-12900h · 14c/20t',
    ram: '64 GB ddr5',
    storage: '2× 2TB nvme · mirrored',
    os: 'proxmox 8.2',
    powerW: 42,
    uptimeDays: 187,
  },
  {
    name: 'edge',
    role: 'gateway · firewall',
    hw: 'protectli vp2420',
    cpu: 'intel j6412 · 4c/4t',
    ram: '16 GB',
    storage: '256 GB nvme',
    os: 'opnsense 24.1',
    powerW: 11,
    uptimeDays: 412,
  },
  {
    name: 'pi-dns',
    role: 'dns + adblock',
    hw: 'raspberry pi 5',
    cpu: 'bcm2712 · 4c',
    ram: '8 GB',
    storage: '128 GB sd',
    os: 'pi os lite',
    powerW: 4,
    uptimeDays: 298,
  },
];

const SERVICES: Service[] = [
  { name: 'jellyfin', host: 'forge', kind: 'media', desc: 'self-hosted plex alternative, serves 4k transcodes to the apple tv', status: 'up', latency_ms: 22, uptime_pct: 99.98, url: 'https://jellyfin.local' },
  { name: 'immich', host: 'vault', kind: 'media', desc: 'photo library, replaces icloud for anything i care about', status: 'up', latency_ms: 41, uptime_pct: 99.82, url: 'https://photos.local' },
  { name: 'nextcloud', host: 'forge', kind: 'storage', desc: 'files + calendar + contacts, backs up the iphone nightly', status: 'up', latency_ms: 55, uptime_pct: 99.72 },
  { name: 'pihole', host: 'pi-dns', kind: 'security', desc: 'network-wide dns blocklists; ~18% of queries get nuked', status: 'up', latency_ms: 1, uptime_pct: 99.99 },
  { name: 'uptime-kuma', host: 'forge', kind: 'infra', desc: 'monitoring. this page will pull from its api eventually.', status: 'up', latency_ms: 8, uptime_pct: 99.9 },
  { name: 'gitea', host: 'forge', kind: 'infra', desc: 'mirrors my github repos + hosts private ones', status: 'up', latency_ms: 34, uptime_pct: 99.6 },
  { name: 'home assistant', host: 'forge', kind: 'automation', desc: 'lights, blinds, and a tiny number of sensors i regret buying', status: 'up', latency_ms: 12, uptime_pct: 99.95 },
  { name: 'vaultwarden', host: 'forge', kind: 'security', desc: 'self-hosted bitwarden; syncs to the ios app over tailscale', status: 'up', latency_ms: 29, uptime_pct: 99.88 },
  { name: 'caddy', host: 'edge', kind: 'web', desc: 'reverse proxy + auto-tls for every internal service', status: 'up', latency_ms: 3, uptime_pct: 99.99 },
  { name: 'tailscale', host: 'edge', kind: 'infra', desc: 'wireguard mesh; every device in one flat network', status: 'up', latency_ms: 16, uptime_pct: 99.97 },
  { name: 'prometheus', host: 'forge', kind: 'infra', desc: 'metric scraper feeding grafana', status: 'up', latency_ms: 19, uptime_pct: 99.82 },
  { name: 'grafana', host: 'forge', kind: 'infra', desc: 'dashboards for power, temps, service latency, network in/out', status: 'degraded', latency_ms: 280, uptime_pct: 98.4 },
  { name: 'backrest', host: 'vault', kind: 'storage', desc: 'restic-based backup to b2 cold storage; nightly snapshots of everything', status: 'up', latency_ms: 50, uptime_pct: 99.5 },
  { name: 'linkwarden', host: 'forge', kind: 'web', desc: 'self-hosted bookmarks archive — shadow copy of /bookmarks', status: 'up', latency_ms: 44, uptime_pct: 99.8 },
];

const KIND_LABEL: Record<Service['kind'], string> = {
  media: 'media',
  storage: 'storage',
  infra: 'infra',
  automation: 'home',
  web: 'web',
  security: 'security',
};

const KIND_GLYPH: Record<Service['kind'], string> = {
  media: '▶',
  storage: '◧',
  infra: '◰',
  automation: '⌂',
  web: '⌘',
  security: '◈',
};

const totalPower = HOSTS.reduce((s, h) => s + h.powerW, 0);
const monthlyKwh = (totalPower * 24 * 30) / 1000;
const monthlyCostGBP = monthlyKwh * 0.28; // rough uk rate
const totalStorageTb = 80 + 4; // mock mirrored nvme etc
const usedPct = 62;

export default function HomelabPage() {
  const upCount = SERVICES.filter((s) => s.status === 'up').length;
  const degradedCount = SERVICES.filter((s) => s.status === 'degraded').length;
  const downCount = SERVICES.filter((s) => s.status === 'down').length;
  const avgUptime = SERVICES.reduce((s, svc) => s + svc.uptime_pct, 0) / SERVICES.length;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hl">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/homelab
          </div>
          <h1>
            homelab<span className="dot">.</span>
          </h1>
          <p className="sub">
            four boxes, a 10gbe switch, and too many docker containers. runs everything i refuse to cloud — photos,
            media, backups, auth. numbers below are <b className="t-warn">mock data</b> while the uptime-kuma webhook
            lives in a branch.
          </p>
          <div className="meta">
            <span>
              services <b className="t-accent">{upCount}</b> up
              {degradedCount ? (
                <>
                  {' '}
                  · <b className="t-warn">{degradedCount}</b> degraded
                </>
              ) : null}
              {downCount ? (
                <>
                  {' '}
                  · <b className="t-alert">{downCount}</b> down
                </>
              ) : null}
            </span>
            <span>
              avg uptime <b>{avgUptime.toFixed(2)}%</b>
            </span>
            <span>
              total draw <b>{totalPower} W</b>
            </span>
            <span>
              monthly <b>~£{monthlyCostGBP.toFixed(2)}</b>
            </span>
          </div>
        </header>

        {/* 01 · TOPOLOGY */}
        <div className="section-hd">
          <h2>
            <span className="num">01 //</span>topology.
          </h2>
          <span className="src">ascii · the whole rack in 20 lines</span>
        </div>
        <section>
          <pre className="topo">{`     [ internet ]
          │
     ┌────┴────┐
     │   edge  │   opnsense · 1Gbps wan · 10Gbps lan
     └────┬────┘
          │
     ┌────┴─────────┬────────────────┬─────────────┐
     │              │                │             │
 ┌───┴───┐      ┌───┴───┐        ┌───┴───┐     ┌───┴──┐
 │ vault │◁────▷│ forge │◁──10g─▷│pi-dns │     │ wifi │
 │  nas  │      │ docker│        │pihole │     │ uap6 │
 └───────┘      └───────┘        └───────┘     └──┬───┘
    80tb          ms-01            pi 5           │
                                                  ▼
                                              [ clients ]`}</pre>
        </section>

        {/* 02 · HOSTS */}
        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>hosts.
          </h2>
          <span className="src">{HOSTS.length} machines · {totalPower} W at idle</span>
        </div>
        <section className="host-grid">
          {HOSTS.map((h) => (
            <div key={h.name} className="host-card">
              <div className="host-hd">
                <span className="host-name">{h.name}</span>
                <span className="host-dot" />
                <span className="host-role">{h.role}</span>
              </div>
              <dl className="host-dl">
                <dt>hardware</dt>
                <dd>{h.hw}</dd>
                <dt>cpu</dt>
                <dd>{h.cpu}</dd>
                <dt>ram</dt>
                <dd>{h.ram}</dd>
                <dt>storage</dt>
                <dd>{h.storage}</dd>
                <dt>os</dt>
                <dd>{h.os}</dd>
                <dt>power</dt>
                <dd>
                  <b className="t-accent">{h.powerW} W</b> idle
                </dd>
                <dt>uptime</dt>
                <dd>{h.uptimeDays} days</dd>
              </dl>
            </div>
          ))}
        </section>

        {/* 03 · SERVICES */}
        <div className="section-hd">
          <h2>
            <span className="num">03 //</span>services.
          </h2>
          <span className="src">{SERVICES.length} containers across {HOSTS.length} hosts</span>
        </div>
        <section className="svc-list">
          {SERVICES.map((s) => (
            <div key={s.name} className={'svc-row status-' + s.status}>
              <div className="svc-ico" aria-hidden="true">
                {KIND_GLYPH[s.kind]}
              </div>
              <div className="svc-body">
                <div className="svc-top">
                  <span className="svc-name">{s.name}</span>
                  <span className="svc-kind">{KIND_LABEL[s.kind]}</span>
                  <span className="svc-host">@{s.host}</span>
                </div>
                <div className="svc-desc">{s.desc}</div>
              </div>
              <div className="svc-stats">
                <div className="svc-stat">
                  <span className="svc-k">status</span>
                  <span className={'svc-v svc-status'}>
                    <span className="svc-led" />
                    {s.status}
                  </span>
                </div>
                <div className="svc-stat">
                  <span className="svc-k">uptime</span>
                  <span className="svc-v">{s.uptime_pct.toFixed(2)}%</span>
                </div>
                <div className="svc-stat">
                  <span className="svc-k">latency</span>
                  <span className="svc-v">{s.latency_ms}ms</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 04 · STORAGE */}
        <div className="section-hd">
          <h2>
            <span className="num">04 //</span>storage.
          </h2>
          <span className="src">raid6 · nightly restic → b2</span>
        </div>
        <section className="bento">
          <div className="panel c-storage">
            <div className="panel-hd">
              <span className="ttl">capacity</span>
              <span className="src-tag">// vault (primary)</span>
            </div>
            <div className="big-num">
              <span className="num-val">{((totalStorageTb * usedPct) / 100).toFixed(0)}</span>
              <span className="num-unit">TiB used</span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${usedPct}%` }} />
            </div>
            <div className="stat-line">
              <span>
                total <b>{totalStorageTb} TiB</b>
              </span>
              <span>
                free <b>{((totalStorageTb * (100 - usedPct)) / 100).toFixed(0)} TiB</b>
              </span>
              <span className="t-faint">growth ~1.4 TiB/mo</span>
            </div>
          </div>

          <div className="panel c-backups">
            <div className="panel-hd">
              <span className="ttl">backups</span>
              <span className="src-tag">// restic · b2 · b3sum</span>
            </div>
            <dl className="bk-dl">
              <dt>last snapshot</dt>
              <dd>
                <b className="t-accent">2h 14m ago</b>
              </dd>
              <dt>snapshots held</dt>
              <dd>day·30 · week·12 · month·24</dd>
              <dt>offsite size</dt>
              <dd>18.2 TiB compressed · deduped</dd>
              <dt>last verify</dt>
              <dd>2026-04-19 · clean</dd>
              <dt>restore drill</dt>
              <dd>quarterly · next 2026-06-01</dd>
            </dl>
          </div>

          <div className="panel c-net">
            <div className="panel-hd">
              <span className="ttl">network</span>
              <span className="src-tag">// 24h aggregate</span>
            </div>
            <dl className="bk-dl">
              <dt>wan in</dt>
              <dd>82.3 GiB</dd>
              <dt>wan out</dt>
              <dd>14.8 GiB</dd>
              <dt>lan (10gbe)</dt>
              <dd>
                peak <b>6.2 Gbps</b>
              </dd>
              <dt>dns queries</dt>
              <dd>192k · <span className="t-accent">18.4%</span> blocked</dd>
              <dt>tailscale nodes</dt>
              <dd>11 online</dd>
            </dl>
          </div>
        </section>

        <footer className="hl-footer">
          <span>
            src: <span className="t-accent">uptime-kuma + prometheus → /api/homelab (tbd) → this page</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-hl { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 70ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub b.t-warn { color: var(--color-warn); font-weight: 400; }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5); font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }
  .page-hd .meta b.t-warn { color: var(--color-warn); }
  .page-hd .meta b.t-alert { color: var(--color-alert); }

  .section-hd {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .section-hd h2 {
    font-family: var(--font-display); font-size: 28px; font-weight: 500;
    color: var(--color-fg); letter-spacing: -0.02em;
  }
  .section-hd h2 .num { color: var(--color-accent); font-family: var(--font-mono); font-size: 13px; margin-right: 14px; letter-spacing: 0.08em; }
  .section-hd .src { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  /* topology */
  .topo {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-5);
    line-height: 1.5;
    overflow: auto;
    margin: 0;
  }

  /* hosts */
  .host-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--sp-3);
  }
  .host-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
  }
  .host-hd {
    display: flex; align-items: center; gap: var(--sp-2);
    padding-bottom: var(--sp-2);
    margin-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
  }
  .host-name {
    font-family: var(--font-display);
    font-size: 24px; color: var(--color-accent);
    text-shadow: 0 0 8px var(--accent-glow);
  }
  .host-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 4px var(--accent-glow);
    animation: hl-pulse 2s ease-in-out infinite;
  }
  .host-role {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-left: auto;
  }
  @keyframes hl-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .host-dl {
    display: grid; grid-template-columns: 90px 1fr;
    gap: 6px 10px; margin: 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .host-dl dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .host-dl dd { color: var(--color-fg-dim); margin: 0; word-break: break-word; }
  .host-dl dd b.t-accent { color: var(--color-accent); font-weight: 400; }

  /* services */
  .svc-list { display: flex; flex-direction: column; }
  .svc-row {
    display: grid;
    grid-template-columns: 40px 1fr 280px;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-2);
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
  }
  .svc-ico {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--color-fg-faint);
    text-align: center;
  }
  .svc-row.status-up .svc-ico { color: var(--color-accent); }
  .svc-row.status-degraded .svc-ico { color: var(--color-warn); }
  .svc-row.status-down .svc-ico { color: var(--color-alert); }

  .svc-top { display: flex; gap: var(--sp-2); align-items: baseline; flex-wrap: wrap; }
  .svc-name {
    font-family: var(--font-display); font-size: 20px;
    color: var(--color-fg); letter-spacing: -0.01em;
  }
  .svc-kind {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-accent);
    text-transform: uppercase; letter-spacing: 0.12em;
    padding: 1px 6px;
    border: 1px solid var(--color-accent-dim);
  }
  .svc-host {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
  }
  .svc-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    margin-top: 4px;
    line-height: 1.45;
  }

  .svc-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .svc-stat { display: flex; flex-direction: column; gap: 2px; }
  .svc-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.12em; }
  .svc-v { color: var(--color-fg); font-size: var(--fs-xs); }
  .svc-status { display: flex; align-items: center; gap: 6px; }
  .svc-led {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
  }
  .status-up .svc-led { background: var(--color-accent); box-shadow: 0 0 4px var(--accent-glow); }
  .status-up .svc-v.svc-status { color: var(--color-accent); }
  .status-degraded .svc-led { background: var(--color-warn); box-shadow: 0 0 4px oklch(0.7 0.15 85); }
  .status-degraded .svc-v.svc-status { color: var(--color-warn); }
  .status-down .svc-led { background: var(--color-alert); }
  .status-down .svc-v.svc-status { color: var(--color-alert); }

  /* bento panels (storage / backups / net) */
  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--sp-3);
  }
  .shell-hl .panel {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
    overflow: visible;
  }
  .shell-hl .panel-hd {
    display: flex; justify-content: space-between;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.14em;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--color-border);
  }
  .shell-hl .panel-hd .ttl { color: var(--color-accent); }
  .c-storage { grid-column: span 5; }
  .c-backups { grid-column: span 4; }
  .c-net     { grid-column: span 3; }

  .big-num { display: flex; align-items: baseline; gap: 6px; }
  .big-num .num-val {
    font-family: var(--font-display);
    font-size: 44px; line-height: 1;
    color: var(--color-fg);
  }
  .big-num .num-unit {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
  }
  .bar {
    height: 10px;
    background: var(--color-border);
    position: relative;
  }
  .bar-fill {
    height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
  }
  .stat-line {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .stat-line b { color: var(--color-fg); font-weight: 400; }

  .bk-dl {
    display: grid; grid-template-columns: auto 1fr;
    gap: 6px var(--sp-3); margin: 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .bk-dl dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .bk-dl dd { color: var(--color-fg); margin: 0; }
  .bk-dl dd b.t-accent { color: var(--color-accent); font-weight: 400; }
  .bk-dl .t-accent { color: var(--color-accent); }

  .hl-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 980px) {
    .bento { grid-template-columns: repeat(6, 1fr); }
    .bento > * { grid-column: span 6 !important; }
    .svc-row { grid-template-columns: 40px 1fr; }
    .svc-stats { grid-column: 1 / -1; }
  }
`;
