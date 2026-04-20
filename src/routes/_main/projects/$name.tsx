import { createFileRoute } from '@tanstack/react-router';
import ProjectDetailPage from '../../../pages/ProjectDetail';
import { getAllRepos } from '../../../server/repos';
import { getReadme } from '../../../server/readme';
import { getRecentCommits } from '../../../server/commits';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/projects/$name')({
  component: ProjectDetailPage,
  loader: async ({ params }) => {
    const repoData = await getAllRepos();
    const repo = repoData.repos.find((r) => r.name === params.name);
    if (!repo) {
      return { ...repoData, readme: Promise.resolve(null), commits: Promise.resolve([]) };
    }
    return {
      ...repoData,
      readme: getReadme({ data: { owner: repo.owner, name: repo.name } }),
      commits: getRecentCommits({ data: { owner: repo.owner, name: repo.name } }),
    };
  },
  staleTime: TTL.medium,
});
