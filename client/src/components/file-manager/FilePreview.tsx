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

function ErrorBoundary({ children, onError }: { children: React.ReactNode; onError: (error: Error) => void }) {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      onError(event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [onError]);

  return <>{children}</>;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<any[] | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const blobUrlRef = useRef<string | null>(null);

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

  async function streamFileContent(blob: Blob, type: string) {
    const reader = blob.stream().getReader();
    let buffer = '';
    let processedRows: any[] = [];
    let bytesRead = 0;
    const totalBytes = blob.size;
    
    const parser = Papa.parse('', {
      header: true,
      dynamicTyping: true,
      chunk: (results) => {
        processedRows = [...processedRows.slice(-999), ...results.data];
        setContent(processedRows);
      }
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        bytesRead += value.length;
        setProgress(Math.round((bytesRead / totalBytes) * 100));
        
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        // For CSV/TSV, parse in chunks
        if (type === 'text/csv' || type === 'text/tab-separated-values') {
          parser.write(buffer);
          buffer = '';
        }
      }

      if (type === 'text/csv' || type === 'text/tab-separated-values') {
        parser.finish();
      }
      
      return buffer;
    } finally {
      reader.releaseLock();
    }
  }

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
        let fileBlob = file.data;
        
        // Only try to decompress if it's actually compressed
        if (file.name.endsWith('.gz')) {
          try {
            const decompressedStream = new DecompressionStream('gzip');
            const reader = file.data.stream().pipeThrough(decompressedStream).getReader();
            const chunks = [];
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            
            fileBlob = new Blob(chunks, { type: file.type });
          } catch (error) {
            console.error('Decompression error:', error);
            // Fall back to using the original blob if decompression fails
            fileBlob = file.data;
          }
        }

        // Handle different file types
        if (file.type.startsWith('image/')) {
          const blobUrl = URL.createObjectURL(fileBlob);
          blobUrlRef.current = blobUrl;
          
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              setImageDimensions({
                width: img.naturalWidth,
                height: img.naturalHeight
              });
              setContent(blobUrl);
              setIsLoading(false);
              resolve();
            };
            img.onerror = () => {
              reject(new Error('Failed to load image'));
            };
            img.src = blobUrl;
          });
        } 
        else if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
          await streamFileContent(fileBlob, file.type);
          setIsLoading(false);
        }
        else if (file.type === 'application/json') {
          const text = await fileBlob.text();
          try {
            // First verify we have valid text content
            if (!text.trim()) {
              throw new Error('Empty JSON file');
            }
            
            // Try to parse JSON with better error handling
            let json;
            try {
              json = JSON.parse(text);
            } catch (parseError) {
              console.error('JSON Parse Error:', parseError);
              throw new Error('Invalid JSON format: ' + parseError.message);
            }
            
            // Validate we got an actual object or array
            if (typeof json !== 'object' || json === null) {
              throw new Error('Invalid JSON content: expected object or array');
            }
            
            setContent(json);
            setIsLoading(false);
          } catch (error) {
            console.error('JSON Processing Error:', error);
            throw new Error(`JSON Error: ${error.message}`);
          }
        }
        else {
          const text = await streamFileContent(fileBlob, file.type);
          setContent(text);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file content');
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
              <ErrorBoundary onError={(error) => setError(error.message)}>
                {error ? (
                  <Alert variant="destructive" className="mx-auto max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {error}
                      <br />
                      <span className="text-xs opacity-70">File type: {file.type}</span>
                    </AlertDescription>
                  </Alert>
                ) : isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <div className="text-sm text-muted-foreground">
                      Loading {file.type.startsWith('image/') ? 'image' : 
                              file.type === 'text/csv' || file.type === 'text/tab-separated-values' ? 'spreadsheet' :
                              file.type === 'application/json' ? 'JSON' : 'file'}...
                    </div>
                    {progress > 0 && (
                      <div className="w-full max-w-xs">
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-200"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-center mt-1">
                          {Math.round(progress)}% loaded
                          {file.type === 'text/csv' || file.type === 'text/tab-separated-values' 
                            ? ' (showing latest 1000 rows)' 
                            : ''
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {file.type.startsWith('image/') && typeof content === 'string' && (
                      <div className="relative flex justify-center">
                        <img
                          src={content}
                          alt={file.name}
                          className="max-w-full max-h-[80vh] object-contain rounded-lg"
                          style={{
                            width: imageDimensions?.width ? `${imageDimensions.width}px` : 'auto',
                            height: imageDimensions?.height ? `${imageDimensions.height}px` : 'auto'
                          }}
                        />
                      </div>
                    )}
                    
                    {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && (
                      <div className="h-[calc(100vh-12rem)]">
                        <VirtualizedList
                          data={content}
                          rowHeight={40}
                          overscan={5}
                          renderRow={({ index, style }) => (
                            <div key={`row-${index}`} style={style} className="flex gap-2 py-1 border-b">
                              {Object.entries(content[index]).map(([key, value], i) => (
                                <div key={`${index}-${key}-${i}`} className="flex-1 min-w-[100px] max-w-[200px] truncate">
                                  <span className="text-muted-foreground">{key}: </span>
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </div>
                    )}
                    
                    {file.type === 'application/json' && content && (
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                        {JSON.stringify(content, null, 2)}
                      </pre>
                    )}

                    {!file.type.startsWith('image/') && 
                      file.type !== 'text/csv' && 
                      file.type !== 'text/tab-separated-values' && 
                      file.type !== 'application/json' && 
                      typeof content === 'string' && (
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                        {content}
                      </pre>
                    )}
                  </>
                )}
              </ErrorBoundary>
            </ScrollArea>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
