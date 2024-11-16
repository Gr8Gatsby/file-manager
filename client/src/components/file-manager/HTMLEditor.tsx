import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { JsonAssociationManager } from './JsonAssociationManager';
import { fileDB } from '@/lib/db';

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
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [associatedData, setAssociatedData] = useState<Array<{ name: string; data: any }>>([]);

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      content: initialContent || `<!DOCTYPE html>
<html>
<head>
  <title>New Document</title>
  <style>
    .json-data-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <script>
    window.addEventListener('message', function(event) {
      if (event.data.type === 'jsonData') {
        // Create or update data indicator
        let indicator = document.querySelector('.json-data-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.className = 'json-data-indicator';
          document.body.appendChild(indicator);
        }
        indicator.textContent = 'Data from: ' + event.data.payload.title;
        
        // Make data available globally
        window[event.data.payload.title] = event.data.payload.data;
        
        // Dispatch custom event
        const dataEvent = new CustomEvent('jsonDataReceived', {
          detail: event.data.payload
        });
        window.dispatchEvent(dataEvent);
      }
    });
  </script>
</body>
</html>`
    }
  });

  const content = watch('content');

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
      return {
        name: file.name,
        data: JSON.parse(text)
      };
    });
    
    const data = await Promise.all(dataPromises);
    setAssociatedData(data.filter((d): d is { name: string; data: any } => d !== null));
  };

  useEffect(() => {
    const validateContent = async () => {
      setIsValidating(true);
      const result = validateHTML(content);
      setErrors(result.errors);
      
      if (result.isValid) {
        const sanitized = sanitizeHTML(content);
        setPreview(sanitized);
      }
      setIsValidating(false);
    };

    validateContent();
  }, [content]);

  useEffect(() => {
    loadAssociatedData();
  }, [fileId]);

  const onSubmit = (data: FormData) => {
    const result = validateHTML(data.content);
    if (result.isValid) {
      const sanitized = sanitizeHTML(data.content);
      onSave(sanitized);
    }
  };

  const handleAssociationChange = () => {
    loadAssociatedData();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-[80vh] flex flex-col gap-4">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="text-sm font-medium mb-2">Associated JSON Data</h3>
        <JsonAssociationManager 
          htmlFileId={fileId} 
          onAssociationChange={handleAssociationChange}
        />
      </div>

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50}>
          <div className="h-full flex flex-col">
            <Textarea
              {...register('content')}
              className="flex-1 font-mono text-sm resize-none"
              placeholder="Enter HTML content..."
            />
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={50}>
          <div className="h-full border rounded-lg bg-background">
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
                srcDoc={preview || undefined}
                className="w-full h-full rounded-lg"
                sandbox="allow-same-origin allow-scripts"
                title="HTML Preview"
                onLoad={(e) => {
                  // Inject associated data
                  const iframe = e.currentTarget;
                  associatedData.forEach(data => {
                    iframe.contentWindow?.postMessage({
                      type: 'jsonData',
                      payload: {
                        title: data.name,
                        data: data.data
                      }
                    }, '*');
                  });
                }}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={errors.length > 0}>
          Save
        </Button>
      </div>
    </form>
  );
}
