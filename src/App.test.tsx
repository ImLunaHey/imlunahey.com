import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';
import { App } from './App';
// import { page } from '@vitest/browser/context';
// import { fullViewport } from './tests/utils/viewport';

describe('App', () => {
  afterEach(cleanup);

  it('should render', () => {
    render(<App />);
  });

  it.skip('should match the screenshot', async () => {
    render(<App />);

    // await fullViewport();

    // const screenshotPath = await page.screenshot({
    //   omitBackground: true,
    //   path: './__screenshots__/App.test.tsx/App-should-match-the-screenshot.png',
    // });

    // await expect(screenshotPath).toMatchScreenshot({
    //   maxDiffPercentage: 0,
    // });
  });
});
