import { useEffect } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { MoviePoster } from '../components/MoviePoster';
import { useMovies } from '../hooks/use-movies';

export default function MoviesPage() {
  const { data, isLoading, fetchNextPage, hasNextPage } = useMovies();
  const movies = data?.pages.flatMap((p) => p.items.map((i) => i.value));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (isLoading) return <Loading />;
  return (
    <Card className="p-2">
      {isLoading ? (
        <Loading />
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {movies?.map((movie) => (
              <MoviePoster key={movie.identifiers.tmdbId} movieId={movie.identifiers.tmdbId} rating={movie.rating} />
            ))}
          </div>
          {hasNextPage && <Button onClick={() => fetchNextPage()}>Load More</Button>}
        </div>
      )}
    </Card>
  );
}
