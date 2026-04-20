const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'narrow' });

export function formatUpdated(days: number): string {
  if (days <= 0) return 'today';
  if (days < 7) return rtf.format(-days, 'day');
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week');
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
  return rtf.format(-Math.floor(days / 365), 'year');
}
