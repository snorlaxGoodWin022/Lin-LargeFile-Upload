// 文件上传相关类型定义

// 分片信息
export interface Chunk {
  index: number;
  size: number;
  start: number;
  end: number;
  file: Blob;
}

// 上传状态
export type UploadStatus = 'idle' | 'uploading' | 'paused' | 'completed' | 'error';

// 上传进度
export interface UploadProgress {
  percent: number;
  speed: number; // bytes per second
  remaining: number; // seconds
  uploaded: number; // bytes
  total: number; // bytes
}

// 上传结果
export interface UploadResult {
  fileHash: string;
  fileName: string;
  fileSize: number;
  url: string;
}

// Web Worker 消息类型
export interface WorkerMessage {
  type: 'calculateHash' | 'progress' | 'result' | 'error';
  data?: any;
  progress?: number;
  error?: string;
}

// 上传配置
export interface UploadConfig {
  chunkSize: number;
  maxConcurrency: number;
  retryCount: number;
  apiUrl: string;
}
