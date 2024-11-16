import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader2, Eye, Code, Edit2, Save, Edit3 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { validateHTML, sanitizeHTML, formatHTML } from '@/lib/html-utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { compressBlob } from '@/lib/compression';
import { fileDB } from '@/lib/db';
import Papa from 'papaparse';
import { HTMLEditor } from './HTMLEditor';

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
  onRename?: (id: string, name: string) => void;
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

export function FilePreview({ file, onClose, isEditing, onEditingChange, onRename }: FilePreviewProps) {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [content, setContent] = useState<any[] | string | null>(null);
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [htmlMode, setHtmlMode] = useState<'safe' | 'raw'>('safe');
  const [isRenaming, setIsRenaming] = useState(false);
  const [jsonFiles, setJsonFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedJson, setSelectedJson] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fileNameRef = useRef<HTMLHeadingElement>(null);

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
    const loadJsonFiles = async () => {
      const allFiles = await fileDB.getAllFiles();
      setJsonFiles(allFiles.filter(f => f.type === 'application/json'));
    };
    loadJsonFiles();
  }, []);

  const injectJsonData = async (jsonId: string) => {
    const jsonFile = await fileDB.getFile(jsonId);
    if (!jsonFile) return;
    
    try {
      const chunks: Uint8Array[] = [];
      const reader = jsonFile.data.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const blob = new Blob(chunks);
      const text = await blob.text();
      const jsonData = JSON.parse(text);

      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        // Send data to iframe
        iframe.contentWindow.postMessage({
          type: 'jsonData',
          payload: {
            title: jsonFile.name,
            data: jsonData
          }
        }, '*');
        
        toast({
          title: 'Data Injected',
          description: `postMessage: {
  type: 'jsonData',
  payload: {
    title: '${jsonFile.name}',
    data: /* truncated for display */
  }
}`
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process JSON data',
        variant: 'destructive'
      });
    }
  };

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
        finalContent = formatHTML(content);
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

  const startRename = useCallback(() => {
    if (!file || !onRename || isRenaming || !fileNameRef.current) return;
  
    setIsRenaming(true);
    const fileName = file.name;
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  
    const input = document.createElement('input');
    input.value = nameWithoutExt;
    input.className = 'text-lg font-semibold w-full p-1 rounded border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  
    const handleSave = () => {
      const newName = input.value + extension;
      if (newName !== fileName) {
        onRename(file.id, newName);
      }
      setIsRenaming(false);
      fileNameRef.current!.textContent = fileName;
      input.remove();
    };
  
    input.onblur = handleSave;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setIsRenaming(false);
        fileNameRef.current!.textContent = fileName;
        input.remove();
      }
    };
  
    fileNameRef.current.textContent = '';
    fileNameRef.current.appendChild(input);
    input.focus();
    input.select();
  }, [file, onRename, isRenaming]);

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
        const chunks: Uint8Array[] = [];
        const reader = file.data.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
        let totalSize = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          totalSize += value.byteLength;
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
          const formatted = formatHTML(text);
          setContent(formatted);
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
              setContent(results.data);
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
            setContent(JSON.stringify(jsonData, null, 2));
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

  const canEdit = file && (
    (file.type === 'text/html' && typeof content === 'string') ||
    (file.type === 'application/json' && typeof content === 'string')
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
              <div className="flex items-center gap-2 flex-1 pr-4">
                <h2 
                  ref={fileNameRef}
                  className="text-lg font-semibold truncate flex-1 cursor-text"
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!file || !onRename || isRenaming) return;
                    startRename();
                  }}
                >
                  {file.name}
                </h2>
                {onRename && !isRenaming && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startRename()}
                    className="h-8 w-8 p-0"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="sr-only">Rename</span>
                  </Button>
                )}
              </div>
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
                    {file.type === 'text/html' && (
                      <div className="flex-1 relative">
                        {isEditing ? (
                          <HTMLEditor
                            fileId={file.id}
                            initialContent={content as string}
                            onSave={handleSave}
                            onCancel={() => {
                              onEditingChange?.(false);
                              setError(null);
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

                              {viewMode === 'preview' && (
                                <Select 
                                  value={selectedJson || ''} 
                                  onValueChange={(value) => {
                                    setSelectedJson(value);
                                    if (value) injectJsonData(value);
                                  }}
                                >
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select JSON data" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {jsonFiles.map((jsonFile) => (
                                      <SelectItem key={jsonFile.id} value={jsonFile.id}>
                                        {jsonFile.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {viewMode === 'code' ? (
                              <Editor
                                height="100%"
                                defaultLanguage="html"
                                value={content as string}
                                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                                options={{
                                  readOnly: true,
                                  minimap: { enabled: false },
                                  scrollBeyondLastLine: false,
                                }}
                              />
                            ) : (
                              <iframe
                                srcDoc={sanitizedContent || undefined}
                                className="w-full h-full rounded-lg"
                                sandbox="allow-same-origin allow-scripts"
                                title="HTML Preview"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {file.type === 'application/json' && (
                      <Editor
                        height="100%"
                        defaultLanguage="json"
                        value={content as string}
                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        options={{
                          readOnly: !isEditing,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                        }}
                        onChange={(value) => {
                          if (isEditing) {
                            setContent(value || '');
                            try {
                              JSON.parse(value || '');
                              setError(null);
                            } catch (err) {
                              setError('Invalid JSON format');
                            }
                          }
                        }}
                      />
                    )}

                    {file.type === 'text/csv' || file.type === 'text/tab-separated-values' ? (
                      <VirtualizedList
                        data={content as any[]}
                        rowHeight={24}
                        overscan={5}
                      />
                    ) : file.type.startsWith('image/') ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
                        <img
                          src={content as string}
                          alt={file.name}
                          className="max-w-full max-h-full object-contain"
                        />
                        {imageDimensions && (
                          <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm text-xs px-2 py-1 rounded">
                            {imageDimensions.width} × {imageDimensions.height}
                          </div>
                        )}
                      </div>
                    ) : null}
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