import { createFileRoute } from '@tanstack/react-router';
import ListCleanerPage from '../../../pages/labs/ListCleaner';

export const Route = createFileRoute('/_main/labs/list-cleaner')({
  component: ListCleanerPage,
});
