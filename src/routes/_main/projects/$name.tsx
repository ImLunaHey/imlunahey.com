import { createFileRoute } from '@tanstack/react-router';
import ProjectDetailPage from '../../../pages/ProjectDetail';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/projects/$name')({
  component: ProjectDetailPage,
  head: ({ params }) => pageMeta('projects', { path: `/projects/${params.name}` }),
});
