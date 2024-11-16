import { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
import { SchemaValidator } from '@/lib/schema-validator';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { JsonAssociationManager } from './JsonAssociationManager';
import { fileDB } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface HTMLEditorProps {
  fileId: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  initialContent?: string;
}

interface FormData {
  content: string;
}

export function HTMLEditor({ fileId, onSave, onCancel, initialContent = '' }: HTMLEditorProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [associatedData, setAssociatedData] = useState<Array<{ name: string; data: any }>>([]);
  const [lastInjection, setLastInjection] = useState<{ name: string; timestamp: number } | null>(null);
  const [validationResults, setValidationResults] = useState<Map<string, { isValid: boolean; errors: string[] }>>(new Map());

  const validateJsonData = async (jsonData: any, htmlContent: string) => {
    return SchemaValidator.validateJsonWithHTML(jsonData, htmlContent);
  };

  const loadAssociatedData = async () => {
    const associated = await fileDB.getAssociatedFiles(fileId);
    const dataPromises = associated.map(async (file) => {
      if (!file.data) return null;
      const chunks: Uint8Array[] = [];
      const reader = file.data.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const blob = new Blob(chunks);
      const text = await blob.text();
      
      try {
        const data = JSON.parse(text);
        const validationResult = await validateJsonData(data, preview);
        
        setValidationResults(prev => new Map(prev).set(file.name, {
          isValid: validationResult.isValid,
          errors: validationResult.errors
        }));

        return {
          name: file.name,
          data,
          isValid: validationResult.isValid,
          validationErrors: validationResult.errors
        };
      } catch (error) {
        console.error('Error parsing JSON:', error);
        return null;
      }
    });
    
    const data = await Promise.all(dataPromises);
    setAssociatedData(data.filter((d): d is { name: string; data: any; isValid: boolean; validationErrors: string[] } => d !== null));
  };

  useEffect(() => {
    const validateContent = async () => {
      setIsValidating(true);
      const result = validateHTML(initialContent);
      setErrors(result.errors);
      
      if (result.isValid) {
        const sanitized = sanitizeHTML(initialContent);
        setPreview(sanitized);
      }
      setIsValidating(false);
    };

    validateContent();
  }, [initialContent]);

  useEffect(() => {
    loadAssociatedData();
  }, [fileId, preview]);

  const handleAssociationChange = () => {
    loadAssociatedData();
    setLastInjection(null);
  };

  return (
    <div className="h-[80vh] flex flex-col gap-4">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
          <span>Associated JSON Data Files</span>
          <div className="flex items-center gap-2">
            {lastInjection && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                Last updated: {lastInjection.name}
              </span>
            )}
            {validationResults.size > 0 && (
              <Badge variant={
                Array.from(validationResults.values()).every(r => r.isValid)
                  ? "success"
                  : "destructive"
              }>
                {Array.from(validationResults.values()).filter(r => r.isValid).length}/{validationResults.size} Valid
              </Badge>
            )}
          </div>
        </h3>
        <JsonAssociationManager 
          htmlFileId={fileId} 
          onAssociationChange={handleAssociationChange}
        />
        {Array.from(validationResults.entries()).map(([name, result]) => (
          !result.isValid && (
            <Alert variant="destructive" className="mt-2" key={name}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{name}: Validation Failed</p>
                <ul className="list-disc pl-4 mt-1">
                  {result.errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )
        ))}
      </div>

      <div className="flex-1 border rounded-lg bg-background">
        {isValidating ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : errors.length > 0 ? (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>
              <ul className="list-disc pl-4">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <iframe
            srcDoc={preview}
            className="w-full h-full rounded-lg"
            sandbox="allow-same-origin allow-scripts"
            title="HTML Preview"
            onLoad={(e) => {
              const iframe = e.currentTarget;
              associatedData.forEach(data => {
                const message = {
                  type: 'jsonData',
                  payload: {
                    title: data.name,
                    data: data.data
                  }
                };
                iframe.contentWindow?.postMessage(message, '*');
                
                setLastInjection({ name: data.name, timestamp: Date.now() });
                
                toast({
                  title: 'Data Injected',
                  description: `${data.name} data has been injected`,
                  duration: 3000
                });
              });
            }}
          />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(preview)} disabled={errors.length > 0}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}