import { createFileRoute } from '@tanstack/react-router';
import YearInReviewPage from '../../../../../pages/labs/YearInReview';

export const Route = createFileRoute('/_main/labs/year-in-review/$handle/$year')({
  component: YearInReviewPage,
});
