// For some stupid reason the body gets focused when the canvas is focused
export const isCanvasInFocus = () => document.activeElement?.tagName === 'BODY';
