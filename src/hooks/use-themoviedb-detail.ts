import { useQuery } from '@tanstack/react-query';

// Same v4 read-token already inlined in use-themoviedb-image.ts.
// Public-read scope, fine to reuse client-side.
const TMDB_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMmMzYzZiZjgyZTA1OTY2MDZmMWNiN2NmOTE1YTNkNiIsIm5iZiI6MTQyMzA2MDUwMy4zNTM5OTk5LCJzdWIiOiI1NGQyMmUxN2MzYTM2ODc2MDAwMDI3YTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.FBMl7xmohHZDt3qLP3NgbYjElE1gaPRtNL_6Fx9NIQ8';

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
};

export type CrewMember = {
  id: number;
  name: string;
  job: string;
};

export type TmdbDetail = {
  backdropPath: string | null;
  posterPath: string | null;
  tagline: string | null;
  cast: CastMember[];
  crew: CrewMember[];
};

type DetailsResp = {
  backdrop_path: string | null;
  poster_path: string | null;
  tagline?: string | null;
};

type CreditsResp = {
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
  }>;
  crew: Array<{ id: number; name: string; job: string }>;
};

async function fetchTmdb<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) throw new Error(`tmdb ${res.status}`);
  return (await res.json()) as T;
}

export function useTheMovieDBDetail(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
) {
  return useQuery<TmdbDetail | null>({
    queryKey: ['tmdb-detail', mediaType, tmdbId],
    enabled: tmdbId != null && mediaType != null,
    queryFn: async () => {
      if (!tmdbId || !mediaType) return null;
      const [details, credits] = await Promise.all([
        fetchTmdb<DetailsResp>(`/${mediaType}/${tmdbId}`),
        fetchTmdb<CreditsResp>(`/${mediaType}/${tmdbId}/credits`),
      ]);
      return {
        backdropPath: details.backdrop_path,
        posterPath: details.poster_path,
        tagline: details.tagline ?? null,
        cast: credits.cast.slice(0, 12).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profilePath: c.profile_path,
          order: c.order,
        })),
        crew: credits.crew,
      };
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
