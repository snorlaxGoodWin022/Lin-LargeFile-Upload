import SparkMD5 from 'spark-md5';

// 监听消息
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  if (type === 'calculateHash') {
    calculateHash(data);
  }
});

// 计算哈希值
async function calculateHash(chunks: ArrayBuffer[]) {
  try {
    const spark = SparkMD5.ArrayBuffer();
    const totalChunks = chunks.length;
    
    for (let i = 0; i < totalChunks; i++) {
      spark.append(chunks[i]);
      
      // 发送进度
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      self.postMessage({
        type: 'progress',
        progress
      });
    }
    
    const hash = spark.end();
    
    // 发送结果
    self.postMessage({
      type: 'result',
      data: hash
    });
  } catch (error) {
    // 发送错误
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : '计算哈希失败'
    });
  }
}
