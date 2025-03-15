import { useViewCount } from '../hooks/use-view-count';
import { Loading } from './Loading';

export const ViewCount = ({ rkey }: { rkey: string }) => {
  const { data, isLoading } = useViewCount(rkey);

  if (isLoading) return <Loading />;

  return <div>{data?.views}</div>;
};
