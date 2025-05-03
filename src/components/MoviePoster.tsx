import { memo } from 'react';
import { useTheMovieDBImage } from '../hooks/use-themoviedb-image';
import { Poster } from './Poster';

export const MoviePoster = memo(function MoviePoster({
  movieId,
  size = 'preview',
  rating,
}: {
  movieId: string;
  size?: 'preview' | 'original';
  rating: number;
}) {
  const { data, error, isLoading } = useTheMovieDBImage('movie', movieId);
  const poster = data?.posters?.sort((a, b) => b.vote_average - a.vote_average)[0];

  if (error) return <div>Error loading poster</div>;
  if (!poster) return null;

  return (
    <Poster
      link={`https://www.themoviedb.org/movie/${movieId}`}
      imageUrl={`https://image.tmdb.org/t/p/${size === 'preview' ? 'w500' : 'original'}/${poster.file_path}`}
      rating={rating}
      height={poster.height}
      width={poster.width}
      loading={isLoading}
    />
  );
});
