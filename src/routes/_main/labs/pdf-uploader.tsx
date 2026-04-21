import { createFileRoute } from '@tanstack/react-router';
import PdfUploaderPage from '../../../pages/labs/PdfUploader';

export const Route = createFileRoute('/_main/labs/pdf-uploader')({
  component: PdfUploaderPage,
});
