import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
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
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [htmlMode, setHtmlMode] = useState<'safe' | 'raw' | 'preview'>('safe');
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

  useEffect(() => {
    const loadContent = async () => {
      if (!file) return;

      setIsLoading(true);
      setError(null);
      setContent(null);
      setSanitizedContent(null);
      setProgress(0);
      setImageDimensions(null);
      cleanupBlobUrl();

      try {
        const compressedStream = file.data.stream();
        const decompressedStream = compressedStream.pipeThrough(new DecompressionStream('gzip'));
        const reader = decompressedStream.getReader();
        
        let chunks = [];
        let totalSize = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          totalSize += value.length;
          setProgress(Math.round((totalSize / file.data.size) * 100));
        }
        
        const decompressedBlob = new Blob(chunks, { type: file.type });
        
        if (file.type.startsWith('image/')) {
          const blobUrl = URL.createObjectURL(decompressedBlob);
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
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = blobUrl;
          });
        } else if (file.type === 'text/html') {
          const text = await decompressedBlob.text();
          const validationResult = validateHTML(text);
          if (!validationResult.isValid) {
            throw new Error(`Invalid HTML: ${validationResult.errors.join(', ')}`);
          }
          const sanitized = sanitizeHTML(text);
          setContent(text);
          setSanitizedContent(sanitized);
          setIsLoading(false);
        } else if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
          const text = await decompressedBlob.text();
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0) {
                console.warn('CSV parsing warnings:', results.errors);
              }
              setContent(results.data.slice(0, 1000));
              setIsLoading(false);
            },
            error: (error: Error) => {
              throw new Error(`CSV parsing error: ${error.message}`);
            }
          });
        } else if (file.type === 'application/json') {
          const text = await decompressedBlob.text();
          try {
            setContent(JSON.parse(text));
          } catch (error) {
            throw new Error('Invalid JSON format');
          }
          setIsLoading(false);
        } else {
          const text = await decompressedBlob.text();
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

  const htmlContent = typeof content === 'string' ? content : '';
  const safeHtmlContent = typeof sanitizedContent === 'string' ? sanitizedContent : '';
  const displayHtmlContent = htmlMode === 'raw' ? htmlContent : safeHtmlContent;

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
              {file.type === 'text/html' && content && (
                <div className="flex items-center gap-2 mr-4">
                  <div className="flex items-center rounded-lg border bg-muted">
                    <Button
                      variant={htmlMode === 'safe' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setHtmlMode('safe')}
                      className="rounded-r-none"
                    >
                      Safe HTML
                    </Button>
                    <Button
                      variant={htmlMode === 'raw' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setHtmlMode('raw')}
                      className="rounded-l-none"
                    >
                      Raw HTML
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHtmlMode(prev => prev === 'preview' ? (htmlMode === 'safe' ? 'safe' : 'raw') : 'preview')}
                    className="ml-2"
                  >
                    {htmlMode === 'preview' ? 'Show Code' : 'Preview'}
                  </Button>
                </div>
              )}
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
                              file.type === 'text/html' ? 'HTML' :
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
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {file.type === 'text/html' && typeof content === 'string' && (
                      htmlMode === 'preview' ? (
                        <div className="relative w-full h-[calc(100vh-12rem)] bg-white rounded-lg border">
                          <iframe
                            srcDoc={displayHtmlContent}
                            className="w-full h-full rounded-lg"
                            sandbox="allow-same-origin allow-scripts"
                            title="HTML Preview"
                          />
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                          {displayHtmlContent.split('\n').map((line, i) => (
                            <div key={i} className="px-2 hover:bg-muted-foreground/5">
                              {line}
                            </div>
                          ))}
                        </pre>
                      )
                    )}
                    
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
                    
                    {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && content.length > 0 && (
                      <div className="h-[calc(100vh-12rem)]">
                        <VirtualizedList
                          data={content}
                          rowHeight={40}
                          overscan={5}
                          renderRow={({ index, style }) => (
                            <div style={style} className="flex gap-2 py-1 border-b">
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
                      file.type !== 'text/html' &&
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
