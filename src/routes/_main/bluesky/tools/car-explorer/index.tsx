import { createFileRoute } from '@tanstack/react-router';
import CARExplorerPage from '../../../../../pages/BlueskyTools/CARExplorer';

export const Route = createFileRoute('/_main/bluesky/tools/car-explorer/')({
  component: CARExplorerPage,
});
