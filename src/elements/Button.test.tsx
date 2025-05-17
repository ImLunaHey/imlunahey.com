import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';
import userEvent from '@testing-library/user-event';
// import { page } from '@vitest/browser/context';
// import { fullViewport } from '../tests/utils/viewport';

describe('Button', () => {
  afterEach(cleanup);

  it('should render', () => {
    render(<Button>Test</Button>);
  });

  it('should call the onClick when the button is clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Test</Button>);

    const button = screen.getByText('Test');
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalled();
  });

  it('should not call the onClick when the button is disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Test
      </Button>,
    );

    const button = screen.getByText('Test');
    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it.skip('should match the screenshot', async () => {
    render(<Button>Test</Button>);

    // await fullViewport();

    // const screenshotPath = await page.screenshot({
    //   omitBackground: true,
    //   path: './__screenshots__/Button.test.tsx/Button-should-match-the-screenshot.png',
    // });

    // await expect(screenshotPath).toMatchScreenshot({
    //   maxDiffPercentage: 0,
    // });
  });
});
