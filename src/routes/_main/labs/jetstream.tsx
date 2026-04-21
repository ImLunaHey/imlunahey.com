import { createFileRoute } from '@tanstack/react-router';
import JetstreamPage from '../../../pages/labs/Jetstream';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/jetstream')({
  component: JetstreamPage,
  head: () => pageMeta('lab/jetstream'),
});
