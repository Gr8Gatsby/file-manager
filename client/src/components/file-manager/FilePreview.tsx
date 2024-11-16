import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2, Eye, Code, Edit2, Save } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { validateHTML, sanitizeHTML, formatHTML } from '@/lib/html-utils';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/use-theme';
import { compressBlob } from '@/lib/compression';
import { fileDB } from '@/lib/db';
import Papa from 'papaparse';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    data: Blob;
  } | null;
  onClose: () => void;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
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

export function FilePreview({ file, onClose, isEditing, onEditingChange }: FilePreviewProps) {
  const { theme } = useTheme();
  const [content, setContent] = useState<any[] | string | null>(null);
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [htmlMode, setHtmlMode] = useState<'safe' | 'raw'>('safe');
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

  const handleSave = async () => {
    if (!file || typeof content !== 'string') return;
    
    try {
      let finalContent = content;
      if (file.type === 'application/json') {
        const parsed = JSON.parse(content);
        finalContent = JSON.stringify(parsed, null, 2);
      } else if (file.type === 'text/html') {
        const validationResult = validateHTML(content);
        if (!validationResult.isValid) {
          setError(`Invalid HTML: ${validationResult.errors.join(', ')}`);
          return;
        }
      }

      const blob = new Blob([finalContent], { type: file.type });
      const compressed = await compressBlob(blob);
      
      await fileDB.addFile({
        id: file.id,
        name: file.name,
        type: file.type,
        size: blob.size,
        compressedSize: compressed.size,
        data: compressed,
        createdAt: new Date(),
      });
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  };

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
            const jsonData = JSON.parse(text);
            setContent(jsonData);
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

  const htmlContent = file.type === 'text/html' && typeof content === 'string' 
    ? sanitizedContent 
    : null;

  const canEdit = file && (
    (file.type === 'text/html' && typeof content === 'string') ||
    (file.type === 'application/json' && (typeof content === 'string' || content !== null))
  );

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
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    {isEditing ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        className="gap-2"
                        disabled={!!error}
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditingChange?.(!isEditing)}
                        className="gap-2"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </Button>
                    )}
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 p-3">
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
                  <div className="h-full flex flex-col">
                    {file.type === 'text/html' && typeof content === 'string' && (
                      <div className="flex-1 relative">
                        {isEditing ? (
                          <div className="h-full flex flex-col">
                            <div className="sticky top-0 z-10 flex items-center gap-2 mb-4 p-2 bg-background/95 backdrop-blur-sm border-b">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewMode(v => v === 'code' ? 'preview' : 'code')}
                                className="min-w-[100px]"
                              >
                                {viewMode === 'code' ? (
                                  <><Eye className="h-4 w-4 mr-2" /> Preview</>
                                ) : (
                                  <><Code className="h-4 w-4 mr-2" /> Code</>
                                )}
                              </Button>
                            </div>
                            <Editor
                              height="100%"
                              defaultLanguage="html"
                              defaultValue={content}
                              theme={theme === 'dark' ? 'vs-dark' : 'light'}
                              onChange={(value) => setContent(value || '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                roundedSelection: false,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                formatOnPaste: true,
                                formatOnType: true
                              }}
                              className="flex-1 absolute inset-0"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="sticky top-0 z-10 flex items-center gap-2 mb-4 p-2 bg-background/95 backdrop-blur-sm border-b">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewMode(v => v === 'code' ? 'preview' : 'code')}
                                className="min-w-[100px]"
                              >
                                {viewMode === 'code' ? (
                                  <><Eye className="h-4 w-4 mr-2" /> Preview</>
                                ) : (
                                  <><Code className="h-4 w-4 mr-2" /> Code</>
                                )}
                              </Button>
                            </div>

                            {viewMode === 'preview' ? (
                              <div className="relative w-full h-[calc(100vh-12rem)]">
                                <iframe
                                  srcDoc={htmlContent || ''}
                                  className="w-full h-full rounded-lg border bg-white"
                                  sandbox="allow-same-origin"
                                  title="HTML Preview"
                                />
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                                {formatHTML(content).split('\n').map((line, i) => (
                                  <div key={i} className="px-2 hover:bg-muted-foreground/5">
                                    {line}
                                  </div>
                                ))}
                              </pre>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {file.type === 'application/json' && (
                      <div className="flex-1 relative">
                        {isEditing ? (
                          <div className="h-full flex flex-col">
                            <Editor
                              height="100%"
                              defaultLanguage="json"
                              defaultValue={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                              theme={theme === 'dark' ? 'vs-dark' : 'light'}
                              onChange={(value) => setContent(value || '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                roundedSelection: false,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                formatOnPaste: true,
                                formatOnType: true
                              }}
                              className="flex-1 absolute inset-0"
                            />
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                            {JSON.stringify(content, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {file.type.startsWith('image/') && content && (
                      <div className="relative">
                        <img
                          src={content}
                          alt={file.name}
                          className="max-w-full h-auto rounded-lg mx-auto"
                        />
                        {imageDimensions && (
                          <div className="absolute top-2 right-2 px-3 py-1.5 text-sm bg-background/80 backdrop-blur-sm rounded-md border">
                            {imageDimensions.width} × {imageDimensions.height}
                          </div>
                        )}
                      </div>
                    )}

                    {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && (
                      <VirtualizedList
                        data={content}
                        rowHeight={40}
                        overscan={5}
                        renderRow={({ index, style }) => (
                          <div style={style} className="flex gap-2 py-1 border-b">
                            {Object.values(content[index]).map((cell, i) => (
                              <div key={i} className="flex-1 truncate">
                                {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                              </div>
                            ))}
                          </div>
                        )}
                      />
                    )}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}