import { motion } from 'framer-motion';
import { File, FileText, Image, Trash2, Edit2, Pencil } from 'lucide-react';
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
    createdAt: Date;
  }>;
  onDelete: (id: string) => void;
  onSelect: (id: string, editMode?: boolean) => void;
  onRename: (id: string, name: string) => void;
}

export function FileGrid({ files, onDelete, onSelect, onRename }: FileGridProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getFileIcon = (type: string) => {
    const iconClass = "w-6 h-6 text-foreground dark:text-primary";
    if (type.startsWith('image/')) 
      return <Image className={iconClass} />;
    if (type === 'text/csv' || type === 'text/tab-separated-values') 
      return <FileText className={iconClass} />;
    return <File className={iconClass} />;
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
        {files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ scale: 1.02 }}
          >
            <Card 
              className="backdrop-blur-lg bg-background/80 hover:bg-background/90 cursor-pointer transition-colors"
              onClick={() => onSelect(file.id, false)}
            >
              <CardHeader className="flex flex-row items-center justify-between p-1.5">
                {getFileIcon(file.type)}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename(file.id, file.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {(file.type === 'application/json' || file.type === 'text/html') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(file.id, true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(file.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-1.5 pb-1.5 pt-0">
                <h3 className="font-medium text-xs truncate text-foreground">{file.name}</h3>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-muted-foreground/90">{formatSize(file.size)}</span>
                  <span className="text-[10px] text-muted-foreground/90">
                    {Math.round((1 - file.compressedSize / file.size) * 100)}% saved
                  </span>
                </div>
              </CardContent>
              <CardFooter className="px-1.5 py-0.5 text-[10px] text-muted-foreground/80 border-t">
                {new Date(file.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
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
