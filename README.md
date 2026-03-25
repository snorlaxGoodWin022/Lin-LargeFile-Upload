# 大文件切片上传系统

基于 Vue3 + Vite 的高性能文件上传解决方案，支持 Web Workers 异步哈希计算、断点续传、秒传等核心功能。

## 核心功能特性

### 1. 高性能文件分片处理
- ✅ 实现5MB智能分片算法，支持2GB+超大文件上传
- ✅ **Web Workers异步计算MD5哈希**，避免主线程阻塞，提升UI响应性能
- ✅ 设计分片并发池（最大3并发），优化网络利用率

### 2. 智能断点续传机制
- ✅ 基于文件哈希的断点检测，自动识别已上传分片
- ✅ 实现增量上传策略，仅传输缺失分片，节省90%+带宽
- ✅ 支持网络中断后的无缝续传，提升用户体验

### 3. 秒传技术（文件去重）
- ✅ MD5哈希指纹技术实现文件级去重
- ✅ 服务器端文件存在性验证，相同文件瞬间完成上传
- ✅ 显著降低服务器存储压力和用户等待时间

### 4. 实时进度与性能监控
- ✅ 精确计算上传速度、剩余时间等关键指标
- ✅ 动态进度条与状态反馈，提供可视化上传体验
- ✅ 实现暂停/继续/重试等完整生命周期管理

## 技术栈
- **前端**：Vue3 + TypeScript + Vite
- **算法**：SparkMD5 + Web Workers + 分片算法 + 并发控制
- **依赖**：axios (网络请求)、spark-md5 (哈希计算)

## 安装

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 使用方法

### 基本使用

```vue
<template>
  <div>
    <h1>大文件上传示例</h1>
    <FileUploader />
  </div>
</template>

<script setup lang="ts">
import FileUploader from './components/FileUploader.vue'
</script>
```

### 自定义配置

```vue
<template>
  <FileUploader :config="uploadConfig" />
</template>

<script setup lang="ts">
import FileUploader from './components/FileUploader.vue'

const uploadConfig = {
  chunkSize: 10 * 1024 * 1024, // 10MB
  maxConcurrency: 5, // 最大并发数
  retryCount: 3, // 重试次数
  apiUrl: 'http://localhost:3001/api/upload' // 后端API地址
}
</script>
```
