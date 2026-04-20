export const GradientPicker = ({
  backgroundGradient,
  onChange,
}: {
  backgroundGradient: string[] | null;
  onChange: (backgroundGradient: string[]) => void;
}) => {
  if (!backgroundGradient) return null;
  return (
    <div className="flex flex-row gap-2 justify-between">
      <label htmlFor="gradient-picker">Gradient</label>
      <div className="flex flex-row gap-1">
        {backgroundGradient.map((colourStop, index) => (
          <input
            key={index}
            id={`gradient-picker-${index}`}
            type="color"
            value={colourStop}
            onChange={(event) => {
              onChange(
                backgroundGradient.map((colourStop, colourStopIndex) => {
                  if (colourStopIndex === index) {
                    return event.target.value;
                  }
                  return colourStop;
                }),
              );
            }}
          />
        ))}
      </div>
    </div>
  );
};
