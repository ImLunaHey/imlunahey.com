/**
 * Format a number using Intl.NumberFormat's compact notation but always round down
 * @param value The number to format
 * @param locale The locale to use (default: 'en-US')
 * @return The formatted number
 */
export function formatNumber(value: number, locale: string = 'en-US'): string {
  // Handle edge cases
  if (value === undefined || value === null) return '0';
  if (isNaN(value)) return 'NaN';
  if (!isFinite(value)) return value > 0 ? '∞' : '-∞';

  // Handle zero
  if (value === 0) return '0';

  // Determine the magnitude
  const absNum = Math.abs(value);
  let divisor = 1;

  if (absNum >= 1e12) {
    divisor = 1e12; // trillion
  } else if (absNum >= 1e9) {
    divisor = 1e9; // billion
  } else if (absNum >= 1e6) {
    divisor = 1e6; // million
  } else if (absNum >= 1e3) {
    divisor = 1e3; // thousand
  }

  // For positive numbers, floor down
  // For negative numbers, we need to ceil (which is floor in the other direction)
  const flooredValue = value >= 0 ? Math.floor(value / divisor) * divisor : Math.ceil(value / divisor) * divisor;

  // Return the formatted result using Intl.NumberFormat
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(flooredValue);
}
