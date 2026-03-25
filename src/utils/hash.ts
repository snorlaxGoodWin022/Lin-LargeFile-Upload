import type { WorkerMessage } from '@/types';
import { UploadError, ErrorType, logError } from './errorHandler';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// 创建 Web Worker
function createWorker(): Worker {
  // 由于 Vite 对 Worker 的支持，这里使用动态导入
  const workerCode = `
    importScripts('https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/spark-md5.min.js');
    
    self.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      if (type === 'calculateHash') {
        calculateHash(data);
      }
    });
    
    function calculateHash(chunks) {
      try {
        const spark = new SparkMD5.ArrayBuffer();
        const totalChunks = chunks.length;
        
        for (let i = 0; i < totalChunks; i++) {
          spark.append(chunks[i]);
          
          const progress = Math.round(((i + 1) / totalChunks) * 100);
          self.postMessage({
            type: 'progress',
            progress
          });
        }
        
        const hash = spark.end();
        
        self.postMessage({
          type: 'result',
          data: hash
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message || '计算哈希失败'
        });
      }
    }
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

// 计算文件哈希
export async function calculateFileHash(file: File, onProgress?: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const chunks: ArrayBuffer[] = [];
    let cur = 0;
    
    // 读取文件分片
    const readChunk = async () => {
      try {
        while (cur < file.size) {
          const chunk = file.slice(cur, cur + CHUNK_SIZE);
          const arrayBuffer = await chunk.arrayBuffer();
          chunks.push(arrayBuffer);
          cur += CHUNK_SIZE;
        }
        
        // 发送给 Worker 计算哈希
        worker.postMessage({
          type: 'calculateHash',
          data: chunks
        });
      } catch (error) {
        logError(error, 'readChunk');
        worker.terminate();
        reject(new UploadError('文件读取失败', ErrorType.HASH_CALCULATION_FAILED));
      }
    };
    
    // 监听 Worker 消息
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      const { type, data, progress, error } = event.data;
      
      if (type === 'progress' && onProgress && progress !== undefined) {
        onProgress(progress);
      } else if (type === 'result') {
        worker.terminate();
        resolve(data);
      } else if (type === 'error') {
        worker.terminate();
        logError(new Error(error), 'workerError');
        reject(new UploadError('哈希计算失败', ErrorType.HASH_CALCULATION_FAILED));
      }
    });
    
    // 监听错误
    worker.addEventListener('error', (error) => {
      logError(error, 'workerError');
      worker.terminate();
      reject(new UploadError('Worker 错误', ErrorType.HASH_CALCULATION_FAILED));
    });
    
    readChunk().catch(reject);
  });
}

// 生成文件唯一标识
export function generateFileId(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}
