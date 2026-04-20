import { createFileRoute } from '@tanstack/react-router';
import StudioPage from '../pages/Studio';

export const Route = createFileRoute('/studio')({
  component: StudioPage,
});
