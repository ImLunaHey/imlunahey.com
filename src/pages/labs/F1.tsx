import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Ergast (via jolpica's mirror at api.jolpi.ca) — community F1 database
 * going back to the 1950 season. No key, permissive CORS.
 *
 * Original ergast.com shut down end of 2024 but jolpica maintains a
 * drop-in replacement at api.jolpi.ca/ergast/f1/.
 */

const API = 'https://api.jolpi.ca/ergast/f1';
const FIRST_SEASON = 1950;
const CURRENT_SEASON = new Date().getFullYear();

type DriverStanding = {
  position: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Array<{ constructorId: string; name: string }>;
};

type ConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  Constructor: ConstructorRec;
};

type Driver = {
  driverId: string;
  givenName: string;
  familyName: string;
  nationality: string;
  dateOfBirth?: string;
  permanentNumber?: string;
  code?: string;
  url?: string;
};

type ConstructorRec = { constructorId: string; name: string; nationality: string; url?: string };

type Race = {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitId: string; circuitName: string; Location: { locality: string; country: string } };
  Results?: RaceResult[];
};

type RaceResult = {
  position: string;
  points: string;
  Driver: Driver;
  Constructor: ConstructorRec;
  grid: string;
  laps: string;
  status: string;
  Time?: { millis?: string; time: string };
  FastestLap?: { rank: string; Time: { time: string } };
};

async function jsonOr<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

async function fetchDriverStandings(year: number): Promise<DriverStanding[]> {
  const j = await jsonOr<{ MRData?: { StandingsTable?: { StandingsLists?: Array<{ DriverStandings: DriverStanding[] }> } } }>(
    `${API}/${year}/driverstandings.json`,
    {},
  );
  return j.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

async function fetchConstructorStandings(year: number): Promise<ConstructorStanding[]> {
  const j = await jsonOr<{ MRData?: { StandingsTable?: { StandingsLists?: Array<{ ConstructorStandings: ConstructorStanding[] }> } } }>(
    `${API}/${year}/constructorstandings.json`,
    {},
  );
  return j.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}

async function fetchRaces(year: number): Promise<Race[]> {
  const j = await jsonOr<{ MRData?: { RaceTable?: { Races: Race[] } } }>(
    `${API}/${year}/races.json?limit=30`,
    {},
  );
  return j.MRData?.RaceTable?.Races ?? [];
}

async function fetchRaceResults(year: number, round: number): Promise<Race | null> {
  const j = await jsonOr<{ MRData?: { RaceTable?: { Races: Race[] } } }>(
    `${API}/${year}/${round}/results.json`,
    {},
  );
  return j.MRData?.RaceTable?.Races?.[0] ?? null;
}

async function fetchDriverSeasonResults(year: number, driverId: string): Promise<Race[]> {
  const j = await jsonOr<{ MRData?: { RaceTable?: { Races: Race[] } } }>(
    `${API}/${year}/drivers/${driverId}/results.json?limit=30`,
    {},
  );
  return j.MRData?.RaceTable?.Races ?? [];
}

async function fetchDriverCareer(driverId: string): Promise<{
  driver: Driver | null;
  totalWins: number;
  totalPodiums: number;
  totalPoles: number;
  championships: number;
  seasons: number;
}> {
  const [results, quals, standings] = await Promise.all([
    jsonOr<{ MRData?: { RaceTable?: { Races: Race[] }; total?: string } }>(`${API}/drivers/${driverId}/results/1.json`, {}),
    jsonOr<{ MRData?: { RaceTable?: { Races: Race[] }; total?: string } }>(`${API}/drivers/${driverId}/qualifying/1.json`, {}),
    jsonOr<{ MRData?: { StandingsTable?: { StandingsLists?: Array<{ DriverStandings: DriverStanding[] }> }; total?: string } }>(
      `${API}/drivers/${driverId}/driverstandings/1.json?limit=100`,
      {},
    ),
  ]);
  const podiumsResp = await jsonOr<{ MRData?: { total?: string } }>(
    `${API}/drivers/${driverId}/results/1,2,3.json?limit=1`,
    {},
  );
  const driver = results.MRData?.RaceTable?.Races?.[0]?.Results?.[0]?.Driver ?? null;
  // fetch the seasons count lightly
  const seasons = await jsonOr<{ MRData?: { total?: string } }>(`${API}/drivers/${driverId}/seasons.json?limit=1`, {});
  return {
    driver,
    totalWins: Number(results.MRData?.total ?? 0),
    totalPodiums: Number(podiumsResp.MRData?.total ?? 0),
    totalPoles: Number(quals.MRData?.total ?? 0),
    championships: standings.MRData?.StandingsTable?.StandingsLists?.length ?? 0,
    seasons: Number(seasons.MRData?.total ?? 0),
  };
}

async function fetchConstructorSeasonResults(year: number, constructorId: string): Promise<Race[]> {
  const j = await jsonOr<{ MRData?: { RaceTable?: { Races: Race[] } } }>(
    `${API}/${year}/constructors/${constructorId}/results.json?limit=60`,
    {},
  );
  return j.MRData?.RaceTable?.Races ?? [];
}

async function fetchConstructorCareer(constructorId: string): Promise<{
  totalWins: number;
  championships: number;
  seasons: number;
}> {
  const [wins, champs, seasons] = await Promise.all([
    jsonOr<{ MRData?: { total?: string } }>(`${API}/constructors/${constructorId}/results/1.json?limit=1`, {}),
    jsonOr<{ MRData?: { total?: string } }>(`${API}/constructors/${constructorId}/constructorstandings/1.json?limit=1`, {}),
    jsonOr<{ MRData?: { total?: string } }>(`${API}/constructors/${constructorId}/seasons.json?limit=1`, {}),
  ]);
  return {
    totalWins: Number(wins.MRData?.total ?? 0),
    championships: Number(champs.MRData?.total ?? 0),
    seasons: Number(seasons.MRData?.total ?? 0),
  };
}

type SelectedDetail =
  | { kind: 'race'; year: number; round: number }
  | { kind: 'driver'; driverId: string; year: number }
  | { kind: 'constructor'; constructorId: string; year: number }
  | null;

export default function F1Page() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { year?: number };
  const year = typeof search.year === 'number' && search.year >= FIRST_SEASON && search.year <= CURRENT_SEASON ? search.year : CURRENT_SEASON;
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [cons, setCons] = useState<ConstructorStanding[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [loadingYear, setLoadingYear] = useState(true);
  const [selected, setSelected] = useState<SelectedDetail>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingYear(true);
    Promise.all([
      fetchDriverStandings(year),
      fetchConstructorStandings(year),
      fetchRaces(year),
    ]).then(([d, c, r]) => {
      if (cancelled) return;
      setDrivers(d);
      setCons(c);
      setRaces(r);
      setLoadingYear(false);
    });
    return () => { cancelled = true; };
  }, [year]);

  const bumpYear = (delta: number) => {
    const next = Math.min(Math.max(FIRST_SEASON, year + delta), CURRENT_SEASON);
    navigate({ to: '/labs/f1' as never, search: { year: next !== CURRENT_SEASON ? next : undefined } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-f1">
        <header className="page-hd">
          <div className="label">~/labs/f1</div>
          <h1>f1<span className="dot">.</span></h1>
          <p className="sub">
            every formula 1 race from {FIRST_SEASON} to {CURRENT_SEASON}. driver + constructor standings, full race schedule,
            per-race results. click any row for career stats + season results. data from{' '}
            <code className="inline">api.jolpi.ca/ergast</code>, no key.
          </p>
        </header>

        <div className="year-nav">
          <button type="button" onClick={() => bumpYear(-1)} disabled={year <= FIRST_SEASON}>← {year - 1}</button>
          <div className="year-big">{year}</div>
          <button type="button" onClick={() => bumpYear(1)} disabled={year >= CURRENT_SEASON}>{year + 1} →</button>
        </div>

        {loadingYear ? <div className="loading">loading {year} season…</div> : null}

        {!loadingYear && drivers.length === 0 && cons.length === 0 && races.length === 0 ? (
          <div className="empty">no data for {year}. the season may not have started, or the archive has a gap.</div>
        ) : null}

        <div className="panels">
          <section className="panel">
            <h2 className="p-title">drivers</h2>
            {drivers.length === 0 ? <div className="p-empty">—</div> :
              <ol className="standings">
                {drivers.map((d) => (
                  <li key={d.Driver.driverId}>
                    <button type="button" className="st-row" onClick={() => setSelected({ kind: 'driver', driverId: d.Driver.driverId, year })}>
                      <span className="st-pos">{d.position}</span>
                      <span className="st-name">{d.Driver.givenName} {d.Driver.familyName}</span>
                      <span className="st-team">{d.Constructors[0]?.name}</span>
                      <span className="st-pts">{d.points}</span>
                    </button>
                  </li>
                ))}
              </ol>}
          </section>

          <section className="panel">
            <h2 className="p-title">constructors</h2>
            {cons.length === 0 ? <div className="p-empty">—</div> :
              <ol className="standings">
                {cons.map((c) => (
                  <li key={c.Constructor.constructorId}>
                    <button type="button" className="st-row" onClick={() => setSelected({ kind: 'constructor', constructorId: c.Constructor.constructorId, year })}>
                      <span className="st-pos">{c.position}</span>
                      <span className="st-name">{c.Constructor.name}</span>
                      <span className="st-team t-faint">{c.Constructor.nationality}</span>
                      <span className="st-pts">{c.points}</span>
                    </button>
                  </li>
                ))}
              </ol>}
          </section>
        </div>

        {races.length > 0 ? (
          <section className="panel wide">
            <h2 className="p-title">race schedule</h2>
            <ul className="races">
              {races.map((r) => (
                <li key={r.round}>
                  <button type="button" className="rc-row" onClick={() => setSelected({ kind: 'race', year: Number(r.season), round: Number(r.round) })}>
                    <span className="rc-num">r{r.round.padStart(2, '0')}</span>
                    <span className="rc-name">{r.raceName}</span>
                    <span className="rc-circuit">{r.Circuit.circuitName}, {r.Circuit.Location.locality}</span>
                    <span className="rc-date">{r.date}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {selected?.kind === 'race' ? <RaceModal year={selected.year} round={selected.round} onClose={() => setSelected(null)} /> : null}
        {selected?.kind === 'driver' ? <DriverModal driverId={selected.driverId} year={selected.year} onClose={() => setSelected(null)} onRace={(y, r) => setSelected({ kind: 'race', year: y, round: r })} /> : null}
        {selected?.kind === 'constructor' ? <ConstructorModal constructorId={selected.constructorId} year={selected.year} onClose={() => setSelected(null)} onRace={(y, r) => setSelected({ kind: 'race', year: y, round: r })} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.jolpi.ca/ergast</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function useEscToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

function RaceModal({ year, round, onClose }: { year: number; round: number; onClose: () => void }) {
  const [race, setRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchRaceResults(year, round).then((r) => { setRace(r); setLoading(false); });
  }, [year, round]);
  useEscToClose(onClose);

  return (
    <Modal onClose={onClose} title={race ? race.raceName : 'race'}>
      {loading || !race ? <div className="loading">loading…</div> : (
        <>
          <div className="m-hd">
            <div className="m-kind">round {race.round} · {race.season}</div>
            <h3 className="m-title">{race.raceName}</h3>
            <div className="m-sub">{race.Circuit.circuitName} — {race.Circuit.Location.locality}, {race.Circuit.Location.country}</div>
            <div className="m-sub t-faint">{race.date}{race.time ? ` · ${race.time}` : ''}</div>
          </div>
          {(race.Results ?? []).length === 0 ? <div className="empty">no results yet.</div> : (
            <table className="r-table">
              <thead>
                <tr>
                  <th>pos</th><th>driver</th><th>team</th><th>grid</th><th>laps</th><th>time / status</th><th>pts</th>
                </tr>
              </thead>
              <tbody>
                {(race.Results ?? []).map((res) => (
                  <tr key={res.Driver.driverId}>
                    <td className="t-accent">{res.position}</td>
                    <td>{res.Driver.givenName} {res.Driver.familyName}</td>
                    <td className="t-faint">{res.Constructor.name}</td>
                    <td>{res.grid}</td>
                    <td>{res.laps}</td>
                    <td>{res.Time?.time || res.status}</td>
                    <td>{res.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Modal>
  );
}

function DriverModal({ driverId, year, onClose, onRace }: { driverId: string; year: number; onClose: () => void; onRace: (y: number, r: number) => void }) {
  const [seasonResults, setSeasonResults] = useState<Race[]>([]);
  const [career, setCareer] = useState<Awaited<ReturnType<typeof fetchDriverCareer>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDriverSeasonResults(year, driverId), fetchDriverCareer(driverId)])
      .then(([res, car]) => { setSeasonResults(res); setCareer(car); setLoading(false); });
  }, [year, driverId]);
  useEscToClose(onClose);

  const driver = career?.driver ?? seasonResults[0]?.Results?.[0]?.Driver ?? null;

  return (
    <Modal onClose={onClose} title={driver ? `${driver.givenName} ${driver.familyName}` : 'driver'}>
      {loading ? <div className="loading">loading career…</div> : !driver ? <div className="empty">driver not found.</div> : (
        <>
          <div className="m-hd">
            <div className="m-kind">driver · {driver.nationality}{driver.permanentNumber ? ` · #${driver.permanentNumber}` : ''}</div>
            <h3 className="m-title">{driver.givenName} {driver.familyName}</h3>
            {driver.dateOfBirth ? <div className="m-sub">born {driver.dateOfBirth}</div> : null}
          </div>
          <section className="stat-strip">
            <div className="st"><span className="k">seasons</span><b>{career?.seasons ?? '—'}</b></div>
            <div className="st"><span className="k">wins</span><b>{career?.totalWins ?? '—'}</b></div>
            <div className="st"><span className="k">podiums</span><b>{career?.totalPodiums ?? '—'}</b></div>
            <div className="st"><span className="k">poles</span><b>{career?.totalPoles ?? '—'}</b></div>
            <div className="st"><span className="k">championships</span><b>{career?.championships ?? '—'}</b></div>
          </section>
          <h4 className="sub-hd">{year} results</h4>
          {seasonResults.length === 0 ? <div className="empty">no results for {year}.</div> : (
            <table className="r-table">
              <thead><tr><th>rd</th><th>race</th><th>grid</th><th>pos</th><th>pts</th></tr></thead>
              <tbody>
                {seasonResults.map((race) => {
                  const res = race.Results?.[0];
                  if (!res) return null;
                  return (
                    <tr key={race.round}>
                      <td className="t-accent">r{race.round.padStart(2, '0')}</td>
                      <td><button type="button" className="linkish" onClick={() => onRace(Number(race.season), Number(race.round))}>{race.raceName}</button></td>
                      <td>{res.grid}</td>
                      <td>{res.position}</td>
                      <td>{res.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </Modal>
  );
}

function ConstructorModal({ constructorId, year, onClose, onRace }: { constructorId: string; year: number; onClose: () => void; onRace: (y: number, r: number) => void }) {
  const [seasonResults, setSeasonResults] = useState<Race[]>([]);
  const [career, setCareer] = useState<Awaited<ReturnType<typeof fetchConstructorCareer>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchConstructorSeasonResults(year, constructorId), fetchConstructorCareer(constructorId)])
      .then(([res, car]) => { setSeasonResults(res); setCareer(car); setLoading(false); });
  }, [year, constructorId]);
  useEscToClose(onClose);

  const con = seasonResults[0]?.Results?.[0]?.Constructor ?? null;

  return (
    <Modal onClose={onClose} title={con?.name ?? 'constructor'}>
      {loading ? <div className="loading">loading career…</div> : !con ? <div className="empty">not found.</div> : (
        <>
          <div className="m-hd">
            <div className="m-kind">constructor · {con.nationality}</div>
            <h3 className="m-title">{con.name}</h3>
          </div>
          <section className="stat-strip">
            <div className="st"><span className="k">seasons</span><b>{career?.seasons ?? '—'}</b></div>
            <div className="st"><span className="k">total wins</span><b>{career?.totalWins ?? '—'}</b></div>
            <div className="st"><span className="k">championships</span><b>{career?.championships ?? '—'}</b></div>
          </section>
          <h4 className="sub-hd">{year} results</h4>
          {seasonResults.length === 0 ? <div className="empty">no results for {year}.</div> : (
            <table className="r-table">
              <thead><tr><th>rd</th><th>race</th><th>driver</th><th>grid</th><th>pos</th><th>pts</th></tr></thead>
              <tbody>
                {seasonResults.flatMap((race) => (race.Results ?? []).map((res) => (
                  <tr key={race.round + ':' + res.Driver.driverId}>
                    <td className="t-accent">r{race.round.padStart(2, '0')}</td>
                    <td><button type="button" className="linkish" onClick={() => onRace(Number(race.season), Number(race.round))}>{race.raceName}</button></td>
                    <td className="t-faint">{res.Driver.familyName}</td>
                    <td>{res.grid}</td>
                    <td>{res.position}</td>
                    <td>{res.points}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        {children}
      </div>
    </div>
  );
}

const CSS = `
  .shell-f1 { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .year-nav { margin-top: var(--sp-5); display: flex; align-items: center; gap: var(--sp-3); justify-content: center; }
  .year-nav button { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .year-nav button:hover:not([disabled]) { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .year-nav button[disabled] { opacity: 0.3; cursor: not-allowed; }
  .year-big { font-family: var(--font-display); font-size: 48px; font-weight: 500; letter-spacing: -0.02em; color: var(--color-accent); min-width: 140px; text-align: center; text-shadow: 0 0 16px var(--accent-glow); }

  .loading, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .panels { margin-top: var(--sp-4); display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); align-items: stretch; }
  @media (max-width: 720px) { .panels { grid-template-columns: 1fr; } }
  .panel { border: 1px solid var(--color-border); background: var(--color-bg-panel); display: flex; flex-direction: column; min-height: 0; }
  .panel.wide { margin-top: var(--sp-4); }
  .p-title { font-family: var(--font-display); font-size: var(--fs-md); color: var(--color-fg); padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--color-border); letter-spacing: -0.01em; flex: 0 0 auto; }
  .p-empty { padding: var(--sp-4) var(--sp-3); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .standings { list-style: none; max-height: 560px; overflow: auto; flex: 1 1 auto; }
  .standings li + li { border-top: 1px dashed var(--color-border); }
  .st-row { display: grid; grid-template-columns: 36px 1fr 1fr 60px; gap: var(--sp-2); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); width: 100%; background: transparent; border: 0; cursor: pointer; text-align: left; color: inherit; align-items: center; }
  .st-row:hover { background: var(--color-bg-raised); }
  .st-pos { color: var(--color-accent); font-variant-numeric: tabular-nums; }
  .st-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-team { color: var(--color-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-pts { color: var(--color-fg); text-align: right; font-variant-numeric: tabular-nums; }

  .races { list-style: none; }
  .races li + li { border-top: 1px dashed var(--color-border); }
  .rc-row { display: grid; grid-template-columns: 50px 1fr 1fr 100px; gap: var(--sp-3); align-items: center; padding: 8px var(--sp-3); background: transparent; border: 0; color: inherit; cursor: pointer; text-align: left; font-family: var(--font-mono); font-size: var(--fs-xs); width: 100%; }
  .rc-row:hover { background: var(--color-bg-raised); }
  @media (max-width: 720px) { .rc-row { grid-template-columns: 50px 1fr; grid-template-rows: auto auto; } .rc-circuit, .rc-date { grid-column: 2; } }
  .rc-num { color: var(--color-accent); }
  .rc-name { color: var(--color-fg); }
  .rc-circuit { color: var(--color-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-date { color: var(--color-fg-faint); font-variant-numeric: tabular-nums; text-align: right; }

  .modal { position: fixed; inset: 0; background: color-mix(in oklch, black 80%, transparent); z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); overflow: auto; }
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 1100px; width: 100%; max-height: 92vh; overflow: auto; position: relative; padding: var(--sp-4); }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }

  .m-hd { padding-bottom: var(--sp-3); border-bottom: 1px solid var(--color-border); margin-bottom: var(--sp-3); }
  .m-kind { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; margin-top: 4px; }
  .m-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); margin-top: 4px; }

  .stat-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: var(--sp-2); margin-bottom: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .st { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .st .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .st b { font-weight: 400; font-size: var(--fs-md); color: var(--color-accent); font-variant-numeric: tabular-nums; margin-top: 2px; }

  .sub-hd { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: var(--sp-2); }

  .r-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .r-table th { text-align: left; padding: 6px 8px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-weight: 400; border-bottom: 1px solid var(--color-border); }
  .r-table td { padding: 6px 8px; color: var(--color-fg); border-bottom: 1px dashed var(--color-border); }
  .r-table tr:hover td { background: var(--color-bg-raised); }
  .linkish { background: transparent; border: 0; color: var(--color-accent); cursor: pointer; font-family: inherit; font-size: inherit; padding: 0; text-align: left; }
  .linkish:hover { text-decoration: underline; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
