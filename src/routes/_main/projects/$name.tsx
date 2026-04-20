import { createFileRoute } from '@tanstack/react-router';
import ProjectDetailPage from '../../../pages/ProjectDetail';
import { getAllRepos } from '../../../server/repos';
import { getReadme } from '../../../server/readme';
import { getRecentCommits } from '../../../server/commits';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/projects/$name')({
  component: ProjectDetailPage,
  loader: ({ params }) => {
    const repoDataPromise = getAllRepos();
    return {
      repoData: repoDataPromise,
      readme: (async () => {
        const d = await repoDataPromise;
        const repo = d.repos.find((r) => r.name === params.name);
        if (!repo) return null;
        return getReadme({ data: { owner: repo.owner, name: repo.name } });
      })(),
      commits: (async () => {
        const d = await repoDataPromise;
        const repo = d.repos.find((r) => r.name === params.name);
        if (!repo) return [];
        return getRecentCommits({ data: { owner: repo.owner, name: repo.name } });
      })(),
    };
  },
  staleTime: TTL.medium,
});
