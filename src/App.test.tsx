import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { getRouter } from './router';

describe('App', () => {
  afterEach(cleanup);

  it('should create a router', () => {
    const router = getRouter();
    expect(router).toBeTruthy();
    expect(typeof router.navigate).toBe('function');
  });
});
