import { expect } from 'vitest';
import { commands } from '@vitest/browser/context';
import { CompareOptions } from '../commands/screenshot';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    compareScreenshot: (
      screenshotPath: string,
      options: CompareOptions,
    ) => Promise<{
      matches: boolean;
      diffPercentage?: number;
      message: string;
    }>;
  }
}

expect.extend({
  async toMatchScreenshot(screenshotPath: string, options = {}) {
    // Get the current test name from Vitest's context
    const testPath = this.testPath?.split('/');
    const testName = testPath?.at(-1);

    // Handle different types of received values
    if (typeof screenshotPath !== 'string') {
      throw new Error('Expected a screenshot path string');
    }

    const result = await commands.compareScreenshot(screenshotPath, {
      testName,
      ...options,
    });

    return {
      pass: result.matches,
      message: () => result.message,
    };
  },
});
