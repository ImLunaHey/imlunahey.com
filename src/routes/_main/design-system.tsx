import { createFileRoute } from '@tanstack/react-router';
import DesignSystemPage from '../../pages/DesignSystem';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/design-system')({
  component: DesignSystemPage,
  head: () => pageMeta('design-system'),
});
