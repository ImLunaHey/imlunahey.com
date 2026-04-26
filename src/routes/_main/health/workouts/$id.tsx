import { createFileRoute } from '@tanstack/react-router';
import HealthWorkoutDetailPage from '../../../../pages/HealthWorkoutDetail';
import { pageMeta } from '../../../../lib/og-meta';
import { getHealth } from '../../../../server/health';

export const Route = createFileRoute('/_main/health/workouts/$id')({
  loader: () => getHealth(),
  component: HealthWorkoutDetailPage,
  head: ({ params }) =>
    pageMeta('health', { path: `/health/workouts/${params.id}` }),
});
