import { createFileRoute } from '@tanstack/react-router';
import ScreenshotMakerPage from '../../../pages/labs/ScreenshotMaker';

export const Route = createFileRoute('/_main/labs/screenshot-maker')({
  component: ScreenshotMakerPage,
});
