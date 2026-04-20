import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // mark the data as stale after 5 minutes
      staleTime: 1_000 * 60 * 5,
    },
  },
});

const persister =
  typeof window === 'undefined'
    ? null
    : createSyncStoragePersister({
        storage: window.localStorage,
        throttleTime: 1_000,
        key: 'cache',
      });

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  if (isLocalhost || !persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1_000 * 60 * 60 * 24,
      }}
      onSuccess={() => {
        console.log('Cache successfully restored!');
        queryClient.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
