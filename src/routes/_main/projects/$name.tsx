import { createFileRoute } from '@tanstack/react-router';
import ProjectDetailPage from '../../../pages/ProjectDetail';

export const Route = createFileRoute('/_main/projects/$name')({
  component: ProjectDetailPage,
});
