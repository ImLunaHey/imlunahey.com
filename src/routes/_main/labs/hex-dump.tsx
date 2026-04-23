import { createFileRoute } from '@tanstack/react-router';
import HexDumpPage from '../../../pages/labs/HexDump';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/hex-dump')({
  component: HexDumpPage,
  head: () => pageMeta('lab/hex-dump'),
});
