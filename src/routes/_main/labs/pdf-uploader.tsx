import { createFileRoute } from '@tanstack/react-router';
import PdfUploaderPage from '../../../pages/labs/PdfUploader';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/pdf-uploader')({
  component: PdfUploaderPage,
  head: () => pageMeta('lab/pdf-uploader'),
});
