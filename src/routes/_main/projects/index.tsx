import { createFileRoute } from '@tanstack/react-router';
import ProjectsPage from '../../../pages/Projects';
import { getAllRepos } from '../../../server/repos';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/projects/')({
  component: ProjectsPage,
  loader: () => ({ repoData: getAllRepos() }),
  staleTime: TTL.medium,
});
