import { createFileRoute } from '@tanstack/react-router';
import HealthWorkoutDetailPage from '../../../../pages/HealthWorkoutDetail';
import { pageMeta } from '../../../../lib/og-meta';
import { getHealthWorkout } from '../../../../server/health';

export const Route = createFileRoute('/_main/health/workouts/$id')({
  loader: ({ params }) => getHealthWorkout({ data: { id: params.id } }),
  component: HealthWorkoutDetailPage,
  head: ({ params }) =>
    pageMeta('health', { path: `/health/workouts/${params.id}` }),
});
