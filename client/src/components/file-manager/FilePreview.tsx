import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VirtualizedList } from '@/components/ui/virtualized-list';
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

async function streamFileContent(blob: Blob, onProgress: (progress: number) => void, onData: (data: any[]) => void) {
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks
  const MAX_ROWS_PER_CHUNK = 1000; // Limit rows per update
  const MAX_COLUMNS = 10; // Maximum number of columns to display
  
  const decompressedStream = new DecompressionStream('gzip');
  const reader = blob.stream().pipeThrough(decompressedStream).getReader();
  
  let buffer = '';
  let processedRows: any[] = [];
  let totalBytes = 0;
  const fileSize = blob.size;

  // Create CSV parser with chunk processing
  const parser = new Papa.Parser('', {
    header: true,
    dynamicTyping: true,
    chunk: (results: any) => {
      if (results.errors.length > 0) {
        console.warn('Parse warnings:', results.errors);
      }

      // Process the data to limit columns
      const limitedData = results.data.map((row: any) => {
        const entries = Object.entries(row).slice(0, MAX_COLUMNS);
        return Object.fromEntries(entries);
      });

      // Only keep the latest chunk of rows to prevent memory issues
      processedRows = processedRows.slice(-MAX_ROWS_PER_CHUNK).concat(limitedData);
      onData(processedRows);
    },
    error: (error: any) => {
      console.error('CSV parsing error:', error);
    }
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalBytes += value.length;
      onProgress(Math.round((totalBytes / fileSize) * 100));
      
      const text = new TextDecoder().decode(value);
      buffer += text;
      
      // Parse the buffer
      parser.parse(buffer);
      buffer = '';
    }
    
    // Parse any remaining data
    if (buffer.length > 0) {
      parser.parse(buffer);
    }
    parser.finish();
  } finally {
    reader.releaseLock();
  }
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<string | Array<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const handleImageError = useCallback((error: Error) => {
    console.error('Image loading error:', error);
    setError(`Failed to load image: ${error.message}`);
    setIsLoading(false);
  }, []);

  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupBlobUrl();
    };
  }, [cleanupBlobUrl]);

  useEffect(() => {
    const loadContent = async () => {
      if (!file) return;

      setIsLoading(true);
      setError(null);
      setContent(null);
      setProgress(0);
      setImageDimensions(null);
      cleanupBlobUrl();

      try {
        if (file.type.startsWith('image/')) {
          const decompressedStream = new DecompressionStream('gzip');
          const writer = decompressedStream.writable.getWriter();
          writer.write(await file.data.arrayBuffer());
          writer.close();
          
          const decompressedBlob = await new Response(decompressedStream.readable).blob();
          const blobUrl = URL.createObjectURL(new Blob([decompressedBlob], { type: file.type }));
          blobUrlRef.current = blobUrl;

          const img = new Image();
          
          const imageLoadPromise = new Promise<void>((resolve, reject) => {
            img.onload = () => {
              setImageDimensions({
                width: img.naturalWidth,
                height: img.naturalHeight
              });
              setContent(blobUrl);
              setIsLoading(false);
              resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
          });

          img.src = blobUrl;
          await imageLoadPromise;
        } else if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
          await streamFileContent(
            file.data,
            (progress) => setProgress(progress),
            (data) => setContent(data)
          );
          setIsLoading(false);
        } else if (file.type === 'application/json') {
          const decompressedStream = new DecompressionStream('gzip');
          const writer = decompressedStream.writable.getWriter();
          writer.write(await file.data.arrayBuffer());
          writer.close();
          
          const decompressedBlob = await new Response(decompressedStream.readable).blob();
          const text = await decompressedBlob.text();
          try {
            const parsed = JSON.parse(text);
            setContent(parsed);
          } catch (err) {
            throw new Error('Invalid JSON format');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file content');
        setContent(null);
        setIsLoading(false);
      }
    };

    loadContent();
  }, [file, cleanupBlobUrl]);

  if (!file) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
      >
        <div className="container max-w-4xl h-full py-4 mx-auto">
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
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <div className="text-sm text-muted-foreground">
                    Processing large file, showing latest {Math.min(Array.isArray(content) ? content.length : 0, 1000)} rows...
                  </div>
                  {progress > 0 && (
                    <div className="w-full max-w-xs">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center mt-1">{Math.round(progress)}% loaded</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {file.type.startsWith('image/') && (
                    <div className="relative flex justify-center">
                      <ErrorBoundary onError={handleImageError}>
                        <img
                          src={content as string}
                          alt={file.name}
                          className="max-w-full max-h-[80vh] object-contain"
                          style={{
                            width: imageDimensions ? `${imageDimensions.width}px` : 'auto',
                            height: imageDimensions ? `${imageDimensions.height}px` : 'auto'
                          }}
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                  
                  {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && (
                    <div className="h-[calc(100vh-12rem)]">
                      <VirtualizedList
                        data={content.slice(-1000)}
                        rowHeight={40}
                        overscan={5}
                        renderRow={({ index, style }) => (
                          <div style={style} className="flex gap-2 py-1 border-b">
                            {Object.entries(content[index]).slice(0, 10).map(([key, value], i) => (
                              <div key={i} className="flex-1 min-w-[100px] max-w-[200px] truncate">
                                <span className="text-muted-foreground">{key}: </span>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            ))}
                          </div>
                        )}
                      />
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
