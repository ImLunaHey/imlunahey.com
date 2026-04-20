import { createFileRoute } from '@tanstack/react-router';
import ProjectsPage from '../../pages/Projects';

export const Route = createFileRoute('/_main/projects')({
  component: ProjectsPage,
});
