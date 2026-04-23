import { createFileRoute } from '@tanstack/react-router';
import FingerprintPage from '../../../pages/labs/Fingerprint';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/fingerprint')({
  component: FingerprintPage,
  head: () => pageMeta('lab/fingerprint'),
});
