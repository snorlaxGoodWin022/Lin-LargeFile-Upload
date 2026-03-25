// 并发控制类
export class ConcurrencyPool<T, R> {
  private maxConcurrency: number;
  private tasks: Array<() => Promise<R>> = [];
  private running = 0;
  private results: R[] = [];
  private resolve?: (results: R[]) => void;
  private reject?: (error: Error) => void;
  private isProcessing = false;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  // 添加任务
  add(task: (item: T) => Promise<R>, item: T): void {
    this.tasks.push(() => task(item));
  }

  // 执行所有任务
  async run(): Promise<R[]> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.process();
    });
  }

  // 处理任务
  private process(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.running < this.maxConcurrency && this.tasks.length > 0) {
      this.running++;
      const task = this.tasks.shift()!;
      
      task()
        .then(result => {
          this.results.push(result);
          this.running--;
          this.checkCompletion();
        })
        .catch(error => {
          this.reject?.(error);
          this.isProcessing = false;
        });
    }
    
    this.isProcessing = false;
  }

  // 检查是否完成
  private checkCompletion(): void {
    if (this.running === 0 && this.tasks.length === 0) {
      this.resolve?.(this.results);
    } else {
      this.process();
    }
  }
}

// 批量执行任务，控制并发数
export async function runWithConcurrency<T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const pool = new ConcurrencyPool<T, R>(maxConcurrency);
  
  items.forEach(item => {
    pool.add(task, item);
  });
  
  return pool.run();
}
