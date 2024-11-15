import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadZoneProps {
  onFileSelect: (files: FileList) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    const validFiles = Array.from(files).every(file => 
      file.type === 'text/csv' ||
      file.type === 'text/tab-separated-values' ||
      file.type === 'application/json' ||
      file.type === 'text/html' ||
      file.type.startsWith('image/')
    );

    if (!validFiles) {
      toast({
        title: "Invalid file type",
        description: "Only HTML, CSV, TSV, JSON, and image files are supported",
        variant: "destructive"
      });
      return;
    }

    onFileSelect(files);
  }, [onFileSelect, toast]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept=".html,.csv,.tsv,.json,image/*"
          onChange={(e) => e.target.files && onFileSelect(e.target.files)}
        />
        <label
          htmlFor="file-upload"
          className={`
            flex flex-col items-center justify-center w-full h-32
            border-2 border-dashed rounded-lg
            cursor-pointer transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              HTML, CSV, TSV, JSON, and image files
            </p>
          </div>
        </label>
      </motion.div>
    </AnimatePresence>
  );
}
