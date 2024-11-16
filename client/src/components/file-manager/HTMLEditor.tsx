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
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    // Suppress ResizeObserver warnings
    const resizeObserverError = console.error;
    console.error = (...args: any) => {
      if (args[0]?.includes?.('ResizeObserver')) return;
      resizeObserverError(...args);
    };
    
    return () => {
      console.error = resizeObserverError;
    };
  }, []);

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
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 200px;
      overflow-y: auto;
    }
    .json-data-item {
      padding: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    .json-data-item:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <script>
    // Store all JSON data in a global object
    window.jsonDataStore = {};

    window.addEventListener('message', function(event) {
      if (event.data.type === 'jsonData') {
        // Store the data
        window.jsonDataStore[event.data.payload.title] = event.data.payload.data;
        
        // Update or create data indicator
        let indicator = document.querySelector('.json-data-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.className = 'json-data-indicator';
          document.body.appendChild(indicator);
        }

        // Update indicator content
        indicator.innerHTML = Object.keys(window.jsonDataStore)
          .map(key => \`<div class="json-data-item">Data from: \${key}</div>\`)
          .join('');
        
        // Dispatch custom event for each data update
        const dataEvent = new CustomEvent('jsonDataReceived', {
          detail: {
            source: event.data.payload.title,
            data: event.data.payload.data,
            allData: window.jsonDataStore
          }
        });
        window.dispatchEvent(dataEvent);
      }
    });

    // Helper function to access data from any JSON file
    window.getJsonData = function(fileName) {
      return window.jsonDataStore[fileName];
    };
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
        <h3 className="text-sm font-medium mb-2">Associated JSON Data Files</h3>
        <JsonAssociationManager 
          htmlFileId={fileId} 
          onAssociationChange={handleAssociationChange}
        />
      </div>

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50}>
          <div className="h-full flex flex-col overflow-y-auto">
            <Textarea
              {...register('content')}
              className="flex-1 font-mono text-sm min-h-[400px] resize-none"
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
                  // Inject all associated data
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
                    
                    toast({
                      title: 'Data Injected',
                      description: `Sending:
{
  type: 'jsonData',
  payload: {
    title: '${data.name}',
    data: ${JSON.stringify(data.data).substring(0, 100)}...
  }
}`
                    });
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
