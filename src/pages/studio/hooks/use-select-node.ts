import { Node } from '../components/node';

type Position = {
  x: number;
  y: number;
};

/**
 * This hook is used to seelct an node on a canvas.
 * @param nodes The nodes to select from.
 * @param translatePos The position of the canvas.
 * @param scale The scale of the canvas.
 * @returns The mouse event handlers.
 */
export const useSelectNode = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  nodes: Node[],
  translatePos: Position,
  scale: number,
) => {
  return;
  // const currentItem = useRef<number | null>(null);
  // const mouseRef = useRef({ x: 0, y: 0 });

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const onMouseDown = (event: MouseEvent) => {
  //     const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
  //     const { x: mouseX, y: mouseY } = getCoordinates(event, rect, translatePos, scale);

  //     // Check if an item is being clicked
  //     for (let i = items.length - 1; i >= 0; i--) {
  //       const item = items[i];
  //       if (mouseX > item.x && mouseX < item.x + item.width && mouseY > item.y && mouseY < item.y + item.height) {
  //         currentItem.current = i;
  //         mouseRef.current.x = mouseX - item.x;
  //         mouseRef.current.y = mouseY - item.y;
  //         return;
  //       }
  //     }
  //   };

  //   const onTouchStart = (event: TouchEvent) => {
  //     const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
  //     const { x: touchX, y: touchY } = getCoordinates(event, rect, translatePos, scale);

  //     // Logic similar to onMouseDown using touchX and touchY
  //     for (let i = items.length - 1; i >= 0; i--) {
  //       const item = items[i];
  //       if (touchX > item.x && touchX < item.x + item.width && touchY > item.y && touchY < item.y + item.height) {
  //         currentItem.current = i;
  //         mouseRef.current.x = touchX - item.x;
  //         mouseRef.current.y = touchY - item.y;
  //         return;
  //       }
  //     }
  //   };

  //   // Binding the event handlers
  //   canvas.addEventListener('mousedown', onMouseDown);
  //   canvas.addEventListener('touchstart', onTouchStart);

  //   // Cleanup function to unbind the event handlers
  //   return () => {
  //     canvas.removeEventListener('mousedown', onMouseDown);
  //     canvas.removeEventListener('touchstart', onTouchStart);
  //   };
  // }, [canvasRef, items, translatePos, scale]);

  // return currentItem;
};
