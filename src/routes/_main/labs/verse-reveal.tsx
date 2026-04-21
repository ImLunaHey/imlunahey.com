import { createFileRoute } from '@tanstack/react-router';
import VerseRevealPage from '../../../pages/labs/VerseReveal';

export const Route = createFileRoute('/_main/labs/verse-reveal')({
  component: VerseRevealPage,
});
