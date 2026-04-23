import { createFileRoute } from '@tanstack/react-router';
import ColourPage from '../../../pages/labs/Colour';

export const Route = createFileRoute('/_main/labs/colour')({
  component: ColourPage,
});
