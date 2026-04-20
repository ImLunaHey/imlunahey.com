import { createPipe } from '../../../common/create-pipe';
import { contrast } from './contrast';
import { saturation } from './saturation';

// Lo-Fi: Enriches color and adds strong shadows through the use of saturation and "warming" the temperature
export const lofi = (imageData: ImageData) => {
  const pipe = createPipe(imageData);
  return pipe(
    (imageData) => contrast(imageData, 0.15),
    (imageData) => saturation(imageData, 0.2),
    (imageData) => imageData,
  );
};
