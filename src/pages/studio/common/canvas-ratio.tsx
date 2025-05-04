export type CanvasRatio = '16:9' | '9:16' | '4:3' | '1:1' | 'twitter-banner';

export const canvasRatios = {
  '16:9': {
    name: '16:9',
    width: 1920,
    height: 1080,
  },
  '9:16': {
    name: '9:16',
    width: 1080,
    height: 1920,
  },
  '4:3': {
    name: '4:3',
    width: 1920,
    height: 1440,
  },
  '1:1': {
    name: '1:1',
    width: 1080,
    height: 1080,
  },
  'twitter-banner': {
    name: 'Twitter Banner',
    width: 1500,
    height: 500,
  },
} satisfies Record<CanvasRatio, { name: string; width: number; height: number }>;

export const canvasRatioToSize = (ratio: CanvasRatio) => canvasRatios[ratio];
