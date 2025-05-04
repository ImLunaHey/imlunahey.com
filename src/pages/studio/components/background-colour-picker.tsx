import { hslToHex } from '../common/colours/hsl-to-hex';

type BackgroundColourPickerProps = {
  backgroundColour: string | null;
  onChangeBackgroundColour: (color: string) => void;
};

export const BackgroundColourPicker = ({ backgroundColour, onChangeBackgroundColour }: BackgroundColourPickerProps) => {
  if (backgroundColour === null) return null;

  return (
    <div className="flex justify-between gap-2">
      <label htmlFor="background-colour">Background Colour</label>
      <input
        id="background-colour"
        type="color"
        value={hslToHex(backgroundColour)}
        onChange={(event) => onChangeBackgroundColour(event.target.value)}
        className="border border-gray-200 rounded-md"
      />
    </div>
  );
};
