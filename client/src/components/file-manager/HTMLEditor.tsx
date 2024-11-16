import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
import { SchemaValidator } from '@/lib/schema-validator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { JsonAssociationManager } from './JsonAssociationManager';
import { fileDB } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
// import { JsonDataMapper, DataMapping } from './JsonDataMapper';  // Removed as per intention

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
  <script type="application/schema">
  {
    "name": z.string(),
    "description": z.string().optional(),
    "data": z.array(z.object({
      "id": z.number(),
      "value": z.string()
    }))
  }
  </script>
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
    .json-data-item.updated {
      animation: highlight 1s ease-out;
    }
    @keyframes highlight {
      0% { background: rgba(59, 130, 246, 0.5); }
      100% { background: transparent; }
    }
    .validation-status {
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    }
    .validation-error {
      color: #ef4444;
    }
    .validation-success {
      color: #22c55e;
    }
    .data-updated {
      animation: highlight 1s ease-out;
    }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <div id="data-container"></div>
  <script>
    window.addEventListener('message', function(event) {
      if (event.data.type === 'jsonData') {
        const { title, data } = event.data.payload;
        
        // Update indicator
        let indicator = document.querySelector('.json-data-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.className = 'json-data-indicator';
          document.body.appendChild(indicator);
        }

        const dataItem = document.createElement('div');
        dataItem.className = 'json-data-item updated';
        dataItem.textContent = title;
        
        indicator.innerHTML = '';
        indicator.appendChild(dataItem);
        
        // Dispatch event for any external handlers
        window.dispatchEvent(new CustomEvent('jsonDataReceived', {
          detail: { source: title, data }
        }));
      }
    });
  </script>
</body>
</html>`
    }
  });

  const content = watch('content');

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
        const validationResult = await validateJsonData(data, content);
        
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

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'previewUpdated') {
        const { dataCount } = event.data.payload;
        const validCount = Array.from(validationResults.values()).filter(r => r.isValid).length;
        
        toast({
          title: 'Preview Updated',
          description: `${dataCount} JSON data source${dataCount !== 1 ? 's' : ''} active (${validCount} valid)`,
          duration: 2000
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fileId, toast, validationResults]);

  const onSubmit = (data: FormData) => {
    const result = validateHTML(data.content);
    if (result.isValid) {
      const sanitized = sanitizeHTML(data.content);
      onSave(sanitized);
    }
  };

  const handleAssociationChange = () => {
    loadAssociatedData();
    setLastInjection(null);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-[80vh] flex flex-col gap-4">
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

      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50}>
          <div className="h-full flex flex-col overflow-hidden">
            <Textarea
              {...register('content')}
              className="flex-1 font-mono text-sm h-full overflow-y-auto resize-none"
              placeholder="Enter HTML content..."
            />
            {/* Removed JsonDataMapper as per intention */}
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
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={errors.length > 0}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}