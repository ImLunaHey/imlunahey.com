import { memo } from 'react';
import { useTheMovieDBImage } from '../hooks/use-themoviedb-image';
import { Poster } from './Poster';

export const ShowPoster = memo(function ShowPoster({
  showId,
  size = 'preview',
  rating,
}: {
  showId: string;
  size?: 'preview' | 'original';
  rating: number;
}) {
  const { data, error, isLoading } = useTheMovieDBImage('tv', showId);
  const poster = data?.posters?.sort((a, b) => b.vote_average - a.vote_average)[0];

  if (error) return <div>Error loading poster</div>;
  if (!poster) return null;

  return (
    <Poster
      link={`https://www.themoviedb.org/tv/${showId}`}
      imageUrl={`https://image.tmdb.org/t/p/${size === 'preview' ? 'w500' : 'original'}/${poster.file_path}`}
      rating={rating}
      height={poster.height}
      width={poster.width}
      loading={isLoading}
    />
  );
});
