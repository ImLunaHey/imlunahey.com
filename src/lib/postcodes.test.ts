import { describe, it, expect } from 'vitest';
import { formatPostcode } from './postcodes';

describe('formatPostcode', () => {
  it('normalises a space-less postcode', () => {
    expect(formatPostcode('sw1a1aa')).toBe('SW1A 1AA');
  });

  it('strips whitespace and uppercases', () => {
    expect(formatPostcode('  sw 1a 1aa ')).toBe('SW1A 1AA');
  });

  it('preserves a correctly-formed postcode', () => {
    expect(formatPostcode('EC1A 1BB')).toBe('EC1A 1BB');
  });

  it('always puts the space before the last 3 chars regardless of outward length', () => {
    // EC postcodes have 4-char outward; M1 postcodes have 2-char outward.
    expect(formatPostcode('m11ae')).toBe('M1 1AE');
    expect(formatPostcode('ec1a1bb')).toBe('EC1A 1BB');
  });

  it('returns as-is when too short to parse', () => {
    expect(formatPostcode('abc')).toBe('ABC');
    expect(formatPostcode('')).toBe('');
  });
});
