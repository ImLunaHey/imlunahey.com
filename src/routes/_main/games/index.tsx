import { createFileRoute } from '@tanstack/react-router';
import GamesPage from '../../../pages/Games';

export const Route = createFileRoute('/_main/games/')({
  component: GamesPage,
});
