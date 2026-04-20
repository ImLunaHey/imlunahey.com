export const humanTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  // Dont show until we have at least 1 of the unit
  if (days >= 1) return `${days} days`;
  if (hours >= 1) return `${hours} hours`;
  if (minutes >= 1) return `${minutes} minutes`;
  if (seconds >= 1) return `${seconds} seconds`;
  return `${ms} ms`;
};
