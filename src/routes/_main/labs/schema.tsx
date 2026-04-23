import { createFileRoute } from '@tanstack/react-router';
import SchemaPage from '../../../pages/labs/Schema';

export const Route = createFileRoute('/_main/labs/schema')({
  component: SchemaPage,
});
