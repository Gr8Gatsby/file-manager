import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  useEffect(() => {
    if (!file) return;

    const loadContent = async () => {
      if (file.type.startsWith('image/')) {
        setContent(URL.createObjectURL(file.data));
      } else if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
        const text = await file.data.text();
        Papa.parse(text, {
          complete: (results) => setContent(results.data),
          header: true,
        });
      } else if (file.type === 'application/json') {
        const text = await file.data.text();
        setContent(JSON.parse(text));
      }
    };

    loadContent();
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
              {file.type.startsWith('image/') && (
                <img
                  src={content as string}
                  alt={file.name}
                  className="max-w-full h-auto"
                />
              )}
              
              {file.type === 'text/csv' && Array.isArray(content) && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {Object.keys(content[0] || {}).map((header) => (
                          <th key={header} className="border p-2 text-left">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {content.map((row, i) => (
                        <tr key={i}>
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
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(content, null, 2)}
                </pre>
              )}
            </ScrollArea>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
