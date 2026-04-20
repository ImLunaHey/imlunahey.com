import { createFileRoute } from '@tanstack/react-router';
import BlogEntryPage from '../../../pages/BlogEntry';

export const Route = createFileRoute('/_main/blog/$rkey')({
  component: BlogEntryPage,
});
