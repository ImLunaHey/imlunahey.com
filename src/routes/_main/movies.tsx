import { createFileRoute } from '@tanstack/react-router';
import MoviesPage from '../../pages/Movies';

export const Route = createFileRoute('/_main/movies')({
  component: MoviesPage,
});
