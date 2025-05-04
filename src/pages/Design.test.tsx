import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DesignPage from './Design';
import { page } from '@vitest/browser/context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fullViewport } from '../tests/utils/viewport';

describe('Design', () => {
  afterEach(cleanup);

  it('should render', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DesignPage />
      </QueryClientProvider>,
    );
  });

  it('should match the screenshot', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DesignPage />
      </QueryClientProvider>,
    );

    await fullViewport();

    const screenshotPath = await page.screenshot({
      omitBackground: true,
      path: './__screenshots__/Design.test.tsx/Design-should-match-the-screenshot.png',
    });

    await expect(screenshotPath).toMatchScreenshot({
      maxDiffPercentage: 0,
    });
  });
});
