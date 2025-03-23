import { useQuery } from '@tanstack/react-query';

type TheMovieDBImageResponse = {
  backdrops: Array<{
    aspect_ratio: number;
    height: number;
    iso_639_1: string | null;
    file_path: string;
    vote_average: number;
    vote_count: number;
    width: number;
  }>;
  id: number;
  logos: Array<{
    aspect_ratio: number;
    height: number;
    iso_639_1: string | null;
    file_path: string;
    vote_average: number;
    vote_count: number;
    width: number;
  }>;
  posters: Array<{
    aspect_ratio: number;
    height: number;
    iso_639_1: string;
    file_path: string;
    vote_average: number;
    vote_count: number;
    width: number;
  }>;
};

export const useTheMovieDBImage = (mediaType: 'movie' | 'tv', mediaId: string) => {
  return useQuery({
    queryKey: ['themoviedb-image', mediaId, mediaType],
    queryFn: () =>
      fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/images?language=en&include_image_language=en,null`, {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMmMzYzZiZjgyZTA1OTY2MDZmMWNiN2NmOTE1YTNkNiIsIm5iZiI6MTQyMzA2MDUwMy4zNTM5OTk5LCJzdWIiOiI1NGQyMmUxN2MzYTM2ODc2MDAwMDI3YTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.FBMl7xmohHZDt3qLP3NgbYjElE1gaPRtNL_6Fx9NIQ8`,
        },
      }).then((res) => res.json() as Promise<TheMovieDBImageResponse>),
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
};
