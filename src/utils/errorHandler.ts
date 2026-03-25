// 错误类型定义
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  HASH_CALCULATION_FAILED = 'HASH_CALCULATION_FAILED',
  MERGE_FAILED = 'MERGE_FAILED',
  ABORTED = 'ABORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误类
export class UploadError extends Error {
  type: ErrorType;
  retryable: boolean;
  
  constructor(message: string, type: ErrorType, retryable: boolean = true) {
    super(message);
    this.type = type;
    this.retryable = retryable;
    this.name = 'UploadError';
  }
}

// 错误处理工具
export class ErrorHandler {
  // 指数退避重试
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否可以重试
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // 指数退避
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (lastError) {
      throw lastError;
    }
    throw new Error('重试失败');
  }
  
  // 检查错误是否可以重试
  static isRetryableError(error: any): boolean {
    if (error instanceof UploadError) {
      return error.retryable;
    }
    
    // 网络错误通常可以重试
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return true;
    }
    
    // 超时错误可以重试
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return true;
    }
    
    return false;
  }
  
  // 格式化错误消息
  static formatError(error: any): string {
    if (error instanceof UploadError) {
      switch (error.type) {
        case ErrorType.NETWORK_ERROR:
          return '网络错误，请检查网络连接后重试';
        case ErrorType.UPLOAD_FAILED:
          return '上传失败，请重试';
        case ErrorType.HASH_CALCULATION_FAILED:
          return '文件哈希计算失败，请重试';
        case ErrorType.MERGE_FAILED:
          return '文件合并失败，请重试';
        case ErrorType.ABORTED:
          return '上传已取消';
        default:
          return error.message;
      }
    }
    
    // 处理其他类型的错误
    if (error.name === 'AbortError') {
      return '上传已取消';
    }
    
    if (error.message) {
      return error.message;
    }
    
    return '未知错误';
  }
  
  // 处理 axios 错误
  static handleAxiosError(error: any): UploadError {
    if (error.response) {
      // 服务器返回错误状态码
      const status = error.response.status;
      switch (status) {
        case 400:
          return new UploadError('请求参数错误', ErrorType.UPLOAD_FAILED, false);
        case 401:
          return new UploadError('未授权', ErrorType.UPLOAD_FAILED, false);
        case 403:
          return new UploadError('禁止访问', ErrorType.UPLOAD_FAILED, false);
        case 404:
          return new UploadError('接口不存在', ErrorType.UPLOAD_FAILED, false);
        case 500:
          return new UploadError('服务器内部错误', ErrorType.UPLOAD_FAILED, true);
        case 502:
        case 503:
        case 504:
          return new UploadError('服务器暂时不可用', ErrorType.NETWORK_ERROR, true);
        default:
          return new UploadError(`服务器错误 (${status})`, ErrorType.UPLOAD_FAILED, true);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      return new UploadError('网络错误，服务器无响应', ErrorType.NETWORK_ERROR, true);
    } else {
      // 请求配置出错
      return new UploadError(error.message, ErrorType.UPLOAD_FAILED, false);
    }
  }
}

// 错误日志记录
export function logError(error: any, context: string): void {
  console.error(`[${context}]`, error);
  
  // 可以在这里添加错误上报逻辑
  // 例如发送到 Sentry 或其他错误监控服务
}
