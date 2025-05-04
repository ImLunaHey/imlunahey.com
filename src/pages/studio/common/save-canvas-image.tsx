export const saveCanvasImageLink = (canvas: HTMLCanvasElement) => {
  const link = document.createElement('a');
  link.download = 'image.png'; // Set the filename for the download
  link.href = canvas.toDataURL('image/png'); // Create a data URL representing the canvas image
  document.body.appendChild(link); // Append to the document temporarily
  link.click(); // Trigger the download
  document.body.removeChild(link); // Clean up
};

export const saveCanvasImageFile = async (canvas: HTMLCanvasElement) => {
  const imageData = await fetch(canvas.toDataURL('image/png')).then((res) => res.blob());

  try {
    const imgFileHandle = await window.showSaveFilePicker({
      types: [
        {
          description: 'Image',
          accept: { 'image/png': ['.png'] },
        },
      ],
      suggestedName: `studio-${new Date().toISOString().replace(/:/g, '-')}.png`,
    });
    const writable = await imgFileHandle.createWritable();
    await writable.write(imageData);
    await writable.close();
  } catch (err) {
    // If the user cancels the save prompt, return
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }

    // Try to save the image using a link
    saveCanvasImageLink(canvas);
  }
};
