import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { validateHTML, sanitizeHTML } from '@/lib/html-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface HTMLEditorProps {
  onSave: (content: string) => void;
  onCancel: () => void;
  initialContent?: string;
}

interface FormData {
  content: string;
}

export function HTMLEditor({ onSave, onCancel, initialContent = '' }: HTMLEditorProps) {
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      content: initialContent || `<!DOCTYPE html>
<html>
<head>
  <title>New Document</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`
    }
  });

  const content = watch('content');

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

  const onSubmit = (data: FormData) => {
    const result = validateHTML(data.content);
    if (result.isValid) {
      const sanitized = sanitizeHTML(data.content);
      onSave(sanitized);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-[80vh] flex flex-col gap-4">
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
                srcDoc={preview}
                className="w-full h-full rounded-lg"
                sandbox="allow-same-origin"
                title="HTML Preview"
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
