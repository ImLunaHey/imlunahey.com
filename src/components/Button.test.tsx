/// <reference types="@vitest/browser/providers/playwright" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../elements/Button';
import userEvent from '@testing-library/user-event';
import { page } from '@vitest/browser/context';

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

  it('should match the screenshot', async () => {
    render(<Button>Test</Button>);

    const screenshotPath = await page.screenshot({
      scale: 'device',
    });

    expect(screenshotPath).toMatchImageSnapshot({
      testName: 'Button',
      maxDiffPercentage: 0,
    });
  });
});
