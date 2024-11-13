import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatSize } from '@/lib/compression';
import { useState } from 'react';

interface StorageStatsProps {
  total: number;
  compressed: number;
}

export function StorageStats({ total, compressed }: StorageStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const savedPercentage = total === 0 ? 0 : Math.round((1 - compressed / total) * 100);
  
  return (
    <Card className="backdrop-blur-lg bg-background/95">
      <Collapsible defaultOpen={false} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Storage Usage</CardTitle>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-9 p-0"
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              <span className="sr-only">Toggle stats</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Space Saved</span>
                <span className="text-sm font-medium">{savedPercentage}%</span>
              </div>
              <Progress 
                value={savedPercentage} 
                className="h-2.5 bg-muted/50"
                style={{
                  '--progress-fill': 'hsl(var(--primary))'
                }}
              />
            </div>
            
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 bg-muted/20 border border-border"
                >
                  <div className="text-sm font-medium">Original Size</div>
                  <div className="text-2xl font-bold">{formatSize(total)}</div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 bg-muted/20 border border-border"
                >
                  <div className="text-sm font-medium">Compressed Size</div>
                  <div className="text-2xl font-bold">{formatSize(compressed)}</div>
                </motion.div>
              </div>
            </CollapsibleContent>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
