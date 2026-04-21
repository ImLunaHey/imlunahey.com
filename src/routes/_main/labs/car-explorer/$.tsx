import { createFileRoute } from '@tanstack/react-router';
import CarExplorerPage from '../../../../pages/labs/CarExplorer';

export const Route = createFileRoute('/_main/labs/car-explorer/$')({
  component: CarExplorerPage,
});
