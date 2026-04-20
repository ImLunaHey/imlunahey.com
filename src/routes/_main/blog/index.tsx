import { createFileRoute } from '@tanstack/react-router';
import BlogPage from '../../../pages/Blog';

export const Route = createFileRoute('/_main/blog/')({
  component: BlogPage,
});
