import { useDropzone } from 'react-dropzone';

type DropzoneProps = {
  onDrop: (acceptedFiles: File[]) => void;
};

/**
 * User can drag and drop an image to the canvas
 */
export const Dropzone = ({ onDrop }: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div {...getRootProps()} className="w-full h-full flex items-center justify-center absolute">
      <div className="rounded-md p-4 cursor-pointer text-center text-white bg-black w-[250px] aspect-square items-center justify-center flex flex-col bg-opacity-75">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the file</p>
        ) : (
          <p>{"Drag 'n' drop an image here, or click to select one from your library"}</p>
        )}
      </div>
    </div>
  );
};
