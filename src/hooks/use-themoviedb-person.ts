import { useQuery } from '@tanstack/react-query';

// Same v4 read-token already inlined in use-themoviedb-image.ts and
// use-themoviedb-detail.ts. Public-read scope.
const TMDB_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMmMzYzZiZjgyZTA1OTY2MDZmMWNiN2NmOTE1YTNkNiIsIm5iZiI6MTQyMzA2MDUwMy4zNTM5OTk5LCJzdWIiOiI1NGQyMmUxN2MzYTM2ODc2MDAwMDI3YTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.FBMl7xmohHZDt3qLP3NgbYjElE1gaPRtNL_6Fx9NIQ8';

export type PersonCredit = {
  id: number;
  imdbId?: string;
  title: string;
  /** 'movie' or 'tv' — matches TMDB media_type values */
  mediaType: 'movie' | 'tv';
  /** for crew: 'Director', 'Writer', etc. for cast: undefined */
  job?: string;
  /** for cast: character name. for crew: undefined */
  character?: string;
  /** Department for crew — 'Directing', 'Writing', 'Camera', etc.
   *  undefined for cast. Used to bucket the filmography. */
  department?: string;
  releaseYear: number | null;
  posterPath: string | null;
  voteCount: number;
};

export type PersonDetail = {
  id: number;
  name: string;
  knownForDepartment: string | null;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  imdbId: string | null;
  homepage: string | null;
  /** combined_credits.cast — roles where this person was an actor */
  cast: PersonCredit[];
  /** combined_credits.crew — directing / writing / etc. */
  crew: PersonCredit[];
};

type PersonResp = {
  id: number;
  name: string;
  known_for_department?: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  imdb_id?: string | null;
  homepage?: string | null;
};

type CombinedCreditsResp = {
  cast: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type: 'movie' | 'tv';
    character?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    vote_count?: number;
  }>;
  crew: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type: 'movie' | 'tv';
    job?: string;
    department?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    vote_count?: number;
  }>;
};

async function fetchTmdb<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) throw new Error(`tmdb ${res.status}`);
  return (await res.json()) as T;
}

function yearOf(d: string | undefined): number | null {
  if (!d || d.length < 4) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function useTheMovieDBPerson(personId: number | null) {
  return useQuery<PersonDetail | null>({
    queryKey: ['tmdb-person', personId],
    enabled: personId != null,
    queryFn: async () => {
      if (!personId) return null;
      const [person, credits] = await Promise.all([
        fetchTmdb<PersonResp>(`/person/${personId}?append_to_response=external_ids`),
        fetchTmdb<CombinedCreditsResp>(`/person/${personId}/combined_credits`),
      ]);
      const cast: PersonCredit[] = credits.cast.map((c) => ({
        id: c.id,
        title: c.title ?? c.name ?? '',
        mediaType: c.media_type,
        character: c.character,
        releaseYear: yearOf(c.release_date ?? c.first_air_date),
        posterPath: c.poster_path ?? null,
        voteCount: c.vote_count ?? 0,
      }));
      const crew: PersonCredit[] = credits.crew.map((c) => ({
        id: c.id,
        title: c.title ?? c.name ?? '',
        mediaType: c.media_type,
        job: c.job,
        department: c.department,
        releaseYear: yearOf(c.release_date ?? c.first_air_date),
        posterPath: c.poster_path ?? null,
        voteCount: c.vote_count ?? 0,
      }));
      return {
        id: person.id,
        name: person.name,
        knownForDepartment: person.known_for_department ?? null,
        biography: person.biography ?? null,
        birthday: person.birthday ?? null,
        deathday: person.deathday ?? null,
        placeOfBirth: person.place_of_birth ?? null,
        profilePath: person.profile_path ?? null,
        imdbId: person.imdb_id ?? null,
        homepage: person.homepage ?? null,
        cast,
        crew,
      };
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
