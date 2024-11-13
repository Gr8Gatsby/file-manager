import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Papa from 'papaparse';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    data: Blob;
  } | null;
  onClose: () => void;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: (error: Error) => void;
}

function ErrorBoundary({ children, onError }: ErrorBoundaryProps) {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught by boundary:', event.error);
      onError(event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [onError]);

  return <>{children}</>;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<string | Array<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageOrientation, setImageOrientation] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleImageError = useCallback((error: Error) => {
    console.error('Image loading error:', error);
    setError(`Failed to load image: ${error.message}`);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadContent = async () => {
      if (!file) return;

      setIsLoading(true);
      setError(null);
      setContent(null);
      setImageDimensions(null);

      try {
        console.log(`Loading preview for file: ${file.name} (${file.type})`);
        
        if (file.type.startsWith('image/')) {
          console.log('Processing image file');
          
          // Validate MIME type
          const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (!validImageTypes.includes(file.type)) {
            throw new Error(`Unsupported image type: ${file.type}`);
          }

          // Read image metadata
          const arrayBuffer = await file.data.arrayBuffer();
          const view = new DataView(arrayBuffer);
          
          // Get image dimensions and orientation
          const img = new Image();
          blobUrl = URL.createObjectURL(file.data);
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              setImageDimensions({
                width: img.naturalWidth,
                height: img.naturalHeight
              });
              resolve(null);
            };
            img.onerror = reject;
            img.src = blobUrl!;
          });

          // Process EXIF data for JPEG
          if (file.type === 'image/jpeg') {
            let offset = 0;
            if (view.getUint16(0) === 0xFFD8) {
              offset = 2;
              while (offset < view.byteLength) {
                if (view.getUint16(offset) === 0xFFE1) {
                  const exifOffset = offset + 4;
                  if (view.getUint32(exifOffset) === 0x45786966) {
                    const tiffOffset = exifOffset + 6;
                    const littleEndian = view.getUint16(tiffOffset) === 0x4949;
                    const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
                    const entries = view.getUint16(tiffOffset + ifdOffset, littleEndian);
                    
                    for (let i = 0; i < entries; i++) {
                      const entryOffset = tiffOffset + ifdOffset + 2 + (i * 12);
                      const tag = view.getUint16(entryOffset, littleEndian);
                      if (tag === 0x0112) {
                        setImageOrientation(view.getUint16(entryOffset + 8, littleEndian));
                        break;
                      }
                    }
                  }
                  break;
                }
                offset += 2 + view.getUint16(offset + 2);
              }
            }
          }
          
          setContent(blobUrl);
          console.log('Image blob URL created successfully', {
            dimensions: imageDimensions,
            orientation: imageOrientation,
            mimeType: file.type
          });
        } else {
          // Text file handling
          const decompressedStream = new DecompressionStream('gzip');
          const writer = decompressedStream.writable.getWriter();
          writer.write(await file.data.arrayBuffer());
          writer.close();
          
          const decompressedBlob = await new Response(decompressedStream.readable).blob();
          const text = await decompressedBlob.text();
          console.log(`File content length: ${text.length} characters`);

          if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
            console.log('Processing CSV/TSV file');
            Papa.parse(text, {
              complete: (results) => {
                if (results.errors.length > 0) {
                  throw new Error(`Parse error: ${results.errors[0].message}`);
                }
                const processedData = results.data.map(row => 
                  Object.fromEntries(
                    Object.entries(row as Record<string, unknown>).map(([key, value]) => [
                      key,
                      value === null || value === undefined ? '' : value
                    ])
                  )
                );
                console.log(`Parsed ${processedData.length} rows successfully`);
                setContent(processedData);
              },
              header: true,
              skipEmptyLines: true,
              error: (error: Error) => {
                throw new Error(`Parse error: ${error.message}`);
              }
            });
          } else if (file.type === 'application/json') {
            console.log('Processing JSON file');
            const parsed = JSON.parse(text);
            setContent(parsed);
            console.log('JSON parsed successfully');
          }
        }
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file content');
        setContent(null);
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      if (typeof content === 'string' && content.startsWith('blob:')) {
        URL.revokeObjectURL(content);
      }
    };
  }, [file]);

  if (!file) return null;

  const getOrientationStyle = () => {
    switch (imageOrientation) {
      case 2: return 'scale-x-[-1]';
      case 3: return 'rotate-180';
      case 4: return 'scale-y-[-1]';
      case 5: return 'rotate-90 scale-x-[-1]';
      case 6: return 'rotate-90';
      case 7: return 'rotate-270 scale-x-[-1]';
      case 8: return 'rotate-270';
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
      >
        <div className="container max-w-4xl h-full py-4">
          <div className="bg-background rounded-lg shadow-lg h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="text-lg font-semibold truncate flex-1 pr-4">{file.name}</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {file.type.startsWith('image/') && (
                    <div className="relative flex justify-center">
                      <ErrorBoundary onError={handleImageError}>
                        <img
                          src={content as string}
                          alt={file.name}
                          className={`max-w-full max-h-[80vh] object-contain ${getOrientationStyle()}`}
                          style={{
                            width: imageDimensions ? `${imageDimensions.width}px` : 'auto',
                            height: imageDimensions ? `${imageDimensions.height}px` : 'auto'
                          }}
                          onError={() => setError('Failed to load image')}
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                  
                  {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && content.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            {Object.keys(content[0] || {}).map((header) => (
                              <th key={header} className="border p-2 text-left bg-muted">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {content.map((row, i) => (
                            <tr key={i} className="even:bg-muted/50">
                              {Object.values(row).map((cell, j) => (
                                <td key={j} className="border p-2">
                                  {typeof cell === 'object' && cell !== null 
                                    ? JSON.stringify(cell)
                                    : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {file.type === 'application/json' && (
                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                      {JSON.stringify(content, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </ScrollArea>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
