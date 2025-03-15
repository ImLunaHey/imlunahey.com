import { useEffect } from 'react';

const getIcon = () => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  // christmas
  if (month === 11 && day === 25) return '🎄';

  // easter
  if (month === 3 && day === 21) return '🐰';

  // new year
  if (month === 1 && day === 1) return '🎆';

  return '🌙';
};

export const Favicon = () => {
  useEffect(() => {
    const moon = getIcon();
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.90em%22 font-size=%2290%22>${moon}</text></svg>`;
    document.head.appendChild(favicon);
  }, []);

  return null;
};
