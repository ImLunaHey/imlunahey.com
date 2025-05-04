import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { page } from '@vitest/browser/context';

describe('App', () => {
  afterEach(cleanup);

  it('should render', () => {
    render(<App />);
  });

  it('should match the screenshot', async () => {
    render(<App />);

    const screenshotPath = await page.screenshot({
      scale: 'device',
      path: './__screenshots__/App.test.tsx/App-should-match-the-screenshot.png',
    });

    await expect(screenshotPath).toMatchImageSnapshot({
      maxDiffPercentage: 0,
    });
  });
});
