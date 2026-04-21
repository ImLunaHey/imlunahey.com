import { createFileRoute } from '@tanstack/react-router';
import ProjectsPage from '../../../pages/Projects';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/projects/')({
  component: ProjectsPage,
  head: () => pageMeta('projects'),
});
