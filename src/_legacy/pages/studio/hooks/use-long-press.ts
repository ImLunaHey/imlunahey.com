import { useCallback, useRef } from 'react';

export const useLongPress = (callback: () => void, ms = 300) => {
  const timerRef = useRef<number>(0);
  const endTimer = () => {
    clearTimeout(timerRef.current || 0);
    timerRef.current = 0;
  };

  const onStartLongPress = useCallback(
    (_event: Event) => {
      endTimer();

      timerRef.current = window.setTimeout(() => {
        callback();
        endTimer();
      }, ms);
    },
    [callback, ms],
  );

  const onEndLongPress = useCallback(() => {
    if (timerRef.current) {
      endTimer();
      callback();
    }
  }, [callback]);

  return [onStartLongPress, onEndLongPress, endTimer];
};
