import { Link, useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  fetchLineStatuses,
  fetchLineStopPoints,
  lineColor,
  severityColor,
  type LineStatus,
} from '../../lib/tfl';

// Tube-first line set — same list tfl-status covers, minus tram and cable-car
// since those are single-route / not actually part of the central tube map.
const LINE_IDS = [
  'bakerloo', 'central', 'circle', 'district', 'elizabeth-line',
  'hammersmith-city', 'jubilee', 'metropolitan', 'northern', 'piccadilly',
  'victoria', 'waterloo-city', 'dlr',
];

export default function TflTubeMapPage() {
  const navigate = useNavigate();

  const statusQuery = useQuery({
    queryKey: ['tfl-status-all'],
    queryFn: () => fetchLineStatuses(['tube', 'dlr', 'elizabeth-line']),
    refetchInterval: 60_000,
  });

  const stopsQueries = useQueries({
    queries: LINE_IDS.map((id) => ({
      queryKey: ['tfl-line-stops', id],
      queryFn: () => fetchLineStopPoints(id),
      staleTime: 60 * 60 * 1000, // station lists change very rarely
    })),
  });

  const statusByLine = useMemo(() => {
    const m = new Map<string, LineStatus>();
    for (const l of statusQuery.data ?? []) m.set(l.id, l);
    return m;
  }, [statusQuery.data]);

  const rows = useMemo(() => {
    return LINE_IDS.map((id, i) => {
      const stops = stopsQueries[i].data ?? [];
      const status = statusByLine.get(id);
      const c = lineColor(id);
      const sev = status ? Math.min(...status.lineStatuses.map((s) => s.statusSeverity)) : 10;
      const reason = status?.lineStatuses[0]?.reason;
      const statusLabel = status?.lineStatuses[0]?.statusSeverityDescription ?? '—';
      return { id, stops, color: c, sev, reason, statusLabel };
    });
  }, [stopsQueries, statusByLine]);

  const stillLoading = stopsQueries.some((q) => q.isLoading) && rows.every((r) => r.stops.length === 0);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tube">
        <header className="page-hd">
          <div className="label">~/labs/tfl/tube-map</div>
          <h1>tube map<span className="dot">.</span></h1>
          <p className="sub">
            every tube, dlr, and elizabeth line with all its stations in order. line service status
            is overlaid live — disrupted lines pulse red. click any station to jump to its arrivals
            board.
          </p>
        </header>

        {stillLoading ? <div className="loading">loading station sequences…</div> : null}

        <section className="rows">
          {rows.map((row) => (
            <div key={row.id} className={`row ${row.sev < 10 ? 'disrupted' : ''}`}>
              <div className="row-hd">
                <div className="chip" style={{ background: row.color.bg, color: row.color.fg }}>{row.color.label}</div>
                <div className="status" style={{ color: severityColor(row.sev) }}>
                  <span className="status-dot" style={{ background: severityColor(row.sev) }} />
                  {row.statusLabel}
                </div>
                <div className="count">{row.stops.length} stations</div>
              </div>
              {row.reason ? <div className="reason">{cleanReason(row.reason, row.color.label)}</div> : null}
              <div className="track" style={{ '--line-bg': row.color.bg } as React.CSSProperties}>
                {row.stops.map((s) => (
                  <button
                    key={s.naptanId}
                    className="stop"
                    onClick={() => navigate({ to: '/labs/tfl-arrivals' as never, search: { id: s.naptanId, name: s.commonName } as never })}
                    title={`${s.commonName} → open arrivals`}
                  >
                    <span className="stop-dot" />
                    <span className="stop-label">{s.commonName}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {statusQuery.isError ? (
          <div className="err">couldn&apos;t reach tfl — status overlay may be stale.</div>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl /line and /stoppoints</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function cleanReason(reason: string, label: string): string {
  return reason.replace(new RegExp(`^${label}( (Line|and .+?))?:\\s*`, 'i'), '');
}

const CSS = `
  .shell-tube { max-width: 1300px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .rows { margin-top: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); }
  .row { border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3); }
  .row.disrupted { border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); animation: tube-pulse 2.5s ease-in-out infinite; }
  @keyframes tube-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,90,90,0); }
    50%      { box-shadow: 0 0 0 1px rgba(255,90,90,0.3), inset 0 0 10px rgba(255,90,90,0.05); }
  }

  .row-hd { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: 8px; flex-wrap: wrap; }
  .chip { padding: 3px 10px; font-family: var(--font-mono); font-weight: 500; font-size: var(--fs-xs); letter-spacing: 0.04em; }
  .status { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .count { margin-left: auto; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .reason { padding: 6px 0; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.5; }

  .track {
    position: relative;
    display: flex;
    overflow-x: auto;
    gap: 0;
    padding: var(--sp-4) 0 var(--sp-3);
    scrollbar-width: thin;
  }
  /* the coloured line running through every stop */
  .track::before {
    content: '';
    position: absolute;
    left: 0; right: 0;
    top: calc(var(--sp-4) + 6px);
    height: 4px;
    background: var(--line-bg);
    z-index: 0;
  }
  .stop {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 120px;
    padding: 0 6px;
    background: transparent;
    border: 0;
    color: var(--color-fg);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .stop-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-bg-panel);
    border: 3px solid var(--line-bg);
    transition: transform .12s;
  }
  .stop-label {
    color: var(--color-fg-dim);
    text-align: center;
    line-height: 1.3;
    max-width: 110px;
    overflow-wrap: anywhere;
  }
  .stop:hover .stop-dot { transform: scale(1.35); }
  .stop:hover .stop-label { color: var(--color-accent); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
