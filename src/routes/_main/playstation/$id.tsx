import { createFileRoute } from '@tanstack/react-router';
import PlaystationDetailPage from '../../../pages/PlaystationDetail';
import { pageMeta } from '../../../lib/og-meta';
import { getPlaystationGameDetail } from '../../../server/playstation';

export const Route = createFileRoute('/_main/playstation/$id')({
  loader: ({ params }) => getPlaystationGameDetail({ data: { id: params.id } }),
  component: PlaystationDetailPage,
  head: ({ params }) =>
    pageMeta('playstation', { path: `/playstation/${params.id}` }),
});
