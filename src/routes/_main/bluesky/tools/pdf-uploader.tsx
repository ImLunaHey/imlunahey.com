import { createFileRoute } from '@tanstack/react-router';
import PDFUploaderPage from '../../../../pages/BlueskyTools/PDFUploader';

export const Route = createFileRoute('/_main/bluesky/tools/pdf-uploader')({
  component: PDFUploaderPage,
});
