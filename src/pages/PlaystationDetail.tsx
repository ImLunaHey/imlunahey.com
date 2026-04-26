import { Link, getRouteApi } from '@tanstack/react-router';
import type {
  PsnGameDetail,
  PsnPlatformTrophies,
  PsnTrophy,
} from '../server/playstation';

const route = getRouteApi('/_main/playstation/$id');

const PLATFORM_LABEL: Record<string, string> = {
  ps5_native_game: 'ps5',
  ps4_game: 'ps4',
  ps3_game: 'ps3',
  psvita_game: 'vita',
  pspc_game: 'pc (psn)',
  unknown: 'other',
};
function platformLabel(category: string): string {
  if (PLATFORM_LABEL[category]) return PLATFORM_LABEL[category];
  return category.replace(/_native_game$/, '').replace(/_game$/, '').replace(/_/g, ' ');
}

function fmtPlaytime(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(seconds / 86400);
  const w = Math.floor(d / 7);
  if (w >= 1) {
    const remD = d - w * 7;
    return remD > 0 ? `${w}w ${remD}d` : `${w}w`;
  }
  if (d >= 1) {
    const remH = h - d * 24;
    return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
  }
  if (h >= 1) {
    const remM = m - h * 60;
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  }
  return `${m}m`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const TROPHY_GLYPH: Record<PsnTrophy['type'], string> = {
  platinum: '◆',
  gold: '●',
  silver: '●',
  bronze: '●',
};

export default function PlaystationDetailPage() {
  const detail = route.useLoaderData() as PsnGameDetail | null;

  if (!detail) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-psd">
          <div className="not-found">
            <p className="t-faint">no game in your psn library matches that id</p>
            <Link to="/playstation" className="t-accent">
              ← back to /playstation
            </Link>
          </div>
        </main>
      </>
    );
  }

  const { group, platforms } = detail;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-psd">
        <div className="lead">
          <div className="lead-art">
            {group.imageUrl ? (
              <img src={group.imageUrl} alt={group.name} />
            ) : (
              <div className="art-fallback">{group.name.slice(0, 2)}</div>
            )}
            <div className="lead-platforms">
              {group.categories.map((c) => (
                <span key={c} className="lead-platform">
                  {platformLabel(c)}
                </span>
              ))}
            </div>
          </div>
          <div className="lead-meta">
            <Link to="/playstation" className="back-link">
              ← /playstation
            </Link>
            <h1>{group.name}</h1>
            <div className="facts">
              <span>
                total <b className="t-fg">{fmtPlaytime(group.totalSeconds)}</b>
              </span>
              <span className="dot">·</span>
              <span>
                <b className="t-fg">{group.totalCount}</b> sessions
              </span>
              <span className="dot">·</span>
              <span>
                first <b className="t-fg">{fmtDate(group.firstPlayedAt)}</b>
              </span>
              <span className="dot">·</span>
              <span>
                last <b className="t-fg">{fmtDate(group.lastPlayedAt)}</b>
              </span>
            </div>

            {/* per-platform playtime breakdown — one row per titleId
                so the reader can see which generation got which time */}
            {group.members.length > 1 ? (
              <table className="member-table">
                <thead>
                  <tr>
                    <th>platform</th>
                    <th>playtime</th>
                    <th>sessions</th>
                    <th>last played</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <tr key={m.titleId}>
                      <td>{platformLabel(m.category)}</td>
                      <td>{fmtPlaytime(m.playSeconds)}</td>
                      <td>{m.playCount}</td>
                      <td>{fmtDate(m.lastPlayedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>

        {platforms.length === 0 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">01 //</span>trophies.
            </h2>
            <p className="t-faint">
              no trophy data — psn either doesn&apos;t track trophies for this title, or the title name
              didn&apos;t match a trophy entry in your account.
            </p>
          </section>
        ) : (
          platforms.map((p, i) => (
            <PlatformTrophiesSection key={p.npCommunicationId} index={i + 1} platform={p} />
          ))
        )}

        <footer className="psd-footer">
          <span>
            src:{' '}
            <span className="t-accent">
              psn-api · {group.members.length} title{group.members.length === 1 ? '' : 's'}
            </span>
          </span>
          <span>
            ←{' '}
            <Link to="/playstation" className="t-accent">
              playstation
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function PlatformTrophiesSection({
  index,
  platform,
}: {
  index: number;
  platform: PsnPlatformTrophies;
}) {
  const { defined, earned } = platform;
  const total = defined.bronze + defined.silver + defined.gold + defined.platinum;
  const earnedTotal = earned.bronze + earned.silver + earned.gold + earned.platinum;
  return (
    <section className="section">
      <div className="section-hd-row">
        <h2 className="section-hd">
          <span className="num">{String(index).padStart(2, '0')} //</span>
          {platformLabel(platform.category)} trophies.
        </h2>
        <span className="t-faint">
          <b className="t-fg">{earnedTotal}</b>/{total} · <b className="t-accent">{platform.progress}%</b>
        </span>
      </div>
      <div className="trophy-summary">
        <TrophyChip type="platinum" earned={earned.platinum} total={defined.platinum} />
        <TrophyChip type="gold" earned={earned.gold} total={defined.gold} />
        <TrophyChip type="silver" earned={earned.silver} total={defined.silver} />
        <TrophyChip type="bronze" earned={earned.bronze} total={defined.bronze} />
      </div>
      <div className="trophy-list">
        {platform.trophies.map((t) => (
          <TrophyRow key={t.trophyId} trophy={t} />
        ))}
      </div>
    </section>
  );
}

function TrophyChip({
  type,
  earned,
  total,
}: {
  type: PsnTrophy['type'];
  earned: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className={'tchip tchip-' + type}>
      <span className="tchip-glyph">{TROPHY_GLYPH[type]}</span>
      <span className="tchip-text">
        <b>{earned}</b>/{total} {type}
      </span>
    </div>
  );
}

function TrophyRow({ trophy }: { trophy: PsnTrophy }) {
  // Hidden + unearned trophies have no name/detail revealed by PSN;
  // show a generic placeholder so we don't render an empty row.
  const isHiddenLocked = trophy.hidden && !trophy.earned;
  const className =
    'trow trow-' + trophy.type + (trophy.earned ? ' trow-earned' : ' trow-locked');
  return (
    <article className={className}>
      <div className="trow-icon">
        {trophy.iconUrl && !isHiddenLocked ? (
          <img src={trophy.iconUrl} alt="" loading="lazy" />
        ) : (
          <div className="trow-icon-fallback">{TROPHY_GLYPH[trophy.type]}</div>
        )}
      </div>
      <div className="trow-body">
        <div className="trow-top">
          <span className={'trow-type trow-type-' + trophy.type}>{trophy.type}</span>
          {trophy.earnedRate != null ? (
            <span className="trow-rate t-faint">{trophy.earnedRate.toFixed(1)}% earn rate</span>
          ) : null}
          {trophy.earned ? (
            <span className="trow-earned-at t-faint">earned {fmtDate(trophy.earnedAt)}</span>
          ) : null}
        </div>
        <div className="trow-name">
          {isHiddenLocked ? <span className="t-faint">hidden trophy</span> : trophy.name ?? '—'}
        </div>
        {!isHiddenLocked && trophy.detail ? (
          <div className="trow-detail t-faint">{trophy.detail}</div>
        ) : null}
      </div>
    </article>
  );
}

const CSS = `
  .shell-psd { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .not-found {
    padding: 120px 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .not-found .t-accent { display: inline-block; margin-top: var(--sp-3); }

  .lead {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--sp-6);
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .lead-art {
    position: relative;
    aspect-ratio: 16 / 9;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .lead-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .art-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 48px;
    color: var(--color-fg-faint); text-transform: lowercase;
  }
  .lead-platforms {
    position: absolute;
    top: 8px; right: 8px;
    display: flex; gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100% - 16px);
  }
  .lead-platform {
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: 1px solid var(--color-accent-dim);
  }
  .lead-meta { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
  .back-link {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
  }
  .back-link:hover { color: var(--color-accent); text-decoration: none; }
  .lead-meta h1 {
    font-family: var(--font-display);
    font-size: clamp(36px, 5vw, 56px);
    font-weight: 500; letter-spacing: -0.02em; line-height: 1.05;
    color: var(--color-fg);
    margin: 0;
  }
  .facts {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .facts b.t-fg { color: var(--color-fg); font-weight: 400; }
  .facts .dot { color: var(--color-fg-ghost); }

  .member-table {
    margin-top: var(--sp-3);
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .member-table th, .member-table td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px dashed var(--color-border);
  }
  .member-table th {
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.1em;
    font-size: 10px;
    font-weight: 400;
  }
  .member-table td { color: var(--color-fg-dim); }

  .section {
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .section-hd-row {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-3);
    gap: var(--sp-3);
  }
  .section-hd {
    font-family: var(--font-display);
    font-size: 24px; font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
  }
  .section-hd .num {
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 13px;
    margin-right: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .section-hd-row > .t-faint {
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .section-hd-row b.t-fg { color: var(--color-fg); font-weight: 400; }

  /* trophy summary chips */
  .trophy-summary {
    display: flex; flex-wrap: wrap; gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .tchip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--color-border-bright);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .tchip-glyph { font-size: 14px; line-height: 1; }
  .tchip-text { color: var(--color-fg-dim); text-transform: lowercase; letter-spacing: 0.06em; }
  .tchip-text b { color: var(--color-fg); font-weight: 400; }
  .tchip-platinum .tchip-glyph { color: oklch(0.84 0.13 220); }
  .tchip-gold .tchip-glyph { color: oklch(0.86 0.16 90); }
  .tchip-silver .tchip-glyph { color: oklch(0.82 0.02 250); }
  .tchip-bronze .tchip-glyph { color: oklch(0.65 0.13 50); }

  /* trophy list */
  .trophy-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--sp-2) var(--sp-3);
  }
  .trow {
    display: flex; gap: var(--sp-3); align-items: flex-start;
    padding: 8px;
    border: 1px solid transparent;
  }
  .trow-locked { opacity: 0.55; }
  .trow-earned { border-color: var(--color-border); background: var(--color-bg-panel); }
  .trow-icon {
    width: 48px; height: 48px;
    flex-shrink: 0;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .trow-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .trow-icon-fallback {
    font-size: 24px;
    color: var(--color-fg-faint);
  }
  .trow-platinum .trow-icon-fallback { color: oklch(0.84 0.13 220); }
  .trow-gold .trow-icon-fallback { color: oklch(0.86 0.16 90); }
  .trow-silver .trow-icon-fallback { color: oklch(0.82 0.02 250); }
  .trow-bronze .trow-icon-fallback { color: oklch(0.65 0.13 50); }
  .trow-body { min-width: 0; flex: 1; }
  .trow-top {
    display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap;
    font-family: var(--font-mono); font-size: 9px;
  }
  .trow-type {
    text-transform: uppercase; letter-spacing: 0.12em;
    padding: 1px 5px;
    border: 1px solid;
  }
  .trow-type-platinum { color: oklch(0.84 0.13 220); border-color: oklch(0.5 0.1 220); }
  .trow-type-gold { color: oklch(0.86 0.16 90); border-color: oklch(0.5 0.1 90); }
  .trow-type-silver { color: oklch(0.82 0.02 250); border-color: oklch(0.5 0.02 250); }
  .trow-type-bronze { color: oklch(0.65 0.13 50); border-color: oklch(0.45 0.1 50); }
  .trow-name {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg);
    margin-top: 4px;
  }
  .trow-detail {
    font-family: var(--font-mono); font-size: 10px;
    line-height: 1.45;
    margin-top: 2px;
  }

  .psd-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .lead { grid-template-columns: 1fr; }
    .lead-art { max-width: 100%; }
    .trophy-list { grid-template-columns: 1fr; }
    .psd-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
