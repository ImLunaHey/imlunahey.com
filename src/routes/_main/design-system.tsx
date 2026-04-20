import { createFileRoute } from '@tanstack/react-router';
import DesignSystemPage from '../../pages/DesignSystem';

export const Route = createFileRoute('/_main/design-system')({
  component: DesignSystemPage,
});
