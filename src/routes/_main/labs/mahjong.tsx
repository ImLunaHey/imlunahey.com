import { createFileRoute } from '@tanstack/react-router';
import MahjongPage from '../../../pages/labs/Mahjong';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/mahjong')({
  component: MahjongPage,
  head: () => pageMeta('lab/mahjong'),
});
