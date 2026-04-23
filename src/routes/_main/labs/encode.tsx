import { createFileRoute } from '@tanstack/react-router';
import EncodePage from '../../../pages/labs/Encode';

export const Route = createFileRoute('/_main/labs/encode')({
  component: EncodePage,
});
