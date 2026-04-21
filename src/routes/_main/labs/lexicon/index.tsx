import { createFileRoute } from '@tanstack/react-router';
import LexiconPage from '../../../../pages/labs/Lexicon';

export const Route = createFileRoute('/_main/labs/lexicon/')({
  component: LexiconPage,
});
