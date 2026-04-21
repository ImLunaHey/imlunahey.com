import { useEffect, useRef } from 'react';

type SlideyBoiProps = Omit<React.ComponentProps<'input'>, 'onChange'> & {
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const textToWidth = (text: string) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = '12px monospace';
  return ctx.measureText(text.slice(0, 5)).width;
};

export const SlideyBoi = ({ type: _type, id, label, value, onChange, ...passthrough }: SlideyBoiProps) => {
  const width = useRef(0);

  useEffect(() => {
    width.current = textToWidth(String(value ?? ''));
  }, [value]);

  return (
    <div className="flex flex-row justify-between gap-2">
      <div className="flex gap-2">
        <label htmlFor={id}>{label}</label>
        <div
          className="max-w-full text-center"
          style={{
            width: `${18 + width.current}px`,
          }}
        >
          <input
            className="h-5 w-full rounded border border-[#e4e4e7] bg-[#f1f1f3] p-1 text-center font-mono text-xs text-[#a0a0a0] dark:border-[#2e2e2e] dark:bg-[#121212]"
            value={value}
            onChange={(e) => {
              e.preventDefault();
              const value = e.target.value;

              // Regular expression to allow only digits to be entered into input
              if (/^\d*$/.test(value)) {
                onChange?.(e);
              } else {
                // Reset to '0' if non-numeric value is entered
                onChange?.({ ...e, target: { ...e.target, value: '0' } });
              }
            }}
            {...passthrough}
          />
        </div>
      </div>
      <input className="accent-[#7e7e7e]" id={id} type="range" value={value} onChange={onChange} {...passthrough} />
    </div>
  );
};
