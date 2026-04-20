import { createPipe } from '../../../common/create-pipe';
import { contrast } from './contrast';
import { brightness } from './brightness';
import { sepia } from './sepia';

// Reyes: a new vintage filter, gives your photos a “dusty” look
export const reyes = (imageData: ImageData) => {
  const pipe = createPipe(imageData);
  return pipe(
    (imageData) => sepia(imageData, 0.4),
    (imageData) => brightness(imageData, 0.13),
    (imageData) => contrast(imageData, -0.05),
    (imageData) => imageData,
  );
};
