import { createFileRoute } from '@tanstack/react-router';
import ProjectsPage from '../../../pages/Projects';
import { getAllRepos } from '../../../server/repos';

const STALE_MS = 1000 * 60 * 30;

export const Route = createFileRoute('/_main/projects/')({
  component: ProjectsPage,
  loader: () => getAllRepos(),
  staleTime: STALE_MS,
});
