import { useEffect, useState } from 'react';

// Butcher's algorithm for Gregorian Easter Sunday
const easterSunday = (year: number): { month: number; day: number } => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { month: Math.floor(n / 31) - 1, day: (n % 31) + 1 };
};

const getIcon = () => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  // christmas
  if (month === 11 && day === 25) return '🎄';

  // new year
  if (month === 0 && day === 1) return '🎆';

  // easter sunday
  const easter = easterSunday(now.getFullYear());
  if (month === easter.month && day === easter.day) return '🐰';

  return '🌙';
};

export const Favicon = () => {
  const [icon, setIcon] = useState(getIcon());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIcon('👀');
      } else {
        setIcon(getIcon());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <link
      rel="icon"
      href={`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".90em" font-size="80">${icon}</text></svg>`}
    />
  );
};
