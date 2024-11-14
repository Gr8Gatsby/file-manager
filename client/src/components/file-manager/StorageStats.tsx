import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatSize } from "@/lib/compression";
import { useState } from "react";

interface StorageStatsProps {
  total: number;
  compressed: number;
}

export function StorageStats({ total, compressed }: StorageStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const savedPercentage =
    total === 0 ? 0 : Math.round((1 - compressed / total) * 100);

  return (
    <Card className="backdrop-blur-lg bg-background/95">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Storage Usage</CardTitle>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
              <span className="sr-only">Toggle stats</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">
                  Space Saved
                </span>
                <span className="text-sm font-medium text-foreground">
                  {savedPercentage}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full w-full flex-1 bg-foreground transition-all"
                  style={{
                    transform: `translateX(-${100 - savedPercentage}%)`,
                  }}
                />
              </div>
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
                  <div className="text-sm font-medium">Actual Size</div>
                  <div className="text-2xl font-bold">
                    {formatSize(compressed)}
                  </div>
                </motion.div>
              </div>
            </CollapsibleContent>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
