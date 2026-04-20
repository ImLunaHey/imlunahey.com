import { createFileRoute } from '@tanstack/react-router';
import Layout from '../components/Layout';

export const Route = createFileRoute('/_main')({
  component: Layout,
});
