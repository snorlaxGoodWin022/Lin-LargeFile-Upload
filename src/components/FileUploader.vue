<template>
  <div class="upload-container">
    <!-- 上传区域 -->
    <div 
      class="upload-area" 
      @click="handleFileClick"
      @dragover.prevent
      @drop.prevent="handleFileDrop"
    >
      <div class="upload-icon">📁</div>
      <div class="upload-text">点击或拖拽文件到此处上传</div>
      <div class="upload-hint">支持大文件上传，最大支持2GB+</div>
      <input 
        ref="fileInput" 
        type="file" 
        class="file-input" 
        @change="handleFileChange"
        style="display: none"
      />
    </div>

    <!-- 文件信息 -->
    <div v-if="selectedFile" class="file-info">
      <h3>{{ selectedFile.name }}</h3>
      <p>文件大小: {{ formatFileSize(selectedFile.size) }}</p>
      <p v-if="fileHash">文件哈希: {{ fileHash }}</p>
    </div>

    <!-- 哈希计算进度 -->
    <div v-if="hashProgress > 0 && hashProgress < 100" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: hashProgress + '%' }"></div>
      </div>
      <div class="progress-info">
        <span>计算文件哈希: {{ hashProgress }}%</span>
      </div>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploadProgress.percent > 0" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: uploadProgress.percent + '%' }"></div>
      </div>
      <div class="progress-info">
        <span>上传进度: {{ uploadProgress.percent }}%</span>
        <span>
          {{ formatFileSize(uploadProgress.speed) }}/s | 剩余: {{ formatTime(uploadProgress.remaining) }}
        </span>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div v-if="uploadTask" class="upload-controls">
      <button 
        v-if="uploadStatus === 'uploading'" 
        @click="handlePause"
      >
        暂停
      </button>
      <button 
        v-else-if="uploadStatus === 'paused'" 
        @click="handleResume"
      >
        继续
      </button>
      <button 
        v-else-if="uploadStatus === 'error'" 
        @click="handleRetry"
      >
        重试
      </button>
      <button 
        v-if="uploadStatus === 'completed'" 
        @click="resetUpload"
      >
        重新上传
      </button>
    </div>

    <!-- 状态提示 -->
    <div v-if="statusMessage" :class="['upload-status', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { uploadManager } from '@/utils/uploadManager';
import { throttle } from '@/utils/performance';
import type { UploadProgress, UploadStatus } from '@/types';

// 响应式数据
const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const uploadTask = ref<any>(null);
const uploadStatus = ref<UploadStatus>('idle');
const uploadProgress = reactive<UploadProgress>({
  percent: 0,
  speed: 0,
  remaining: 0,
  uploaded: 0,
  total: 0
});
const hashProgress = ref(0);
const fileHash = ref<string | null>(null);
const statusMessage = ref('');
const statusType = ref<'success' | 'error'>('success');

// 节流后的进度更新函数
const throttledProgressUpdate = throttle((progress: UploadProgress) => {
  Object.assign(uploadProgress, progress);
}, 100); // 每100ms更新一次

// 节流后的哈希进度更新函数
const throttledHashProgressUpdate = throttle((progress: number) => {
  hashProgress.value = progress;
}, 200); // 每200ms更新一次

// 处理文件点击
const handleFileClick = () => {
  fileInput.value?.click();
};

// 处理文件拖拽
const handleFileDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
};

// 处理文件选择
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0]);
  }
};

// 处理文件
const handleFile = (file: File) => {
  selectedFile.value = file;
  uploadProgress.total = file.size;
  startUpload();
};

// 开始上传
const startUpload = async () => {
  if (!selectedFile.value) return;

  try {
    uploadTask.value = uploadManager.createTask(selectedFile.value);
    
    const result = await uploadTask.value.start(
      (progress: UploadProgress) => {
        // 使用节流函数优化性能
        throttledProgressUpdate(progress);
      },
      (progress: number) => {
        // 使用节流函数优化性能
        throttledHashProgressUpdate(progress);
      },
      (status: UploadStatus) => {
        uploadStatus.value = status;
        updateStatusMessage(status);
      }
    );

    fileHash.value = result.fileHash;
    statusMessage.value = `上传成功！文件 URL: ${result.url}`;
    statusType.value = 'success';
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      statusMessage.value = `上传失败: ${error.message || '未知错误'}`;
      statusType.value = 'error';
    }
  }
};

// 暂停上传
const handlePause = () => {
  uploadTask.value?.pause();
  uploadStatus.value = 'paused';
  statusMessage.value = '上传已暂停';
  statusType.value = 'success';
};

// 继续上传
const handleResume = async () => {
  if (!uploadTask.value) return;

  try {
    await uploadTask.value.resume(
      (progress: UploadProgress) => {
        throttledProgressUpdate(progress);
      },
      (progress: number) => {
        throttledHashProgressUpdate(progress);
      },
      (status: UploadStatus) => {
        uploadStatus.value = status;
        updateStatusMessage(status);
      }
    );
  } catch (error: any) {
    statusMessage.value = `上传失败: ${error.message || '未知错误'}`;
    statusType.value = 'error';
  }
};

// 重试上传
const handleRetry = async () => {
  if (!uploadTask.value) return;

  try {
    await uploadTask.value.retry(
      (progress: UploadProgress) => {
        throttledProgressUpdate(progress);
      },
      (progress: number) => {
        throttledHashProgressUpdate(progress);
      },
      (status: UploadStatus) => {
        uploadStatus.value = status;
        updateStatusMessage(status);
      }
    );
  } catch (error: any) {
    statusMessage.value = `上传失败: ${error.message || '未知错误'}`;
    statusType.value = 'error';
  }
};

// 重置上传
const resetUpload = () => {
  selectedFile.value = null;
  uploadTask.value = null;
  uploadStatus.value = 'idle';
  Object.assign(uploadProgress, {
    percent: 0,
    speed: 0,
    remaining: 0,
    uploaded: 0,
    total: 0
  });
  hashProgress.value = 0;
  fileHash.value = null;
  statusMessage.value = '';
};

// 更新状态消息
const updateStatusMessage = (status: UploadStatus) => {
  switch (status) {
    case 'uploading':
      statusMessage.value = '正在上传...';
      statusType.value = 'success';
      break;
    case 'paused':
      statusMessage.value = '上传已暂停';
      statusType.value = 'success';
      break;
    case 'completed':
      statusMessage.value = '上传成功！';
      statusType.value = 'success';
      break;
    case 'error':
      statusMessage.value = '上传失败';
      statusType.value = 'error';
      break;
    default:
      statusMessage.value = '';
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化时间
const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
};
</script>

<style scoped>
.file-input {
  display: none;
}
</style>
