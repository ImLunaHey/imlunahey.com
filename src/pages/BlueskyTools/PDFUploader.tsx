import { useState, useRef, useEffect } from 'react';
import { AtpAgent } from '@atproto/api';
import { Card } from '../../components/Card';
import { Button } from '../../elements/Button';
import { Input } from '../../elements/Input';

const generatePDFPreview = async (pdfFile: File) => {
  const { resolvePDFJS } = await import('pdfjs-serverless');
  const { getDocument } = await resolvePDFJS();

  // Convert file to array buffer
  const arrayBuffer = await pdfFile.arrayBuffer();

  // Load the PDF document
  const pdf = await getDocument(arrayBuffer).promise;

  // Get the first page
  const page = await pdf.getPage(1);

  // Create a canvas for rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');

  // Get the original viewport at scale 1
  const originalViewport = page.getViewport({ scale: 1 });

  // Define target width
  const targetWidth = 1920; // Full HD width

  // Calculate scale to match target width
  const scale = targetWidth / originalViewport.width;

  // Get scaled viewport
  const viewport = page.getViewport({ scale });

  // Set canvas size to 16:9 ratio based on target width
  canvas.width = targetWidth;
  canvas.height = Math.round(targetWidth * (9 / 16)); // 16:9 aspect ratio

  // Render the page
  await page.render({
    canvasContext: context,
    viewport: viewport,
    transform: [1, 0, 0, 1, 0, 0], // Default transform
    // Only render the top portion by adjusting the clip rectangle
    // @ts-expect-error - clippingPath is missing from the types
    clippingPath: new Path2D().rect(0, 0, canvas.width, canvas.height),
  }).promise;

  // Convert canvas to blob
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!blob) throw new Error('Failed to convert canvas to blob');

  return blob;
};

export default function PDFUploaderPage() {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [viewLink, setViewLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      try {
        const previewBlob = await generatePDFPreview(selectedFile);
        const url = URL.createObjectURL(previewBlob);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Error generating preview:', err);
        setStatus(`Error generating preview: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('Starting...');
    setViewLink(null);

    try {
      if (!file) throw new Error('Please select a PDF file');

      // Authenticate
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      await agent.login({ identifier: handle, password: appPassword });
      setStatus('Logged in! Uploading PDF...');

      // Process file
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload pdf blob
      const pdfBlobResponse = await agent.uploadBlob(uint8Array, { encoding: 'application/pdf' });

      // Generate preview image
      const previewBlob = await generatePDFPreview(file);
      const previewUint8Array = new Uint8Array(await previewBlob.arrayBuffer());
      await agent.uploadBlob(previewUint8Array, { encoding: 'image/jpeg' });

      // Store the PDF
      await agent.api.com.atproto.repo.putRecord({
        repo: agent.session!.did,
        collection: 'com.imlunahey.pdf',
        rkey: crypto.randomUUID(),
        record: {
          $type: 'com.imlunahey.pdf',
          pdf: {
            $type: 'blob',
            ref: pdfBlobResponse.data.blob.ref,
            mimeType: 'application/pdf',
            size: pdfBlobResponse.data.blob.size,
          },
        },
      });

      const cid = pdfBlobResponse.data.blob.ref.toString();
      const link = `${agent.service}xrpc/com.atproto.sync.getBlob?did=${agent.session!.did}&cid=${cid}`;
      setViewLink(link);
      setStatus('Success! PDF uploaded.');
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <Card className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Bluesky PDF Uploader</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          value={handle}
          onChangeValue={(value) => setHandle(value)}
          placeholder="Handle (e.g. user.bsky.social)"
          required
        />

        <Input
          type="password"
          value={appPassword}
          onChangeValue={(value) => setAppPassword(value)}
          placeholder="App Password"
          required
        />

        {previewUrl && (
          <Card>
            <img src={previewUrl} alt="PDF preview" className="h-auto w-full rounded" />
          </Card>
        )}

        <Input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" required />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Post to Bluesky'}
        </Button>
      </form>

      {status && (
        <div className="mt-4 rounded border p-3">
          <p>{status}</p>
          {viewLink && (
            <div className="mt-2">
              <p>PDF view link:</p>
              <a href={viewLink} target="_blank" rel="noreferrer" className="break-all text-blue-500 hover:underline">
                {viewLink}
              </a>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
