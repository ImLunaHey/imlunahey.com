import { createFileRoute } from '@tanstack/react-router';
import CryptoDetailPage from '../../../../pages/labs/CryptoDetail';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/crypto/$id')({
  component: CryptoDetailPage,
  head: () => pageMeta('lab/crypto'),
});
