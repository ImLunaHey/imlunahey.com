import { Button } from './button';

type DownloadCanvasButtonProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  type?: 'png' | 'jpeg' | 'webp';
  className?: string;
};

/**
 * User can download the canvas as a file
 */
export const DownloadCanvasButton = ({ canvasRef, type = 'png', className }: DownloadCanvasButtonProps) => {
  const handleDownload = () => {
    if (canvasRef.current) {
      const image = canvasRef.current.toDataURL(`image/${type}`).replace(`image/${type}`, 'image/octet-stream');
      const link = document.createElement('a');
      link.download = `canvas-image.${type}`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Button onClick={handleDownload} className={className}>
      Download {type}
    </Button>
  );
};
