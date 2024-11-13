import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSize } from '@/lib/compression';

interface StorageStatsProps {
  total: number;
  compressed: number;
}

export function StorageStats({ total, compressed }: StorageStatsProps) {
  const savedPercentage = Math.round((1 - compressed / total) * 100) || 0;
  
  return (
    <Card className="backdrop-blur-lg bg-background/80">
      <CardHeader>
        <CardTitle>Storage Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Space Saved</span>
              <span className="text-sm text-foreground">{savedPercentage}%</span>
            </div>
            <Progress 
              value={savedPercentage} 
              className="h-2 bg-muted-foreground/20 dark:bg-muted" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg p-3 bg-primary/10"
            >
              <div className="text-sm font-medium">Original Size</div>
              <div className="text-2xl font-bold">{formatSize(total)}</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg p-3 bg-primary/10"
            >
              <div className="text-sm font-medium">Compressed Size</div>
              <div className="text-2xl font-bold">{formatSize(compressed)}</div>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
