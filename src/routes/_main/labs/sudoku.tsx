import { createFileRoute } from '@tanstack/react-router';
import SudokuPage from '../../../pages/labs/Sudoku';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/sudoku')({
  component: SudokuPage,
  head: () => pageMeta('lab/sudoku'),
});
