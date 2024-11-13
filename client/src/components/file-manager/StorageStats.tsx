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
  const [isOpen, setIsOpen] = useState(true);
  const savedPercentage = Math.round((1 - compressed / total) * 100) || 0;
  
  return (
    <Card className="backdrop-blur-lg bg-background/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">Storage Usage</CardTitle>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-9 p-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
            <span className="sr-only">Toggle stats</span>
          </Button>
        </CollapsibleTrigger>
      </CardHeader>
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Space Saved</span>
                <span className="text-sm font-medium text-primary">{savedPercentage}%</span>
              </div>
              <Progress 
                value={savedPercentage} 
                className="h-2.5 bg-muted" 
                indicatorClassName="bg-primary"
              />
            </div>
            
            <CollapsibleContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 bg-muted/50"
                >
                  <div className="text-sm font-medium text-muted-foreground">Original Size</div>
                  <div className="text-2xl font-bold text-foreground">{formatSize(total)}</div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 bg-primary/10"
                >
                  <div className="text-sm font-medium text-muted-foreground">Compressed Size</div>
                  <div className="text-2xl font-bold text-primary">{formatSize(compressed)}</div>
                </motion.div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
