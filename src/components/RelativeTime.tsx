export const RelativeTime = ({ date }: { date: Date }) => {
  const formatter = new Intl.RelativeTimeFormat(navigator.language, {
    numeric: 'auto',
    style: 'long',
  });

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Convert to appropriate time unit
  if (diffInSeconds < 60) {
    return formatter.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return formatter.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return formatter.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return formatter.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return formatter.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return formatter.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
};
