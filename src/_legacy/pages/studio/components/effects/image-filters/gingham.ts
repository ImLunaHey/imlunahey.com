import { createPipe } from '../../../common/create-pipe';
import { contrast } from './contrast';
import { sepia } from './sepia';

// Gingham: Vintage-inspired, taking some color out
export const gingham = (imageData: ImageData) => {
  const pipe = createPipe(imageData);
  return pipe(
    (imageData) => contrast(imageData, 0.9),
    (imageData) => sepia(imageData, 0.05),
    (imageData) => imageData,
  );
};
