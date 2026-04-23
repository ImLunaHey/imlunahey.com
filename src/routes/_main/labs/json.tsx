import { createFileRoute } from '@tanstack/react-router';
import JsonPage from '../../../pages/labs/Json';

export const Route = createFileRoute('/_main/labs/json')({
  component: JsonPage,
});
