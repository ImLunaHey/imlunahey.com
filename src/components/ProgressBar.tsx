import { cn } from '../cn';

export const ProgressBar = ({ value, label }: { value: number; label: string }) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col">
      <span className="text-sm">{label}</span>
      <progress
        className={cn([
          'h-4 w-full appearance-none border bg-black', // Default track background (used by Firefox)
          '[&::-webkit-progress-bar]:rounded-none [&::-webkit-progress-bar]:bg-black', // Webkit track
          '[&::-webkit-progress-value]:rounded-none [&::-webkit-progress-value]:bg-white', // Webkit fill
          '[&::-moz-progress-bar]:rounded-none [&::-moz-progress-bar]:bg-white', // Firefox fill
        ])}
        value={clampedValue}
        max="100"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        aria-valuetext={`${clampedValue}%`}
      >
        {`${clampedValue}%`}
      </progress>
    </div>
  );
};
