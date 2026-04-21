import { createFileRoute } from '@tanstack/react-router';
import InfiniteCanvasPage from '../../../pages/labs/InfiniteCanvas';

export const Route = createFileRoute('/_main/labs/infinite-canvas')({
  component: InfiniteCanvasPage,
});
