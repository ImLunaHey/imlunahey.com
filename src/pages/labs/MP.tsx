import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPostcode, lookupPostcode } from '../../lib/postcodes';

const PARLIAMENT = 'https://members-api.parliament.uk';

type Member = {
  id: number;
  nameDisplayAs: string;
  nameFullTitle: string;
  gender: string | null;
  latestParty: {
    name: string;
    abbreviation: string;
    backgroundColour: string;
    foregroundColour: string;
  } | null;
  latestHouseMembership: {
    membershipFrom: string;        // constituency name
    house: number;                  // 1 = commons, 2 = lords
    membershipStartDate: string;
    membershipEndDate: string | null;
    membershipStatus: { statusDescription: string } | null;
  } | null;
};

type Division = {
  id: number;
  divisionNumber: number;
  title: string;
  date: string;
  numberInFavour: number;
  numberAgainst: number;
  inAffirmativeLobby: boolean;
  inNegativeLobby: boolean;
  actedAsTeller: boolean;
};

async function fetchMember(constituency: string): Promise<Member | null> {
  const r = await fetch(
    `${PARLIAMENT}/api/Members/Search?Location=${encodeURIComponent(constituency)}&House=1&IsCurrentMember=true`,
  );
  if (!r.ok) return null;
  const j = (await r.json()) as { items: Array<{ value: Member }> };
  return j.items[0]?.value ?? null;
}

async function fetchVotes(memberId: number): Promise<Division[]> {
  const r = await fetch(`${PARLIAMENT}/api/Members/${memberId}/Voting?house=1&page=1`);
  if (!r.ok) return [];
  const j = (await r.json()) as { items: Array<{ value: Division }> };
  return j.items.map((i) => i.value);
}

export default function MPPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? 'SW1A 1AA');

  const pcQuery = useQuery({
    queryKey: ['postcode', search.q],
    queryFn: () => lookupPostcode(search.q ?? ''),
    enabled: !!search.q,
    staleTime: Infinity,
    retry: false,
  });

  const memberQuery = useQuery({
    queryKey: ['mp', pcQuery.data?.parliamentary_constituency],
    queryFn: () => fetchMember(pcQuery.data!.parliamentary_constituency!),
    enabled: !!pcQuery.data?.parliamentary_constituency,
    staleTime: 60 * 60 * 1000,
  });

  const votesQuery = useQuery({
    queryKey: ['mp-votes', memberQuery.data?.id],
    queryFn: () => fetchVotes(memberQuery.data!.id),
    enabled: !!memberQuery.data,
    staleTime: 60 * 60 * 1000,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = formatPostcode(input.trim());
    if (!q) return;
    navigate({ to: '/labs/mp' as never, search: { q } as never });
  };

  const member = memberQuery.data;
  const votes = votesQuery.data ?? [];
  const ayes = votes.filter((v) => v.inAffirmativeLobby).length;
  const noes = votes.filter((v) => v.inNegativeLobby).length;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-mp">
        <header className="page-hd">
          <div className="label">~/labs/mp</div>
          <h1>mp<span className="dot">.</span></h1>
          <p className="sub">
            postcode → constituency → your mp, plus their 25 most recent house of commons divisions.
            vote titles are shown raw — we don&apos;t classify by topic, since that&apos;s a rabbit hole.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="postcode — e.g. SW1A 1AA"
            aria-label="uk postcode"
            spellCheck={false}
            autoComplete="postal-code"
          />
          <button type="submit">lookup →</button>
        </form>

        {pcQuery.isError || (!pcQuery.isLoading && search.q && !pcQuery.data) ? (
          <div className="err">no match for &quot;{search.q}&quot; — check the postcode.</div>
        ) : null}

        {pcQuery.data && !pcQuery.data.parliamentary_constituency ? (
          <div className="err">that postcode resolved but has no parliamentary constituency (perhaps crown dependency).</div>
        ) : null}

        {pcQuery.data?.parliamentary_constituency ? (
          <>
            <section className="const">
              <div>
                <div className="const-name">{pcQuery.data.parliamentary_constituency}</div>
                <div className="const-sub">{pcQuery.data.postcode} · {pcQuery.data.admin_district ?? '—'}</div>
              </div>
            </section>

            {memberQuery.isLoading ? <div className="loading">finding mp…</div> : null}
            {memberQuery.isError ? <div className="err">parliament api unreachable.</div> : null}

            {member ? (
              <section
                className="card"
                style={{ '--p-bg': `#${member.latestParty?.backgroundColour ?? '888'}`, '--p-fg': `#${member.latestParty?.foregroundColour ?? 'fff'}` } as React.CSSProperties}
              >
                <img
                  src={`${PARLIAMENT}/api/Members/${member.id}/Portrait?cropType=OneOne`}
                  alt={`official portrait of ${member.nameDisplayAs}`}
                  className="portrait"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                />
                <div className="card-body">
                  <div className="name">{member.nameDisplayAs}</div>
                  <div className="party" style={{ background: `var(--p-bg)`, color: `var(--p-fg)` }}>
                    {member.latestParty?.name ?? 'Independent'}
                  </div>
                  <div className="meta">
                    <div><span className="k">constituency</span><b>{member.latestHouseMembership?.membershipFrom ?? '—'}</b></div>
                    <div><span className="k">member since</span><b>{fmtDate(member.latestHouseMembership?.membershipStartDate)}</b></div>
                    <div><span className="k">status</span><b>{member.latestHouseMembership?.membershipStatus?.statusDescription ?? 'Active'}</b></div>
                  </div>
                </div>
              </section>
            ) : null}

            {votes.length > 0 ? (
              <section className="votes">
                <div className="votes-hd">
                  <span>last {votes.length} commons divisions</span>
                  <span className="vr">
                    <span className="aye">{ayes} aye</span>
                    <span className="no">{noes} no</span>
                  </span>
                </div>
                <ul className="vote-list">
                  {votes.map((v) => {
                    const tone = v.inAffirmativeLobby ? 'aye' : v.inNegativeLobby ? 'no' : 'abs';
                    const label = v.inAffirmativeLobby ? 'AYE' : v.inNegativeLobby ? 'NO' : '—';
                    return (
                      <li key={v.id} className="vote">
                        <span className={`tag tag-${tone}`}>{label}</span>
                        <a
                          href={`https://votes.parliament.uk/Votes/Commons/Division/${v.id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="vote-title"
                        >{v.title.trim()}</a>
                        <span className="vote-sub">
                          {fmtDate(v.date)} · {v.numberInFavour} – {v.numberAgainst}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">members-api.parliament.uk · postcodes.io</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

const CSS = `
  .shell-mp { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; letter-spacing: 0.08em; text-transform: uppercase; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }

  .const { margin-top: var(--sp-4); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .const-name { font-family: var(--font-display); font-size: 28px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1.1; }
  .const-sub { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }

  .card { margin-top: var(--sp-4); display: grid; grid-template-columns: 140px 1fr; gap: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); border-left: 4px solid var(--p-bg); }
  @media (max-width: 600px) { .card { grid-template-columns: 1fr; } }
  .portrait { width: 140px; height: 140px; object-fit: cover; border: 1px solid var(--color-border); background: var(--color-bg-raised); }
  .card-body { display: flex; flex-direction: column; gap: 8px; }
  .name { font-family: var(--font-display); font-size: 32px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1.1; }
  .party { align-self: flex-start; padding: 3px 10px; font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--sp-3); margin-top: 4px; }
  .meta > div { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .meta .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .meta b { color: var(--color-fg); font-weight: 400; font-size: var(--fs-sm); }

  .votes { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .votes-hd { display: flex; justify-content: space-between; padding: 10px var(--sp-4); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .vr { display: flex; gap: var(--sp-3); }
  .vr .aye { color: var(--color-accent); }
  .vr .no { color: var(--color-alert); }

  .vote-list { list-style: none; }
  .vote { display: grid; grid-template-columns: 50px 1fr auto; gap: var(--sp-3); align-items: center; padding: 8px var(--sp-4); border-bottom: 1px dashed var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .vote:last-child { border-bottom: 0; }
  .tag { padding: 1px 6px; text-align: center; font-size: 10px; letter-spacing: 0.08em; border: 1px solid; }
  .tag-aye { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .tag-no { color: var(--color-alert); border-color: var(--color-alert); }
  .tag-abs { color: var(--color-fg-faint); border-color: var(--color-border); }
  .vote-title { color: var(--color-fg); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vote-title:hover { color: var(--color-accent); text-decoration: none; }
  .vote-sub { color: var(--color-fg-faint); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
