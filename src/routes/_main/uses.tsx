import { createFileRoute } from '@tanstack/react-router';
import UsesPage from '../../pages/Uses';

export const Route = createFileRoute('/_main/uses')({
  component: UsesPage,
});
