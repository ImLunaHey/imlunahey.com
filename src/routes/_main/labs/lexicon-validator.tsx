import { createFileRoute } from '@tanstack/react-router';
import LexiconValidatorPage from '../../../pages/labs/LexiconValidator';

export const Route = createFileRoute('/_main/labs/lexicon-validator')({
  component: LexiconValidatorPage,
});
