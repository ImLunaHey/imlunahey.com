import { createFileRoute } from '@tanstack/react-router';
import TflTubeMapPage from '../../../pages/labs/TflTubeMap';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-tube-map')({
  component: TflTubeMapPage,
  head: () => pageMeta('lab/tfl-tube-map'),
});
