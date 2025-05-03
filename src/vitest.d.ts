/* eslint-disable @typescript-eslint/no-empty-object-type */
import 'vitest';
import { CompareOptions } from './tests/commands/screenshot';

interface CustomMatchers<R = unknown> {
  toMatchImageSnapshot: (options?: CompareOptions) => R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
