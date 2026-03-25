import { uploadFile } from './upload';
import { calculateFileHash } from './hash';
import type { UploadStatus, UploadProgress, UploadResult, UploadConfig } from '@/types';

// 上传任务类
export class UploadTask {
  private file: File;
  private config: Partial<UploadConfig>;
  private status: UploadStatus = 'idle';
  private progress: UploadProgress = {
    percent: 0,
    speed: 0,
    remaining: 0,
    uploaded: 0,
    total: 0
  };
  private hashProgress: number = 0;
  private fileHash: string | null = null;
  private abortController: AbortController | null = null;
  
  constructor(file: File, config?: Partial<UploadConfig>) {
    this.file = file;
    this.config = config || {};
    this.progress.total = file.size;
  }
  
  // 开始上传
  async start(
    onProgress?: (progress: UploadProgress) => void,
    onHashProgress?: (progress: number) => void,
    onStatusChange?: (status: UploadStatus) => void
  ): Promise<UploadResult> {
    if (this.status === 'uploading') {
      throw new Error('上传已经在进行中');
    }
    
    this.status = 'uploading';
    onStatusChange?.(this.status);
    
    this.abortController = new AbortController();
    
    try {
      // 计算文件哈希（如果还没有计算）
        if (!this.fileHash) {
          this.fileHash = await calculateFileHash(this.file, (progress: number) => {
            this.hashProgress = progress;
            onHashProgress?.(progress);
          });
        }
        
        // 执行上传
        const result = await uploadFile(
          this.file,
          this.config,
          (progress: UploadProgress) => {
            this.progress = progress;
            onProgress?.(progress);
          },
          onHashProgress
        );
      
      this.status = 'completed';
      onStatusChange?.(this.status);
      
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.status = 'paused';
      } else {
        this.status = 'error';
      }
      onStatusChange?.(this.status);
      throw error;
    }
  }
  
  // 暂停上传
  pause(): void {
    if (this.status === 'uploading' && this.abortController) {
      this.abortController.abort();
      this.status = 'paused';
    }
  }
  
  // 继续上传
  async resume(
    onProgress?: (progress: UploadProgress) => void,
    onHashProgress?: (progress: number) => void,
    onStatusChange?: (status: UploadStatus) => void
  ): Promise<UploadResult> {
    if (this.status !== 'paused') {
      throw new Error('只能从暂停状态继续上传');
    }
    
    return this.start(onProgress, onHashProgress, onStatusChange);
  }
  
  // 重试上传
  async retry(
    onProgress?: (progress: UploadProgress) => void,
    onHashProgress?: (progress: number) => void,
    onStatusChange?: (status: UploadStatus) => void
  ): Promise<UploadResult> {
    if (this.status === 'error') {
      return this.start(onProgress, onHashProgress, onStatusChange);
    }
    throw new Error('只能从错误状态重试上传');
  }
  
  // 获取状态
  getStatus(): UploadStatus {
    return this.status;
  }
  
  // 获取进度
  getProgress(): UploadProgress {
    return this.progress;
  }
  
  // 获取哈希计算进度
  getHashProgress(): number {
    return this.hashProgress;
  }
  
  // 获取文件哈希
  getFileHash(): string | null {
    return this.fileHash;
  }
  
  // 获取文件信息
  getFile(): File {
    return this.file;
  }
}

// 上传管理器
export class UploadManager {
  private tasks: Map<string, UploadTask> = new Map();
  
  // 创建上传任务
  createTask(file: File, config?: Partial<UploadConfig>): UploadTask {
    const taskId = `${file.name}_${file.size}_${file.lastModified}`;
    const task = new UploadTask(file, config);
    this.tasks.set(taskId, task);
    return task;
  }
  
  // 获取上传任务
  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId);
  }
  
  // 移除上传任务
  removeTask(taskId: string): void {
    this.tasks.delete(taskId);
  }
  
  // 获取所有任务
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }
}

// 全局上传管理器实例
export const uploadManager = new UploadManager();
