import { createFileRoute } from '@tanstack/react-router';
import PalettePage from '../../../pages/labs/Palette';

export const Route = createFileRoute('/_main/labs/palette')({
  component: PalettePage,
});
