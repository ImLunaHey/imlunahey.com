import { useEffect } from 'react';
import { Button } from '../components/Button';
import { Loading } from '../components/Loading';
import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { ShowPoster } from '../components/ShowPoster';
import { useShows } from '../hooks/use-shows';

export default function ShowsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage } = useShows();
  const shows = data?.pages.flatMap((p) => p.items.map((i) => i.value));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (isLoading) return <Loading />;
  return (
    <Page>
      <NavBar />
      <div>
        {isLoading ? (
          <Loading />
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {shows?.map((show) => (
                <ShowPoster key={show.identifiers.tmdbId} showId={show.identifiers.tmdbId} rating={show.rating} />
              ))}
            </div>
            {hasNextPage && <Button onClick={() => fetchNextPage()}>Load More</Button>}
          </div>
        )}
      </div>
    </Page>
  );
}
