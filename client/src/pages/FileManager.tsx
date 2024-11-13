import { useState, useEffect } from 'react';
import { fileDB } from '@/lib/db';
import { compressBlob } from '@/lib/compression';
import { FileGrid } from '@/components/file-manager/FileGrid';
import { FilePreview } from '@/components/file-manager/FilePreview';
import { StorageStats } from '@/components/file-manager/StorageStats';
import { UploadZone } from '@/components/file-manager/UploadZone';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/hooks/use-toast';

export function FileManager() {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [storageStats, setStorageStats] = useState({ total: 0, compressed: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    const allFiles = await fileDB.getAllFiles();
    setFiles(allFiles);
    const usage = await fileDB.getStorageUsage();
    setStorageStats(usage);
  };

  const handleUpload = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      try {
        const compressed = await compressBlob(file);
        const id = crypto.randomUUID();
        
        await fileDB.addFile({
          id,
          name: file.name,
          type: file.type,
          size: file.size,
          compressedSize: compressed.size,
          data: compressed,
          createdAt: new Date(),
        });

        toast({
          title: "File uploaded",
          description: `${file.name} has been successfully uploaded and compressed.`
        });
      } catch (error) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }
    
    loadFiles();
  };

  const handleDelete = async (id: string) => {
    await fileDB.deleteFile(id);
    loadFiles();
    toast({
      title: "File deleted",
      description: "The file has been permanently deleted."
    });
  };

  const handleFileSelect = async (id: string) => {
    const file = await fileDB.getFile(id);
    setSelectedFile(file);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur-lg border-b border-border bg-background/95 dark:bg-background/90">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground dark:text-white">File Manager</h1>
          <div className="flex items-center gap-2 bg-muted dark:bg-muted/20 rounded-lg px-3 py-2">
            <span className="text-sm text-muted-foreground dark:text-muted-foreground/90">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <UploadZone onFileSelect={handleUpload} />
            </div>
            <div>
              <StorageStats
                total={storageStats.total}
                compressed={storageStats.compressed}
              />
            </div>
          </div>

          <FileGrid
            files={files}
            onDelete={handleDelete}
            onSelect={handleFileSelect}
          />
        </div>
      </main>

      <FilePreview
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  );
}
