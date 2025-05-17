import { useEffect, useState } from 'react';

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
