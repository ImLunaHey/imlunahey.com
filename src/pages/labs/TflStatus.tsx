import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchLineStatuses, lineColor, severityColor, type LineStatus } from '../../lib/tfl';

export default function TflStatusPage() {
  const q = useQuery({
    queryKey: ['tfl-status'],
    queryFn: () => fetchLineStatuses(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const lines = (q.data ?? []).slice().sort((a, b) => {
    // worst status first, then by name
    const sa = Math.min(...a.lineStatuses.map((s) => s.statusSeverity));
    const sb = Math.min(...b.lineStatuses.map((s) => s.statusSeverity));
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  const summary = summarise(lines);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tfl">
        <header className="page-hd">
          <div className="label">~/labs/tfl/status</div>
          <h1>tfl status<span className="dot">.</span></h1>
          <p className="sub">
            live service status for every tube, dlr, elizabeth line, overground, tram, and cable-car
            line. refreshed every minute from the tfl unified api.
          </p>
          <div className="summary">
            <span className="chip ok">{summary.good} good</span>
            {summary.minor > 0 ? <span className="chip warn">{summary.minor} minor</span> : null}
            {summary.severe > 0 ? <span className="chip bad">{summary.severe} severe</span> : null}
            {summary.closed > 0 ? <span className="chip alert">{summary.closed} closed</span> : null}
            <span className="t-faint">· refreshed {q.dataUpdatedAt ? relTime(q.dataUpdatedAt) : '—'}</span>
          </div>
        </header>

        {q.isError ? (
          <div className="err">could not reach tfl — try again shortly.</div>
        ) : null}

        <section className="lines">
          {lines.map((l) => {
            const c = lineColor(l.id);
            const s = l.lineStatuses[0];
            const statusC = severityColor(s?.statusSeverity ?? 10);
            const reason = s?.reason ?? null;
            return (
              <div key={l.id} className="line">
                <div className="line-chip" style={{ background: c.bg, color: c.fg }}>{c.label}</div>
                <div className="line-status" style={{ color: statusC }}>
                  <span className="dot-sm" style={{ background: statusC }} />
                  {s?.statusSeverityDescription ?? '—'}
                </div>
                {reason ? <div className="line-reason">{cleanReason(reason, c.label)}</div> : null}
              </div>
            );
          })}
          {lines.length === 0 && !q.isLoading ? <div className="empty">no data</div> : null}
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl unified api · no key</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function summarise(lines: LineStatus[]) {
  let good = 0, minor = 0, severe = 0, closed = 0;
  for (const l of lines) {
    const sev = Math.min(...l.lineStatuses.map((s) => s.statusSeverity));
    if (sev === 10) good++;
    else if (sev >= 8) minor++;
    else if (sev >= 5) severe++;
    else closed++;
  }
  return { good, minor, severe, closed };
}

function cleanReason(reason: string, lineLabel: string): string {
  // tfl prefixes most reasons with "<line name>: " — strip that for a cleaner read.
  return reason.replace(new RegExp(`^${lineLabel}( (Line|and .+?))?:\\s*`, 'i'), '');
}

function relTime(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.round(diff / 60);
  return `${m}m ago`;
}

const CSS = `
  .shell-tfl { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .summary { margin-top: var(--sp-4); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .chip { padding: 2px 8px; border: 1px solid; }
  .chip.ok { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .chip.warn { color: #ffd166; border-color: #ffd166; }
  .chip.bad { color: #ff9f6a; border-color: #ff9f6a; }
  .chip.alert { color: var(--color-alert); border-color: var(--color-alert); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); background: color-mix(in oklch, var(--color-alert) 6%, transparent); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .empty { padding: var(--sp-8); text-align: center; color: var(--color-fg-faint); }

  .lines { margin-top: var(--sp-5); display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-3); }
  .line { padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); display: flex; flex-direction: column; gap: 6px; }
  .line-chip { align-self: flex-start; padding: 3px 10px; font-family: var(--font-mono); font-weight: 500; font-size: var(--fs-xs); letter-spacing: 0.04em; }
  .line-status { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-sm); }
  .dot-sm { display: inline-block; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .line-reason { color: var(--color-fg-dim); font-size: var(--fs-xs); line-height: 1.5; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
