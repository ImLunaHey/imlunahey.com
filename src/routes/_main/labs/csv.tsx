import { createFileRoute } from '@tanstack/react-router';
import CsvPage from '../../../pages/labs/Csv';

export const Route = createFileRoute('/_main/labs/csv')({
  component: CsvPage,
});
