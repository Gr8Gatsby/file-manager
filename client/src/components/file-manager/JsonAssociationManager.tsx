import { useEffect, useState } from 'react';
import { fileDB } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JsonAssociationManagerProps {
  htmlFileId: string;
  onAssociationChange?: () => void;
}

export function JsonAssociationManager({ htmlFileId, onAssociationChange }: JsonAssociationManagerProps) {
  const [jsonFiles, setJsonFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [associatedFiles, setAssociatedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      try {
        const allFiles = await fileDB.getAllFiles();
        const jsonFilesList = allFiles
          .filter(f => f.type === 'application/json')
          .map(f => ({ id: f.id, name: f.name }));
        setJsonFiles(jsonFilesList);

        const associated = await fileDB.getAssociatedFiles(htmlFileId);
        setAssociatedFiles(associated.map(f => ({ id: f.id, name: f.name })));
      } catch (error) {
        console.error('Error loading files:', error);
      }
      setLoading(false);
    };

    loadFiles();
  }, [htmlFileId]);

  const handleAssociate = async (jsonFileId: string) => {
    try {
      await fileDB.associateFiles(htmlFileId, jsonFileId);
      const associated = await fileDB.getAssociatedFiles(htmlFileId);
      setAssociatedFiles(associated.map(f => ({ id: f.id, name: f.name })));
      onAssociationChange?.();
    } catch (error) {
      console.error('Error associating files:', error);
    }
  };

  const handleRemoveAssociation = async (jsonFileId: string) => {
    try {
      await fileDB.removeAssociation(htmlFileId, jsonFileId);
      setAssociatedFiles(prev => prev.filter(f => f.id !== jsonFileId));
      onAssociationChange?.();
    } catch (error) {
      console.error('Error removing association:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {associatedFiles.map((file) => (
          <Badge key={file.id} variant="secondary" className="gap-2">
            {file.name}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemoveAssociation(file.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Select
        onValueChange={handleAssociate}
        value=""
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Associate JSON file" />
        </SelectTrigger>
        <SelectContent>
          {jsonFiles
            .filter(f => !associatedFiles.some(af => af.id === f.id))
            .map((file) => (
              <SelectItem key={file.id} value={file.id}>
                {file.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
