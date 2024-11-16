import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2, Eye, Code, Edit2, Save } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
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
  const { theme } = useTheme();
  const [content, setContent] = useState<any[] | string | null>(null);
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [htmlMode, setHtmlMode] = useState<'safe' | 'raw'>('safe');
  const [isEditing, setIsEditing] = useState(false);
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

  const getHtmlWithInjectedData = useCallback((htmlContent: string, rawContent: any) => {
    const injectData = {
      data: rawContent,
      __isSecureContext: true
    };

    const htmlWithData = `
      ${htmlContent}
      <script>
        window.__INJECTED_DATA__ = ${JSON.stringify(injectData)};
        
        // Example usage documentation
        /*
          This HTML file can access injected JSON data through window.__INJECTED_DATA__.data
          
          Example usage:
          document.addEventListener('DOMContentLoaded', () => {
            const data = window.__INJECTED_DATA__.data;
            
            if (data) {
              // Example: Create a list from JSON array
              if (Array.isArray(data)) {
                const list = document.createElement('ul');
                data.forEach(item => {
                  const li = document.createElement('li');
                  li.textContent = JSON.stringify(item);
                  list.appendChild(li);
                });
                document.body.appendChild(list);
              }
              
              // Example: Display JSON object
              const pre = document.createElement('pre');
              pre.textContent = JSON.stringify(data, null, 2);
              document.body.appendChild(pre);
            }
          });
        */
      </script>
    `;

    return htmlWithData;
  }, []);

  const handleSave = async () => {
    if (!file || typeof content !== 'string') return;
    
    try {
      let finalContent = content;
      if (file.type === 'application/json') {
        // Validate and format JSON before saving
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
      
      setIsEditing(false);
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
    ? getHtmlWithInjectedData(htmlMode === 'raw' ? content : sanitizedContent || '', content)
    : null;

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
                {(file.type === 'text/html' || file.type === 'application/json') && typeof content === 'string' && (
                  <>
                    {isEditing && (
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
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className="gap-2"
                    >
                      {isEditing ? (
                        <><Eye className="h-4 w-4" /> Preview</>
                      ) : (
                        <><Edit2 className="h-4 w-4" /> Edit</>
                      )}
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                      <div className="relative">
                        {isEditing ? (
                          <Editor
                            height="70vh"
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
                              automaticLayout: true
                            }}
                          />
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

                              <div className="flex items-center gap-2 ml-4">
                                <span className="text-sm text-muted-foreground">Safe</span>
                                <Switch
                                  checked={htmlMode === 'raw'}
                                  onCheckedChange={(checked) => setHtmlMode(checked ? 'raw' : 'safe')}
                                />
                                <span className="text-sm text-muted-foreground">Raw</span>
                              </div>
                            </div>

                            {viewMode === 'preview' ? (
                              <div className="relative w-full h-[calc(100vh-12rem)]">
                                <div className="absolute top-2 right-2 px-3 py-1.5 text-sm bg-background/80 backdrop-blur-sm rounded-md border">
                                  Previewing {htmlMode} HTML
                                </div>
                                <iframe
                                  srcDoc={htmlContent}
                                  className="w-full h-full rounded-lg border bg-white"
                                  sandbox={htmlMode === 'raw' ? 'allow-same-origin allow-scripts' : 'allow-same-origin'}
                                  title="HTML Preview"
                                />
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                                {htmlContent?.split('\n').map((line, i) => (
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
                    
                    {file.type === 'application/json' && (
                      <div className="relative">
                        {isEditing ? (
                          <Editor
                            height="70vh"
                            defaultLanguage="json"
                            defaultValue={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                            theme={theme === 'dark' ? 'vs-dark' : 'light'}
                            onChange={(value) => {
                              try {
                                // Validate JSON as user types
                                if (value) {
                                  JSON.parse(value);
                                  setError(null);
                                }
                                setContent(value || '');
                              } catch (err) {
                                setError('Invalid JSON format');
                              }
                            }}
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
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                            {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {(file.type === 'text/csv' || file.type === 'text/tab-separated-values') && Array.isArray(content) && (
                      <VirtualizedList
                        data={content}
                        rowHeight={40}
                        overscan={5}
                        renderRow={({ index, style }) => (
                          <div key={index} style={style} className="flex gap-2 py-1 border-b">
                            {Object.values(content[index]).map((cell, i) => (
                              <div key={i} className="flex-1 truncate">
                                {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                              </div>
                            ))}
                          </div>
                        )}
                      />
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