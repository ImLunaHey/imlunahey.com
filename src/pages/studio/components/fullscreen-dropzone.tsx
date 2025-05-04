import { useState } from 'react';

type DropzoneProps = {
  children: React.ReactNode;
  hoverChildren: React.ReactNode;
  onImageDrop: (image: HTMLImageElement) => void;
  onVideoDrop: (video: HTMLVideoElement) => void;
};

export const onMediaLoad = (
  file: File,
  onImageLoad: (image: HTMLImageElement) => void,
  onVideoLoad: (video: HTMLVideoElement) => void,
) => {
  switch (file.type) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
    case 'image/webp': {
      const reader = new FileReader();
      reader.onload = (e) => {
        const image = document.createElement('img');
        image.src = e.target?.result as string;
        image.onload = () => {
          onImageLoad(image);
        };
      };
      reader.readAsDataURL(file);
      return;
    }

    case 'video/mp4':
    case 'video/quicktime':
    case 'video/webm':
    case 'video/ogg':
    case 'video/3gpp':
    case 'video/x-msvideo': {
      const video = document.createElement('video');
      video.id = crypto.randomUUID();
      // Hide the video
      video.style.display = 'none';
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.addEventListener(
        'loadedmetadata',
        () => {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          onVideoLoad(video);
        },
        false,
      );
      document.body.appendChild(video);
      return;
    }
  }
};

export const FullscreenDropzone = ({ children, hoverChildren, onImageDrop, onVideoDrop }: DropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files ?? [];
    for (let i = 0; i < files.length; i++) {
      onMediaLoad(files[i], onImageDrop, onVideoDrop);
    }
  };

  return (
    <div
      className="absolute w-full h-full top-0 right-0 bottom-0 left-0"
      onDragOver={onDragOver}
      onDragLeave={onLeave}
      onMouseLeave={onLeave}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="absolute w-full h-full top-0 right-0 bottom-0 left-0 flex justify-center items-center z-20">
          {hoverChildren}
        </div>
      )}
      <div className="relative w-full h-full flex justify-center">{children}</div>
    </div>
  );
};
