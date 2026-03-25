import axios from 'axios';
import { calculateFileHash } from './hash';
import { runWithConcurrency } from './concurrency';
import { ErrorHandler, UploadError, ErrorType, logError } from './errorHandler';
import type { Chunk, UploadConfig, UploadProgress, UploadResult } from '@/types';

const DEFAULT_CONFIG: UploadConfig = {
  chunkSize: 5 * 1024 * 1024, // 5MB
  maxConcurrency: 3,
  retryCount: 3,
  apiUrl: '/api/upload'
};

// 生成文件分片
export function generateChunks(file: File, chunkSize: number): Chunk[] {
  const chunks: Chunk[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const size = end - start;
    const chunk = file.slice(start, end);
    
    chunks.push({
      index: i,
      size,
      start,
      end,
      file: chunk
    });
  }
  
  return chunks;
}

// 检查文件是否已存在（秒传功能）
export async function checkFileExists(fileHash: string, apiUrl: string): Promise<boolean> {
  try {
    const response = await axios.get(`${apiUrl}/check`, {
      params: { fileHash }
    });
    return response.data.exists;
  } catch (error) {
    logError(error, 'checkFileExists');
    // 检查失败时默认返回 false，不影响后续上传
    return false;
  }
}

// 检查已上传的分片
export async function checkUploadedChunks(fileHash: string, apiUrl: string): Promise<number[]> {
  try {
    const response = await axios.get(`${apiUrl}/chunks`, {
      params: { fileHash }
    });
    return response.data.uploadedChunks || [];
  } catch (error) {
    logError(error, 'checkUploadedChunks');
    // 检查失败时默认返回空数组，不影响后续上传
    return [];
  }
}

// 上传单个分片
export async function uploadChunk(chunk: Chunk, fileHash: string, fileName: string, apiUrl: string, retryCount: number = 3): Promise<boolean> {
  const formData = new FormData();
  formData.append('chunk', chunk.file);
  formData.append('index', chunk.index.toString());
  formData.append('fileHash', fileHash);
  formData.append('fileName', fileName);
  formData.append('totalChunks', chunk.index.toString()); // 实际应该传总分片数
  
  try {
    await ErrorHandler.retryWithBackoff(async () => {
      try {
        await axios.post(`${apiUrl}/chunk`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } catch (error) {
        throw ErrorHandler.handleAxiosError(error);
      }
    }, retryCount);
    return true;
  } catch (error) {
    logError(error, 'uploadChunk');
    throw error;
  }
}

// 合并分片
export async function mergeChunks(fileHash: string, fileName: string, totalChunks: number, apiUrl: string): Promise<UploadResult> {
  try {
    const response = await axios.post(`${apiUrl}/merge`, {
      fileHash,
      fileName,
      totalChunks
    });
    
    return response.data;
  } catch (error) {
    logError(error, 'mergeChunks');
    throw ErrorHandler.handleAxiosError(error);
  }
}

// 计算上传进度
export function calculateProgress(uploaded: number, total: number, startTime: number): UploadProgress {
  const percent = Math.round((uploaded / total) * 100);
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? uploaded / elapsed : 0;
  const remaining = speed > 0 ? (total - uploaded) / speed : 0;
  
  return {
    percent,
    speed,
    remaining,
    uploaded,
    total
  };
}

// 执行上传
export async function uploadFile(
  file: File,
  config: Partial<UploadConfig> = {},
  onProgress?: (progress: UploadProgress) => void,
  onHashProgress?: (progress: number) => void
): Promise<UploadResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { chunkSize, maxConcurrency, retryCount, apiUrl } = finalConfig;
  
  try {
    // 计算文件哈希
    const fileHash = await calculateFileHash(file, onHashProgress);
    
    // 检查文件是否已存在（秒传）
    const exists = await checkFileExists(fileHash, apiUrl);
    if (exists) {
      return {
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        url: `${apiUrl}/files/${fileHash}`
      };
    }
    
    // 生成分片
    const chunks = generateChunks(file, chunkSize);
    const totalChunks = chunks.length;
    
    // 检查已上传的分片
    const uploadedChunks = await checkUploadedChunks(fileHash, apiUrl);
    const remainingChunks = chunks.filter(chunk => !uploadedChunks.includes(chunk.index));
    
    // 上传剩余分片
    const startTime = Date.now();
    let uploadedBytes = uploadedChunks.length * chunkSize;
    
    await runWithConcurrency(
      remainingChunks,
      async (chunk) => {
        await uploadChunk(chunk, fileHash, file.name, apiUrl, retryCount);
        uploadedBytes += chunk.size;
        
        if (onProgress) {
          const progress = calculateProgress(uploadedBytes, file.size, startTime);
          onProgress(progress);
        }
      },
      maxConcurrency
    );
    
    // 合并分片
    return await mergeChunks(fileHash, file.name, totalChunks, apiUrl);
  } catch (error) {
    logError(error, 'uploadFile');
    if (error instanceof UploadError) {
      throw error;
    }
    throw new UploadError('上传失败', ErrorType.UPLOAD_FAILED);
  }
}
