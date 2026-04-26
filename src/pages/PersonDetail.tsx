import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import LIBRARY from '../data/library.json';
import { useTheMovieDBPerson, type PersonCredit } from '../hooks/use-themoviedb-person';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

function imgUrl(path: string | null, size: string): string | null {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

const route = getRouteApi('/_main/library/person/$personId');

/** A filmography credit annotated with the user's library + watch state. */
type AnnotatedCredit = PersonCredit & {
  /** Library row imdbId of the (first) shelf entry that matches this
   *  credit. null if not owned. */
  ownedImdbId: string | null;
  isSeen: boolean;
};

export default function PersonDetailPage() {
  const { personId: personIdParam } = route.useParams();
  const { reviewedIds } = route.useLoaderData();
  const personId = Number(personIdParam);

  const { data: person, isLoading } = useTheMovieDBPerson(
    Number.isFinite(personId) ? personId : null,
  );

  // Lookup tables for "is this credit in my library / have i seen it?"
  // — keyed by tmdbId (movie or tv id from credits).
  const lookups = useMemo(() => {
    const ownedByTmdb = new Map<string, string>();
    for (const it of LIBRARY) {
      if (it.tmdbId != null) {
        // first-wins is fine — same tmdb id across multiple shelf rows
        // means same title, just different formats.
        const key = `${it.mediaType ?? 'movie'}:${it.tmdbId}`;
        if (!ownedByTmdb.has(key)) ownedByTmdb.set(key, it.imdbId);
      }
    }
    const seenImdb = new Set(reviewedIds.imdbIds);
    const seenTmdb = new Set(reviewedIds.tmdbIds);
    return { ownedByTmdb, seenImdb, seenTmdb };
  }, [reviewedIds]);

  function annotate(credit: PersonCredit): AnnotatedCredit {
    const key = `${credit.mediaType}:${credit.id}`;
    const ownedImdbId = lookups.ownedByTmdb.get(key) ?? null;
    const isSeen =
      lookups.seenTmdb.has(String(credit.id)) ||
      (ownedImdbId != null && lookups.seenImdb.has(ownedImdbId));
    return { ...credit, ownedImdbId, isSeen };
  }

  if (isLoading) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-person">
          <div className="loading t-faint">loading person from tmdb…</div>
        </main>
      </>
    );
  }

  if (!person) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-person">
          <div className="not-found">
            <p className="t-faint">no tmdb person for id {personIdParam}</p>
            <Link to="/library" className="t-accent">
              ← back to library
            </Link>
          </div>
        </main>
      </>
    );
  }

  const profile = imgUrl(person.profilePath, 'w300');
  // Cast credits + crew credits, each annotated then bucketed for
  // display. Within each bucket sort by year desc, then by vote_count
  // (popularity) so the well-known stuff floats up over obscurities.
  const annotatedCast = person.cast.map(annotate);
  const annotatedCrew = person.crew.map(annotate);

  // crew bucketed by department so a 'directed by, written by, edited
  // by' table reads naturally instead of one massive list.
  const crewByDept = new Map<string, AnnotatedCredit[]>();
  for (const c of annotatedCrew) {
    const dept = c.department ?? 'other';
    const list = crewByDept.get(dept) ?? [];
    list.push(c);
    crewByDept.set(dept, list);
  }

  // Stable order: directing → writing → producing → other
  const DEPT_ORDER = ['Directing', 'Writing', 'Production', 'Editing', 'Camera', 'Sound', 'Art', 'Visual Effects'];
  const sortedDepts = [...crewByDept.keys()].sort((a, b) => {
    const ai = DEPT_ORDER.indexOf(a);
    const bi = DEPT_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const ownedCount =
    annotatedCast.filter((c) => c.ownedImdbId).length +
    annotatedCrew.filter((c) => c.ownedImdbId).length;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-person">
        <div className="lead">
          <div className="lead-photo">
            {profile ? (
              <img src={profile} alt={person.name} />
            ) : (
              <div className="photo-fallback">{person.name.slice(0, 2)}</div>
            )}
          </div>
          <div className="lead-meta">
            <Link to="/library" className="back-link">
              ← /library
            </Link>
            <h1>{person.name}</h1>
            <div className="facts">
              {person.knownForDepartment ? (
                <span>{person.knownForDepartment.toLowerCase()}</span>
              ) : null}
              {person.birthday ? (
                <>
                  <span className="dot">·</span>
                  <span>
                    born <b className="t-fg">{person.birthday}</b>
                  </span>
                </>
              ) : null}
              {person.deathday ? (
                <>
                  <span className="dot">·</span>
                  <span>
                    died <b className="t-fg">{person.deathday}</b>
                  </span>
                </>
              ) : null}
              {person.placeOfBirth ? (
                <>
                  <span className="dot">·</span>
                  <span>{person.placeOfBirth}</span>
                </>
              ) : null}
              <span className="dot">·</span>
              <span>
                <b className="t-accent">{ownedCount}</b> on your shelf
              </span>
            </div>
            {person.biography ? <Bio text={person.biography} /> : null}
          </div>
        </div>

        {annotatedCast.length > 0 ? (
          <CreditsSection
            label="acting"
            credits={annotatedCast}
            roleField="character"
          />
        ) : null}

        {sortedDepts.map((dept) => (
          <CreditsSection
            key={dept}
            label={dept.toLowerCase()}
            credits={crewByDept.get(dept)!}
            roleField="job"
          />
        ))}

        <footer className="person-footer">
          <span>
            src:{' '}
            <span className="t-accent">
              tmdb · person {person.id}
              {person.imdbId ? ` · imdb ${person.imdbId}` : ''}
            </span>
          </span>
          <span>
            ←{' '}
            <Link to="/library" className="t-accent">
              library
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

/** Long bios get a "show more" truncation — TMDB bios can be many
 *  paragraphs and bury the filmography below the fold. */
function Bio({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  // ~60 words is a comfortable summary length; expanding shows the full thing.
  const cutoff = 380;
  const isLong = text.length > cutoff;
  const shown = open || !isLong ? text : text.slice(0, cutoff).replace(/\s+\S*$/, '') + '…';
  return (
    <p className="bio">
      {shown}
      {isLong ? (
        <button type="button" className="bio-more" onClick={() => setOpen((o) => !o)}>
          {open ? '— less' : ' more'}
        </button>
      ) : null}
    </p>
  );
}

function CreditsSection({
  label,
  credits,
  roleField,
}: {
  label: string;
  credits: AnnotatedCredit[];
  roleField: 'character' | 'job';
}) {
  // Sort: shelf-owned first (most relevant to the visitor), then
  // by year desc, then by vote_count desc as tiebreaker. Filters
  // out empty roles upstream for cleanliness.
  const sorted = [...credits].sort((a, b) => {
    if ((a.ownedImdbId ? 1 : 0) !== (b.ownedImdbId ? 1 : 0)) {
      return (b.ownedImdbId ? 1 : 0) - (a.ownedImdbId ? 1 : 0);
    }
    if ((a.releaseYear ?? 0) !== (b.releaseYear ?? 0)) {
      return (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
    }
    return b.voteCount - a.voteCount;
  });

  const ownedCount = sorted.filter((c) => c.ownedImdbId).length;

  return (
    <section className="section">
      <div className="section-hd-row">
        <h2 className="section-hd">
          <span className="num">{label.slice(0, 3)} //</span>
          {label}.
        </h2>
        <span className="t-faint">
          {sorted.length} credit{sorted.length === 1 ? '' : 's'}
          {ownedCount > 0 ? ` · ${ownedCount} on shelf` : ''}
        </span>
      </div>
      <ul className="credits">
        {sorted.map((c, i) => (
          <CreditRow key={`${c.mediaType}-${c.id}-${i}`} credit={c} roleField={roleField} />
        ))}
      </ul>
    </section>
  );
}

function CreditRow({
  credit,
  roleField,
}: {
  credit: AnnotatedCredit;
  roleField: 'character' | 'job';
}) {
  const role = roleField === 'character' ? credit.character : credit.job;
  const poster = imgUrl(credit.posterPath, 'w92');
  const className =
    'credit' +
    (credit.ownedImdbId ? ' credit-owned' : '') +
    (credit.isSeen ? ' credit-seen' : '');

  // owned items link back to /library/$imdbId; non-owned items stay
  // as plain rows since we don't have a non-library "movie page" yet.
  const inner = (
    <>
      <div className="credit-poster">
        {poster ? (
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <div className="credit-poster-fallback" />
        )}
      </div>
      <div className="credit-body">
        <div className="credit-title">{credit.title}</div>
        <div className="credit-meta t-faint">
          {credit.releaseYear ? <span>{credit.releaseYear}</span> : null}
          {role ? (
            <>
              {credit.releaseYear ? <span className="dot">·</span> : null}
              <span>{role.toLowerCase()}</span>
            </>
          ) : null}
          {credit.mediaType === 'tv' ? (
            <>
              <span className="dot">·</span>
              <span className="t-accent">tv</span>
            </>
          ) : null}
        </div>
      </div>
    </>
  );

  if (credit.ownedImdbId) {
    return (
      <li className={className}>
        <Link
          to="/library/$imdbId"
          params={{ imdbId: credit.ownedImdbId }}
          className="credit-link"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return <li className={className}>{inner}</li>;
}

const CSS = `
  .shell-person { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .loading, .not-found {
    padding: 120px 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .not-found .t-accent { display: inline-block; margin-top: var(--sp-3); }

  .lead {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--sp-6);
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .lead-photo {
    aspect-ratio: 2 / 3;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .lead-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-fg-faint);
    font-family: var(--font-display); font-size: 48px;
    text-transform: lowercase;
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
    font-size: clamp(36px, 5vw, 64px);
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
  .facts b.t-accent { color: var(--color-accent); }
  .facts .dot { color: var(--color-fg-ghost); }

  .bio {
    color: var(--color-fg-dim);
    line-height: 1.55;
    margin-top: var(--sp-2);
  }
  .bio-more {
    background: transparent; border: none; padding: 0; margin: 0;
    color: var(--color-accent);
    font: inherit;
    cursor: pointer;
  }
  .bio-more:hover { text-decoration: underline; }

  .section {
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .section-hd-row {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-4);
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

  /* credits list */
  .credits {
    list-style: none; padding: 0; margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 4px var(--sp-3);
  }
  .credit {
    display: block;
    padding: 6px 8px;
    border: 1px solid transparent;
  }
  .credit-link {
    display: flex; align-items: center; gap: var(--sp-3);
    text-decoration: none; color: inherit;
  }
  .credit-owned {
    background: var(--color-bg-panel);
    border-color: var(--color-border);
  }
  .credit-owned:hover {
    border-color: var(--color-accent-dim);
  }
  .credit-owned:hover .credit-title { color: var(--color-accent); }
  .credit-seen .credit-poster {
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .credit:not(.credit-link) {
    display: flex; align-items: center; gap: var(--sp-3);
  }

  .credit-poster {
    width: 32px; height: 48px;
    flex-shrink: 0;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .credit-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .credit-poster-fallback { width: 100%; height: 100%; }
  .credit-body { min-width: 0; flex: 1; }
  .credit-title {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .credit-meta {
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    margin-top: 2px;
  }
  .credit-meta .dot { color: var(--color-fg-ghost); }
  .credit-meta .t-accent { color: var(--color-accent); }

  .person-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .lead { grid-template-columns: 1fr; }
    .lead-photo { max-width: 220px; }
    .credits { grid-template-columns: 1fr; }
    .person-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
