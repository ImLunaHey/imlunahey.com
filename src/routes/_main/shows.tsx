import { createFileRoute } from '@tanstack/react-router';
import ShowsPage from '../../pages/Shows';

export const Route = createFileRoute('/_main/shows')({
  component: ShowsPage,
});
