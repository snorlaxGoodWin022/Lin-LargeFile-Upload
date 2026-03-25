// 性能优化工具

// 内存管理
export class MemoryManager {
  private static memoryUsage: Map<string, number> = new Map();
  
  // 记录内存使用
  static trackMemory(key: string, size: number): void {
    this.memoryUsage.set(key, size);
  }
  
  // 释放内存
  static releaseMemory(key: string): void {
    this.memoryUsage.delete(key);
  }
  
  // 获取内存使用情况
  static getMemoryUsage(): number {
    let total = 0;
    for (const size of this.memoryUsage.values()) {
      total += size;
    }
    return total;
  }
  
  // 清理所有内存跟踪
  static clear(): void {
    this.memoryUsage.clear();
  }
}

// 性能监控
export class PerformanceMonitor {
  private static startTime: Map<string, number> = new Map();
  private static endTime: Map<string, number> = new Map();
  
  // 开始计时
  static start(key: string): void {
    this.startTime.set(key, performance.now());
  }
  
  // 结束计时
  static end(key: string): number {
    const start = this.startTime.get(key);
    if (!start) return 0;
    
    const end = performance.now();
    this.endTime.set(key, end);
    return end - start;
  }
  
  // 获取执行时间
  static getDuration(key: string): number {
    const start = this.startTime.get(key);
    const end = this.endTime.get(key);
    if (!start || !end) return 0;
    return end - start;
  }
  
  // 清理计时
  static clear(): void {
    this.startTime.clear();
    this.endTime.clear();
  }
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay) as unknown as number;
  };
}

// 批量处理函数
export async function batchProcess<T, R>(
  items: T[],
  processFunc: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFunc));
    results.push(...batchResults);
  }
  return results;
}

// 优化的文件读取函数
export async function readFileInChunks(
  file: File,
  chunkSize: number,
  onChunk: (chunk: ArrayBuffer, offset: number) => Promise<void>
): Promise<void> {
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    const arrayBuffer = await chunk.arrayBuffer();
    await onChunk(arrayBuffer, offset);
    offset = end;
  }
}

// 内存友好的文件哈希计算（流式处理）
export async function calculateHashStream(
  file: File,
  _chunkSize: number,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 这里可以实现流式哈希计算，减少内存使用
  // 目前使用现有的实现，后续可以优化
  const { calculateFileHash } = await import('./hash');
  return calculateFileHash(file, onProgress);
}
