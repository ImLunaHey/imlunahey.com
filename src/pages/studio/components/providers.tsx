'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type ProvidersProps = {
  children: React.ReactNode;
};

export const queryClient = new QueryClient();

export const Providers = ({ children }: ProvidersProps) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
