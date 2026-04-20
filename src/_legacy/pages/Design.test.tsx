import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, it } from 'vitest';
import DesignPage from './Design';
// import { page } from '@vitest/browser/context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
// import { fullViewport } from '../tests/utils/viewport';

describe('Design', () => {
  beforeEach(() => {
    const handlers = [
      http.all('https://api.themoviedb.org/3/movie/123/images', () => {
        return HttpResponse.text('{}');
      }),
      http.all('https://api.themoviedb.org/3/tv/123/images', () => {
        return HttpResponse.text('{}');
      }),
    ];
    const server = setupServer(...handlers);
    server.listen();
  });

  afterEach(cleanup);

  it('should render', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DesignPage />
      </QueryClientProvider>,
    );
  });

  it.skip('should match the screenshot', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DesignPage />
      </QueryClientProvider>,
    );

    // await fullViewport();

    // const screenshotPath = await page.screenshot({
    //   omitBackground: true,
    //   path: './__screenshots__/Design.test.tsx/Design-should-match-the-screenshot.png',
    // });

    // await expect(screenshotPath).toMatchScreenshot({
    //   maxDiffPercentage: 0,
    // });
  });
});
