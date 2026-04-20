import { createFileRoute } from '@tanstack/react-router';
import ShowcasePage from '../../pages/Showcase';

export const Route = createFileRoute('/_main/showcase')({
  component: ShowcasePage,
});
