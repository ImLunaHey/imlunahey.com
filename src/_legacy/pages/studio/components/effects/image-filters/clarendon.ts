import { createPipe } from '../../../common/create-pipe';
import { brightness } from './brightness';
import { contrast } from './contrast';
import { saturation } from './saturation';

// Clarendon: adds light to lighter areas and dark to darker areas
export const clarendon = (imageData: ImageData) => {
  const pipe = createPipe(imageData);
  return pipe(
    (imageData) => brightness(imageData, 0.1),
    (imageData) => contrast(imageData, 0.1),
    (imageData) => saturation(imageData, 0.15),
    (imageData) => imageData,
  );
};
