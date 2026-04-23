import { createFileRoute } from '@tanstack/react-router';
import CryptoPage from '../../../pages/labs/Crypto';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/crypto')({
  component: CryptoPage,
  head: () => pageMeta('lab/crypto'),
});
