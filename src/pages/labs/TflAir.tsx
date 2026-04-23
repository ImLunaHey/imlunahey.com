import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAirQuality, type AirQualityBand } from '../../lib/tfl';

const BAND_COLORS: Record<string, string> = {
  'Low':          '#6aeaa0',
  'Moderate':     '#ffd166',
  'High':         '#ff9f6a',
  'Very High':    '#ff5a5a',
};

function bandColor(b?: string): string {
  return BAND_COLORS[b ?? ''] ?? '#9a9a9a';
}

const POLLUTANTS: Array<{ key: keyof AirQualityBand; label: string; full: string; info: string }> = [
  { key: 'nO2Band', label: 'NO₂', full: 'nitrogen dioxide', info: 'traffic exhaust; irritates the airways at higher bands.' },
  { key: 'o3Band', label: 'O₃', full: 'ozone', info: 'forms in sunlight from other pollutants; peaks on hot days.' },
  { key: 'pM25Band', label: 'PM₂.₅', full: 'fine particulate', info: 'tiny particles — cars, wood burners, brake dust. worst health impact.' },
  { key: 'pM10Band', label: 'PM₁₀', full: 'coarse particulate', info: 'larger particles — dust, pollen, road wear.' },
  { key: 'sO2Band', label: 'SO₂', full: 'sulfur dioxide', info: 'mostly industrial; usually low in central london.' },
];

export default function TflAirPage() {
  const q = useQuery({
    queryKey: ['tfl-air'],
    queryFn: fetchAirQuality,
    refetchInterval: 30 * 60 * 1000, // once per 30 min — it's a forecast, not live
  });

  const forecasts = q.data ?? [];
  const current = forecasts.find((f) => f.forecastType === 'Current') ?? forecasts[0];
  const forecast = forecasts.find((f) => f.forecastType === 'Forecast');

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-air">
        <header className="page-hd">
          <div className="label">~/labs/tfl/air</div>
          <h1>air<span className="dot">.</span></h1>
          <p className="sub">
            london air quality, now and tomorrow. tfl publishes a daily forecast that covers
            no₂, o₃, pm₁₀, pm₂.₅, and so₂ in four bands. the overall band is the worst of the five.
          </p>
        </header>

        {q.isError ? <div className="err">could not reach the tfl air-quality endpoint.</div> : null}

        {current ? (
          <section className="now" style={{ '--band': bandColor(current.forecastBand) } as React.CSSProperties}>
            <div className="now-hd">
              <div className="now-band">{current.forecastBand}</div>
              <div className="now-type">{current.forecastType}</div>
              <div className="now-dates">
                {fmtDate(current.fromDate)} → {fmtDate(current.toDate)}
              </div>
            </div>
            <div className="now-summary">{current.forecastSummary}</div>
            <div className="pollutants">
              {POLLUTANTS.map((p) => {
                const band = current[p.key] as string | undefined;
                return (
                  <div key={p.key} className="pol">
                    <div className="pol-label">{p.label}</div>
                    <div className="pol-band" style={{ color: bandColor(band), borderColor: bandColor(band) }}>
                      {band ?? '—'}
                    </div>
                    <div className="pol-full">{p.full}</div>
                    <div className="pol-info">{p.info}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {forecast && forecast !== current ? (
          <section className="next" style={{ '--band': bandColor(forecast.forecastBand) } as React.CSSProperties}>
            <div className="next-hd">
              <span className="next-k">tomorrow</span>
              <span className="next-band" style={{ color: bandColor(forecast.forecastBand) }}>{forecast.forecastBand}</span>
              <span className="next-dates">{fmtDate(forecast.fromDate)} → {fmtDate(forecast.toDate)}</span>
            </div>
            <div className="next-summary">{forecast.forecastSummary}</div>
          </section>
        ) : null}

        <section className="legend">
          <div className="legend-hd">bands</div>
          <div className="legend-row">
            {['Low', 'Moderate', 'High', 'Very High'].map((b) => (
              <div key={b} className="legend-item">
                <span className="sw" style={{ background: BAND_COLORS[b] }} />
                {b}
              </div>
            ))}
          </div>
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl /airquality</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function fmtDate(s?: string): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
}

const CSS = `
  .shell-air { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .now {
    margin-top: var(--sp-5);
    border: 1px solid var(--band);
    background: color-mix(in oklch, var(--band) 6%, var(--color-bg-panel));
  }
  .now-hd { display: flex; align-items: baseline; gap: var(--sp-4); padding: var(--sp-4); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
  .now-band { font-family: var(--font-display); font-size: 56px; color: var(--band); letter-spacing: -0.02em; line-height: 1; }
  .now-type { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .now-dates { margin-left: auto; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .now-summary { padding: var(--sp-4); color: var(--color-fg-dim); font-size: var(--fs-sm); line-height: 1.55; border-bottom: 1px solid var(--color-border); }
  .pollutants { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1px; background: var(--color-border); }
  .pol { background: var(--color-bg-panel); padding: var(--sp-3); display: flex; flex-direction: column; gap: 4px; }
  .pol-label { font-family: var(--font-display); font-size: 24px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1; }
  .pol-band { align-self: flex-start; padding: 1px 8px; border: 1px solid; font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .pol-full { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .pol-info { color: var(--color-fg-dim); font-size: var(--fs-xs); line-height: 1.5; }

  .next { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .next-hd { display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; }
  .next-k { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .next-band { font-family: var(--font-mono); font-size: var(--fs-sm); font-weight: 500; }
  .next-dates { margin-left: auto; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .next-summary { color: var(--color-fg-dim); font-size: var(--fs-sm); line-height: 1.55; margin-top: 6px; }

  .legend { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .legend-hd { padding: 8px var(--sp-3); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .legend-row { display: flex; gap: var(--sp-4); padding: var(--sp-3); flex-wrap: wrap; }
  .legend-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .legend-item .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; box-shadow: 0 0 6px currentColor; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
