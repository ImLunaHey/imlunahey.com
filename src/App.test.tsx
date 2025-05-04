import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { page } from '@vitest/browser/context';

describe('App', () => {
  it('should render', () => {
    render(<App />);
  });

  it('should match the screenshot', async () => {
    render(<App />);

    const screenshotPath = await page.screenshot({
      scale: 'device',
    });

    await expect(screenshotPath).toMatchImageSnapshot({
      maxDiffPercentage: 0,
    });
  });
});
