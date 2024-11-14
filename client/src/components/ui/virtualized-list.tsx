import * as React from "react";
import { cn } from "@/lib/utils";

interface VirtualizedListProps {
  data: any[];
  rowHeight: number;
  overscan?: number;
  renderRow: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
  className?: string;
}

export function VirtualizedList({
  data,
  rowHeight,
  overscan = 5,
  renderRow,
  className
}: VirtualizedListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = data.length * rowHeight;
  const containerHeight = containerRef.current?.clientHeight || 0;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    data.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  const visibleRows = React.useMemo(() => {
    const rows = [];
    for (let i = startIndex; i < endIndex; i++) {
      rows.push(
        renderRow({
          index: i,
          style: {
            position: 'absolute',
            top: i * rowHeight,
            width: '100%',
            height: rowHeight
          }
        })
      );
    }
    return rows;
  }, [startIndex, endIndex, rowHeight, renderRow]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn("relative overflow-auto w-full", className)}
      style={{ height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleRows}
      </div>
    </div>
  );
}
