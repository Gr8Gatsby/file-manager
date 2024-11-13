import { motion } from 'framer-motion';
import { File, FileText, Image, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { formatSize } from '@/lib/compression';

interface FileGridProps {
  files: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    compressedSize: number;
  }>;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}

export function FileGrid({ files, onDelete, onSelect }: FileGridProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-12 h-12" />;
    if (type === 'text/csv' || type === 'text/tab-separated-values') return <FileText className="w-12 h-12" />;
    return <File className="w-12 h-12" />;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ scale: 1.02 }}
            className="cursor-pointer"
          >
            <Card className="backdrop-blur-lg bg-background/80">
              <CardHeader className="flex flex-row items-center justify-between">
                {getFileIcon(file.type)}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(file.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent onClick={() => onSelect(file.id)}>
                <h3 className="font-medium truncate">{file.name}</h3>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <div className="flex justify-between w-full">
                  <span>{formatSize(file.size)}</span>
                  <span>{Math.round((1 - file.compressedSize / file.size) * 100)}% compressed</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}