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
  return useInfiniteQuery({
    queryKey: ['movies'],
    queryFn: async ({ pageParam }) => {
      if (!pdsUri) throw new Error('PDS URI not found');

      let response = await getListItems(pdsUri, pageParam);
      let filteredItems = response.records.filter((r) => r.value.creativeWorkType === 'movie');

      // Keep fetching until we get results or run out of pages
      while (filteredItems.length === 0 && response.cursor) {
        response = await getListItems(pdsUri, response.cursor);
        filteredItems = response.records.filter((r) => r.value.creativeWorkType === 'movie');
      }

      return {
        cursor: response.cursor,
        items: filteredItems,
      };
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!pdsUri,
  });
};
