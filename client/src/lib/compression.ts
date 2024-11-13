export async function compressBlob(blob: Blob): Promise<Blob> {
  const compressedStream = new CompressionStream('gzip');
  const writer = compressedStream.writable.getWriter();
  writer.write(await blob.arrayBuffer());
  writer.close();
  
  return new Response(compressedStream.readable).blob();
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function calculateCompressionRatio(original: number, compressed: number): number {
  return Math.round((1 - compressed / original) * 100);
}
