import { createFileRoute } from '@tanstack/react-router';
import InfiniteCanvasPage from '../../pages/InfiniteCanvas';

export const Route = createFileRoute('/_main/infinite-canvas')({
  component: InfiniteCanvasPage,
});
