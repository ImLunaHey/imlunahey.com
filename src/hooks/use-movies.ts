import { simpleFetchHandler, XRPC } from '@atcute/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usePDSUrl } from './use-pds-url';

type ListItem = {
  cid: string;
  uri: `at://${string}/app.popsky.review/${string}`;
  value: {
    $type: 'app.popsky.review';
    rating: number;
    createdAt: string;
    identifiers: {
      tmdbId: string;
    };
    creativeWorkType: 'movie';
  };
};

type ListItemResponse = {
  cursor: string;
  records: ListItem[];
};

const getListItems = async (pdsUri: string, cursor: string | undefined) => {
  const rpc = new XRPC({ handler: simpleFetchHandler({ service: pdsUri }) });
  return await rpc
    .get('com.atproto.repo.listRecords', {
      params: {
        repo: 'did:plc:k6acu4chiwkixvdedcmdgmal',
        collection: 'app.popsky.review',
        limit: 100,
        cursor,
      },
    })
    .then((res) => res.data as ListItemResponse);
};

export const useMovies = () => {
  const { data: pdsUri } = usePDSUrl();
  return useInfiniteQuery<
    { cursor: string | undefined; items: ListItem[] },
    Error,
    { pages: { cursor: string | undefined; items: ListItem[] }[]; pageParams: string[] },
    string[],
    string | undefined
  >({
    queryKey: ['movies'],
    queryFn: async ({ pageParam }) => {
      if (!pdsUri) throw new Error('PDS URI not found');
      const response = await getListItems(pdsUri, pageParam);
      return {
        cursor: response.cursor,
        items: response.records.filter((r) => r.value.creativeWorkType === 'movie'),
      };
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined,
    enabled: !!pdsUri,
  });
};
