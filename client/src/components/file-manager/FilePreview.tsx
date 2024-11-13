import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
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

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<string | Array<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const loadContent = async () => {
      try {
        console.log(`Loading preview for file: ${file.name} (${file.type})`);
        
        if (file.type.startsWith('image/')) {
          console.log('Processing image file');
          const url = URL.createObjectURL(file.data);
          setContent(url);
          console.log('Image blob URL created successfully');
        } else {
          // For text-based files, decompress the blob first
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
                console.log(`Parsed ${results.data.length} rows successfully`);
                setContent(results.data);
              },
              header: true,
              error: (error) => {
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
        
        setError(null);
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file content');
        setContent(null);
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
      >
        <div className="container max-w-3xl h-full py-8">
          <div className="bg-background rounded-lg shadow-lg h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">{file.name}</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  {file.type.startsWith('image/') && (
                    <img
                      src={content as string}
                      alt={file.name}
                      className="max-w-full h-auto"
                      onError={() => setError('Failed to load image')}
                    />
                  )}
                  
                  {file.type === 'text/csv' && Array.isArray(content) && content.length > 0 && (
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
                                  {cell as string}
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
