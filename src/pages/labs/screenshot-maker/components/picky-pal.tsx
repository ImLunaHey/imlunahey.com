type Option = {
  key: string;
  value: string;
};

type PickyPalProps = Omit<React.ComponentProps<'select'>, 'onChange'> & {
  options: Option[];
  label: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

export const PickyPal = ({ options, id, label, ...passthrough }: PickyPalProps) => {
  return (
    <div className="flex flex-row justify-between gap-2">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="rounded-sm border border-[#e4e4e7] bg-[#f1f1f3] py-1 text-[#2e2e2e] dark:border-[#2e2e2e] dark:bg-[#222327] dark:text-[#f1f1f3]"
        {...passthrough}
      >
        {options.map((option) => (
          <option key={option.key} value={option.value}>
            {option.key}
          </option>
        ))}
      </select>
    </div>
  );
};
