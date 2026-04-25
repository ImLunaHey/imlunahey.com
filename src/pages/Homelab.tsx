import { Link, getRouteApi } from '@tanstack/react-router';
import type { HomelabState, ServiceRow } from '../server/homelab-types';

// Editorial fields (hardware string, power draw, descriptions) are hand-
// maintained in this file. Live fields (cpu/ram/storage/uptime/load +
// service status/latency/uptime%) come from the homelab-agent push module
// (../../nixos-configs/modules/homelab-agent.nix) → /api/homelab/ingest →
// KV → loader. When KV is empty (cold deploy, secret unset, all hosts
// down) the page falls back to the editorial defaults.

const route = getRouteApi('/_main/homelab');

const ICON_BY_NAME: Record<string, string> = {
  jellyfin: '/icons/homelab/jellyfin.svg',
  immich: '/icons/homelab/immich.svg',
  'matrix-synapse': '/icons/homelab/synapse.svg',
  pihole: '/icons/homelab/pi-hole.svg',
  'uptime-kuma': '/icons/homelab/uptime-kuma.svg',
  caddy: '/icons/homelab/caddy.svg',
  romm: '/icons/homelab/romm.svg',
  rustfs: '/icons/homelab/rustfs.svg',
  gotify: '/icons/homelab/gotify.svg',
  igotify: '/icons/homelab/gotify.svg',
  'cloudflare-dns': '/icons/homelab/cloudflare.svg',
  'minecraft (atm10)': '/icons/homelab/minecraft.svg',
  arm: '/icons/homelab/arm.svg',
  tailscale: '/icons/homelab/tailscale.svg',
};

const HOST_ICON = '/icons/homelab/nixos.svg';

function fmtUptime(secs: number | undefined): string {
  if (!secs || secs <= 0) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtKb(kb: number | undefined): string {
  if (!kb || kb <= 0) return '—';
  const gb = kb / (1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GiB`;
  const mb = kb / 1024;
  return `${mb.toFixed(0)} MiB`;
}

function fmtBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(2)} TiB`;
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GiB`;
}

function fmtAge(ts: number | undefined): string {
  if (!ts) return 'never';
  const now = Date.now() / 1000;
  const dt = Math.max(0, now - ts);
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

/** A host counts as "fresh" if its last push was within the staleness
 *  window. Window = 3× the 60s push interval, so a single missed beat
 *  doesn't redden the page; two in a row does. */
const STALE_AFTER_SECS = 180;
function isFresh(ts: number | undefined): boolean {
  if (!ts) return false;
  return Date.now() / 1000 - ts < STALE_AFTER_SECS;
}

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
    name: 'nova',
    role: 'media server / reverse proxy / matrix',
    hw: 'x86_64 server',
    cpu: '?',
    ram: '?',
    storage: '?',
    os: 'nixos 24.05',
    powerW: 0,
    uptimeDays: 0,
  },
  {
    name: 'gilbert',
    role: 'media ripping / minecraft / nfs',
    hw: 'x86_64 server',
    cpu: '?',
    ram: '?',
    storage: '?',
    os: 'nixos 24.05',
    powerW: 0,
    uptimeDays: 0,
  },
  {
    name: 'void',
    role: 'nas · zfs raid',
    hw: 'x86_64 server',
    cpu: '?',
    ram: '?',
    storage: 'zfs raid',
    os: 'nixos 24.05',
    powerW: 0,
    uptimeDays: 0,
  },
];

const SERVICES: Service[] = [
  { name: 'jellyfin', host: 'nova', kind: 'media', desc: 'self-hosted media library; streams whatever gilbert ripped to whichever tv is on', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://jellyfin.flaked.org' },
  { name: 'immich', host: 'nova', kind: 'media', desc: 'photo library, replaces icloud for anything i actually care about', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://immich.flaked.org' },
  { name: 'matrix-synapse', host: 'nova', kind: 'infra', desc: 'matrix homeserver; federates out, postgres-backed', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://matrix.flaked.org' },
  { name: 'pihole', host: 'nova', kind: 'security', desc: 'network-wide dns blocklists for the whole house', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://pihole.flaked.org' },
  { name: 'uptime-kuma', host: 'nova', kind: 'infra', desc: 'monitors every other service. this page reads from its api.', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://status.flaked.org' },
  { name: 'caddy', host: 'nova', kind: 'web', desc: 'reverse proxy + auto-tls for every public *.flaked.org hostname', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'romm', host: 'nova', kind: 'media', desc: 'rom library + emulator frontend; postgres-backed', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://romm.flaked.org' },
  { name: 'rustfs', host: 'nova', kind: 'storage', desc: 's3-compatible object store; serves as a backup target', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://s3.flaked.org' },
  { name: 'gotify', host: 'nova', kind: 'infra', desc: 'push notifications for nixos upgrades + alerts', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://gotify.flaked.org' },
  { name: 'igotify', host: 'nova', kind: 'infra', desc: 'second gotify instance — split channel for noisier alerts', status: 'up', latency_ms: 0, uptime_pct: 0, url: 'https://igotify.flaked.org' },
  { name: 'cloudflare-dns', host: 'nova', kind: 'infra', desc: 'reads caddy vhosts at boot, upserts cloudflare a-records to match', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'minecraft (atm10)', host: 'gilbert', kind: 'automation', desc: 'all-the-mods 10 server on neoforge', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'arm', host: 'gilbert', kind: 'media', desc: 'automatic ripping machine — feed it a disc, get an mkv', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'nfs', host: 'gilbert', kind: 'storage', desc: '/mnt/media exports to the rest of the lan', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'samba', host: 'void', kind: 'storage', desc: 'smb shares for the few windows machines that need them', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'smartd', host: 'void', kind: 'security', desc: 'watches every disk for early-failure smart attributes; pages on trouble', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'rustic-backup', host: 'nova', kind: 'storage', desc: 'restic-compatible nightly backups; deduped + encrypted', status: 'up', latency_ms: 0, uptime_pct: 0 },
  { name: 'tailscale', host: 'nova', kind: 'infra', desc: 'wireguard mesh; nova advertises subnet routes + acts as exit node', status: 'up', latency_ms: 0, uptime_pct: 0 },
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

export default function HomelabPage() {
  const live = route.useLoaderData() as HomelabState;

  // Merge live service status (keyed by name) onto the editorial list.
  // Services not present in the live blob keep their editorial 'up'
  // default but render without the status pill (gated below by `live`).
  const liveServiceMap = new Map<string, ServiceRow>();
  if (live.services) {
    for (const s of live.services.data) liveServiceMap.set(s.name, s);
  }
  const servicesDataReady = live.services !== null;

  const degradedCount = servicesDataReady
    ? [...liveServiceMap.values()].filter((s) => s.status === 'degraded').length
    : 0;
  const downCount = servicesDataReady
    ? [...liveServiceMap.values()].filter((s) => s.status === 'down').length
    : 0;
  const freshHosts = HOSTS.filter((h) => isFresh(live.hosts[h.name]?.ts)).length;

  // Capacity (panel 04) is the sum of all reported zpools across hosts —
  // void is the only one with zfs in practice, but a future host with a
  // pool would just add to the total without code changes.
  const allPools = Object.values(live.hosts).flatMap((h) => h.data.zpools ?? []);
  const totalPoolBytes = allPools.reduce((s, p) => s + (p.size_bytes || 0), 0);
  const usedPoolBytes = allPools.reduce((s, p) => s + (p.alloc_bytes || 0), 0);
  const usedPct = totalPoolBytes > 0 ? (usedPoolBytes / totalPoolBytes) * 100 : 0;

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
            three nixos boxes on tailscale. runs everything i refuse to cloud — photos, media, matrix, push
            notifications. host telemetry pushed every 60s by the homelab-agent module on each box; service
            status scraped from uptime-kuma on nova.
          </p>
          <div className="meta">
            <span>
              hosts <b className="t-accent">{freshHosts}</b>/{HOSTS.length} reporting
            </span>
            <span>
              services <b className="t-accent">{SERVICES.length}</b>
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
            {!servicesDataReady ? (
              <span className="t-faint">service status pending uptime-kuma push</span>
            ) : null}
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
     │ router  │   home gateway · 192.168.0.0/24
     └────┬────┘
          │
     ┌────┴───────────────┬──────────────┐
     │                    │              │
 ┌───┴────┐           ┌───┴────┐    ┌────┴───┐
 │  nova  │           │gilbert │    │  void  │
 │  .10   │           │  .11   │    │  .12   │
 │ caddy  │           │ ripper │    │  zfs   │
 │ matrix │           │  mc    │    │  nas   │
 │ media  │           │  nfs   │    │ samba  │
 └───┬────┘           └────────┘    └────────┘
     │
     ▼
 [ tailscale ⇄ cloudflare dns ⇄ *.flaked.org ]`}</pre>
        </section>

        {/* 02 · HOSTS */}
        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>hosts.
          </h2>
          <span className="src">{HOSTS.length} machines · all nixos · all on tailscale</span>
        </div>
        <section className="host-grid">
          {HOSTS.map((h) => {
            const entry = live.hosts[h.name];
            const fresh = isFresh(entry?.ts);
            const d = entry?.data;
            const cpu = d?.cpu?.model
              ? `${d.cpu.model.replace(/\s*\(.*\)\s*/g, '').trim()}${d.cpu.cores ? ` · ${d.cpu.cores}c` : ''}`
              : '—';
            const ram = d?.mem_kb ? fmtKb(d.mem_kb.total) : '—';
            const storage = d?.zpools?.length
              ? d.zpools.map((p) => `${p.name}: ${fmtBytes(p.size_bytes)} ${p.health}`).join(' · ')
              : d?.root_kb
              ? `root: ${fmtKb(d.root_kb.used)} / ${fmtKb(d.root_kb.total)}`
              : '—';
            const os = d?.os ?? h.os;
            return (
              <div key={h.name} className="host-card">
                <div className="host-hd">
                  <img src={HOST_ICON} className="host-ico" alt="" />
                  <span className="host-name">{h.name}</span>
                  {fresh ? <span className="host-dot" /> : null}
                  <span className="host-role">{h.role}</span>
                </div>
                <dl className="host-dl">
                  <dt>cpu</dt>
                  <dd>{cpu}</dd>
                  <dt>ram</dt>
                  <dd>{ram}</dd>
                  <dt>storage</dt>
                  <dd>{storage}</dd>
                  <dt>os</dt>
                  <dd>{os}</dd>
                  <dt>load</dt>
                  <dd>{d?.load1 != null ? d.load1.toFixed(2) : '—'}</dd>
                  <dt>uptime</dt>
                  <dd>{fmtUptime(d?.uptime_secs)}</dd>
                  <dt>last seen</dt>
                  <dd className={fresh ? 't-accent' : 't-faint'}>{fmtAge(entry?.ts)}</dd>
                </dl>
              </div>
            );
          })}
        </section>

        {/* 03 · SERVICES */}
        <div className="section-hd">
          <h2>
            <span className="num">03 //</span>services.
          </h2>
          <span className="src">{SERVICES.length} containers across {HOSTS.length} hosts</span>
        </div>
        <section className="svc-list">
          {SERVICES.map((s) => {
            const liveSvc = liveServiceMap.get(s.name);
            const status = liveSvc?.status ?? s.status;
            const iconPath = ICON_BY_NAME[s.name];
            return (
              <div key={s.name} className={'svc-row status-' + status}>
                <div className="svc-ico" aria-hidden="true">
                  {iconPath ? (
                    <img src={iconPath} alt="" className="svc-ico-img" />
                  ) : (
                    <span className="svc-ico-glyph">{KIND_GLYPH[s.kind]}</span>
                  )}
                </div>
                <div className="svc-body">
                  <div className="svc-top">
                    <span className="svc-name">{s.name}</span>
                    <span className="svc-kind">{KIND_LABEL[s.kind]}</span>
                    <span className="svc-host">@{s.host}</span>
                  </div>
                  <div className="svc-desc">{s.desc}</div>
                </div>
                {liveSvc ? (
                  <div className="svc-stats">
                    <div className="svc-stat">
                      <span className="svc-k">status</span>
                      <span className={'svc-v svc-status'}>
                        <span className="svc-led" />
                        {status}
                      </span>
                    </div>
                    <div className="svc-stat">
                      <span className="svc-k">uptime</span>
                      <span className="svc-v">{liveSvc.uptime_pct.toFixed(2)}%</span>
                    </div>
                    <div className="svc-stat">
                      <span className="svc-k">latency</span>
                      <span className="svc-v">{liveSvc.latency_ms}ms</span>
                    </div>
                  </div>
                ) : (
                  <div className="svc-stats svc-stats-pending">
                    <span className="t-faint">awaiting uptime-kuma</span>
                  </div>
                )}
              </div>
            );
          })}
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
              <span className="src-tag">// zfs pools across all hosts</span>
            </div>
            {totalPoolBytes > 0 ? (
              <>
                <div className="big-num">
                  <span className="num-val">{(usedPoolBytes / 1024 ** 4).toFixed(1)}</span>
                  <span className="num-unit">TiB used</span>
                </div>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${usedPct}%` }} />
                </div>
                <div className="stat-line">
                  <span>
                    total <b>{(totalPoolBytes / 1024 ** 4).toFixed(1)} TiB</b>
                  </span>
                  <span>
                    free{' '}
                    <b>{((totalPoolBytes - usedPoolBytes) / 1024 ** 4).toFixed(1)} TiB</b>
                  </span>
                  <span className="t-faint">{usedPct.toFixed(0)}% used</span>
                </div>
              </>
            ) : (
              <>
                <div className="big-num">
                  <span className="num-val t-faint">—</span>
                  <span className="num-unit">awaiting void</span>
                </div>
                <div className="stat-line">
                  <span className="t-faint">
                    void hasn't reported any zpools yet
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="panel c-backups">
            <div className="panel-hd">
              <span className="ttl">backups</span>
              <span className="src-tag">// rustic-backup module</span>
            </div>
            <dl className="bk-dl">
              <dt>tool</dt>
              <dd>rustic (restic-compatible)</dd>
              <dt>schedule</dt>
              <dd>nightly via systemd timer</dd>
              <dt>encryption</dt>
              <dd>per-host repo password (sops)</dd>
              <dt>last snapshot</dt>
              <dd className="t-faint">tbd — agent will report</dd>
            </dl>
          </div>

          <div className="panel c-net">
            <div className="panel-hd">
              <span className="ttl">network</span>
              <span className="src-tag">// tailscale + caddy</span>
            </div>
            <dl className="bk-dl">
              <dt>subnet</dt>
              <dd>192.168.0.0/24</dd>
              <dt>tailscale</dt>
              <dd>nova as exit + subnet router</dd>
              <dt>public dns</dt>
              <dd>*.flaked.org via cloudflare</dd>
              <dt>dns blocking</dt>
              <dd className="t-faint">tbd — pihole stats</dd>
            </dl>
          </div>
        </section>

        <footer className="hl-footer">
          <span>
            src: <span className="t-accent">homelab-agent (nixos) → /api/homelab/ingest (tbd) → this page</span>
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
  .host-ico { width: 20px; height: 20px; object-fit: contain; opacity: 0.85; }
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
    display: flex; align-items: center; justify-content: center;
  }
  .svc-ico-img {
    width: 28px; height: 28px;
    object-fit: contain;
    /* desaturate slightly so brand reds/greens don't fight the page accent */
    filter: saturate(0.85);
  }
  .svc-ico-glyph { display: inline-block; }
  .svc-row.status-up .svc-ico-glyph { color: var(--color-accent); }
  .svc-row.status-degraded .svc-ico-glyph { color: var(--color-warn); }
  .svc-row.status-down .svc-ico-glyph { color: var(--color-alert); }
  .svc-stats-pending {
    grid-template-columns: 1fr;
    align-items: center; justify-content: end;
    text-align: right;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }

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
