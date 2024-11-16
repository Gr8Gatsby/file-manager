import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// interface JsonDataMapperProps {
//   jsonData: any;
//   onMappingChange: (mapping: DataMapping[]) => void;
//   initialMapping?: DataMapping[];
// }

// interface DataMapping {
//   jsonPath: string;
//   targetSelector: string;
//   updateType: 'text' | 'attribute' | 'html';
//   attributeName?: string;
// }

// export function JsonDataMapper({ jsonData, onMappingChange, initialMapping = [] }: JsonDataMapperProps) {
//   const [mappings, setMappings] = useState<DataMapping[]>(initialMapping);
//   const [availablePaths, setAvailablePaths] = useState<string[]>([]);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     // Extract all possible JSON paths
//     const extractPaths = (obj: any, prefix = ''): string[] => {
//       if (!obj || typeof obj !== 'object') return [prefix];
      
//       return Object.entries(obj).flatMap(([key, value]) => {
//         const newPrefix = prefix ? `${prefix}.${key}` : key;
//         if (Array.isArray(value)) {
//           return [newPrefix, `${newPrefix}[*]`];
//         }
//         return extractPaths(value, newPrefix);
//       });
//     };

//     try {
//       const paths = extractPaths(jsonData);
//       setAvailablePaths(paths.filter(Boolean));
//       setError(null);
//     } catch (err) {
//       setError('Failed to parse JSON structure');
//     }
//   }, [jsonData]);

//   const addMapping = () => {
//     const newMapping: DataMapping = {
//       jsonPath: '',
//       targetSelector: '',
//       updateType: 'text'
//     };
//     setMappings([...mappings, newMapping]);
//     onMappingChange([...mappings, newMapping]);
//   };

//   const updateMapping = (index: number, field: keyof DataMapping, value: string) => {
//     const updatedMappings = mappings.map((mapping, i) => {
//       if (i === index) {
//         return { ...mapping, [field]: value };
//       }
//       return mapping;
//     });
//     setMappings(updatedMappings);
//     onMappingChange(updatedMappings);
//   };

//   const removeMapping = (index: number) => {
//     const updatedMappings = mappings.filter((_, i) => i !== index);
//     setMappings(updatedMappings);
//     onMappingChange(updatedMappings);
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <h3 className="text-sm font-medium">Data Mapping Configuration</h3>
//         <Button onClick={addMapping} size="sm" className="gap-1">
//           <Plus className="h-4 w-4" /> Add Mapping
//         </Button>
//       </div>

//       {error && (
//         <Alert variant="destructive">
//           <AlertCircle className="h-4 w-4" />
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       <ScrollArea className="h-[300px] rounded-md border p-4">
//         <div className="space-y-6">
//           {mappings.map((mapping, index) => (
//             <div key={index} className="grid gap-4 p-4 border rounded-lg relative">
//               <Button
//                 variant="ghost"
//                 size="icon"
//                 className="absolute right-2 top-2 h-6 w-6"
//                 onClick={() => removeMapping(index)}
//               >
//                 <Trash2 className="h-4 w-4" />
//               </Button>

//               <div className="grid gap-2">
//                 <Label>JSON Path</Label>
//                 <Select
//                   value={mapping.jsonPath}
//                   onValueChange={(value) => updateMapping(index, 'jsonPath', value)}
//                 >
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select JSON path" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {availablePaths.map((path) => (
//                       <SelectItem key={path} value={path}>
//                         {path}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="grid gap-2">
//                 <Label>Target Element Selector</Label>
//                 <Input
//                   placeholder="CSS selector (e.g., #target-id, .target-class)"
//                   value={mapping.targetSelector}
//                   onChange={(e) => updateMapping(index, 'targetSelector', e.target.value)}
//                 />
//               </div>

//               <div className="grid gap-2">
//                 <Label>Update Type</Label>
//                 <Select
//                   value={mapping.updateType}
//                   onValueChange={(value: 'text' | 'attribute' | 'html') => 
//                     updateMapping(index, 'updateType', value)
//                   }
//                 >
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="text">Text Content</SelectItem>
//                     <SelectItem value="html">HTML Content</SelectItem>
//                     <SelectItem value="attribute">Attribute</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               {mapping.updateType === 'attribute' && (
//                 <div className="grid gap-2">
//                   <Label>Attribute Name</Label>
//                   <Input
//                     placeholder="Enter attribute name"
//                     value={mapping.attributeName || ''}
//                     onChange={(e) => updateMapping(index, 'attributeName', e.target.value)}
//                   />
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       </ScrollArea>
//     </div>
//   );
// }

export default function HTMLEditor({ data, onChange }: { data: string; onChange: (value: string) => void }) {
  const [content, setContent] = useState(data);

  useEffect(() => {
    setContent(data);
  }, [data]);

  const handleChange = (value: string) => {
    setContent(value);
    onChange(value);
  };

  return (
    <div className="relative flex flex-col gap-4">
      <Label htmlFor="html-editor">HTML Editor</Label>
      <textarea
        id="html-editor"
        className="resize-none rounded-md border p-4 focus:outline-none"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

export default function FilePreview({ jsonData, onFileChange }: { jsonData: any; onFileChange: (file: File) => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file);
    if (file) {
      onFileChange(file);
    }
  };

  const handleDownload = () => {
    if (!selectedFile) return;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(selectedFile);
    link.download = selectedFile.name;
    link.click();
  };

  const displayJSON = () => {
    if (!selectedFile) return;
    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          <h3 className="text-sm font-medium">Preview JSON Data</h3>
          <Button onClick={handleDownload} size="sm" className="gap-1">
            Download
          </Button>
        </div>
        <div className="p-4 rounded-md border">
          <pre className="text-xs font-mono">
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col gap-4">
      <Label htmlFor="file-input">Choose a file</Label>
      <Input type="file" id="file-input" onChange={handleFileChange} />
      {selectedFile && displayJSON()}
    </div>
  );
}