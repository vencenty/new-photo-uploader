# 照片上传缩略图优化方案

## 概述

为了解决用户一次上传几十到几百张照片时浏览器内存溢出的问题，实施了缩略图优化方案。该方案通过生成长边1080的缩略图用于预览和编辑，而在提交时使用原图，从而大幅减少客户端内存压力。

## 核心思路

1. **上传阶段**：用户选择文件后，立即生成长边1080的缩略图
2. **预览和编辑**：所有操作（拖拽、缩放、旋转等）都在缩略图上进行
3. **提交阶段**：上传原图 + 操作参数（旋转角度、裁切范围等）到服务器
4. **服务器处理**：服务器根据参数处理原图，生成最终照片

## 优化效果


### 内存占用对比

**优化前：**
- 100张 4000x3000 的照片
- 每张约 12MB (4000 * 3000 * 4 字节)
- 总内存：~1.2GB

**优化后：**
- 100张 1080x810 的缩略图
- 每张约 3.5MB (1080 * 810 * 4 字节)
- 总内存：~350MB
- **节省约 70% 内存**

### 性能提升

- ✅ 支持同时处理几百张照片而不卡顿
- ✅ 编辑操作更流畅（操作的图片尺寸更小）
- ✅ 页面切换更快速
- ✅ 移动端体验大幅提升

## 技术实现

### 1. 缩略图生成工具

创建了 `thumbnailGenerator.ts` 工具，提供：

```typescript
// 生成单张缩略图
generateThumbnail(file: Blob, options?: ThumbnailOptions): Promise<{
  thumbnailUrl: string;
  width: number;
  height: number;
}>

// 批量生成缩略图
generateThumbnails(files: Blob[], options?, onProgress?): Promise<...>

// 清理缩略图 URL
revokeThumbnailUrls(thumbnailUrls: string[]): void
```

**特性：**
- 使用 Canvas 进行高质量缩放
- 默认长边1080px，可配置
- 默认 JPEG 质量 0.9，可配置
- 支持进度回调

### 2. Photo 类型扩展

在 `photo.types.ts` 中扩展了 Photo 接口：

```typescript
export interface Photo {
  id: string;
  url: string; // 缩略图 URL（用于预览和编辑）
  originalFile?: File; // 原始文件引用（用于提交）
  
  width?: number; // 原始图片宽度
  height?: number; // 原始图片高度
  thumbnailWidth?: number; // 缩略图宽度
  thumbnailHeight?: number; // 缩略图高度
  
  // ... 其他字段
}
```

### 3. 上传流程优化

在 `page.tsx` 的 `handleFileChange` 中：

```typescript
// 1. 转换 HEIC（如果需要）
if (isHeicFile(file)) {
  imageBlob = await convertHeicToJpeg(file);
  processedFile = new File([imageBlob], ...);
}

// 2. 读取 EXIF 信息
const exifDate = await readExifDate(file);

// 3. 生成缩略图
const { thumbnailUrl, width, height } = await generateThumbnail(imageBlob, {
  maxSize: 1080,
  quality: 0.9
});

// 4. 获取原图尺寸
const originalDimensions = await loadOriginalDimensions(imageBlob);

// 5. 创建 Photo 对象
const newPhoto: Photo = {
  url: thumbnailUrl, // 使用缩略图
  originalFile: processedFile, // 保存原始文件
  width: originalWidth,
  height: originalHeight,
  thumbnailWidth,
  thumbnailHeight,
  // ...
};
```

### 4. 显示和编辑组件适配

在 `PhotoEditor.tsx` 和 `PhotoCard.tsx` 中：

```typescript
// 优先使用缩略图尺寸
const width = photo.thumbnailWidth || photo.width;
const height = photo.thumbnailHeight || photo.height;

// 在所有计算和显示中使用缩略图尺寸
<img
  src={photo.url} // 缩略图 URL
  style={{
    width: `${photo.thumbnailWidth || photo.width}px`,
    height: `${photo.thumbnailHeight || photo.height}px`,
  }}
/>
```

### 5. 提交流程适配

在 `photoSubmit.ts` 中：

```typescript
// 从原始文件加载图片
const loadImageFromFile = (file: File | Blob): Promise<HTMLImageElement> => {
  // ...
};

// 合成水印时使用原图
const img = photo.originalFile 
  ? await loadImageFromFile(photo.originalFile)
  : await loadImage(photo.url);

// 提取 EXIF 时优先从原始文件
if (photo.originalFile) {
  originalBuffer = await photo.originalFile.arrayBuffer();
}
```

## 向后兼容

所有修改都保持了向后兼容：

```typescript
// 如果没有缩略图尺寸，使用原图尺寸
const width = photo.thumbnailWidth || photo.width;
const height = photo.thumbnailHeight || photo.height;

// 如果没有原始文件，使用 URL
const img = photo.originalFile 
  ? await loadImageFromFile(photo.originalFile)
  : await loadImage(photo.url);
```

这确保了旧数据和新数据都能正常工作。

## 数据流图

```
用户选择文件
     ↓
[HEIC 转换]（如果需要）
     ↓
[读取 EXIF 信息]
     ↓
[生成缩略图] → 长边1080，质量0.9
     ↓
[获取原图尺寸]
     ↓
创建 Photo 对象:
  - url: 缩略图 blob URL
  - originalFile: 原始文件引用
  - width/height: 原图尺寸
  - thumbnailWidth/height: 缩略图尺寸
     ↓
[预览和编辑] → 使用缩略图
     ↓
[提交订单] → 使用原图 + 操作参数
     ↓
服务器处理原图
```

## 注意事项

### 1. 内存管理

- 缩略图 URL 需要及时释放：`URL.revokeObjectURL()`
- 清空照片列表时调用 `revokeThumbnailUrls()`
- 原始文件只保留引用，不创建额外 blob URL

### 2. 变换参数计算

- 编辑器中的所有变换都基于缩略图尺寸
- `transform` 中保存的是相对于容器的位置和缩放
- 提交时会自动将参数缩放到原图尺寸

### 3. EXIF 信息

- EXIF 始终从原始文件读取
- 缩略图不保留 EXIF（减小体积）
- 提交时从原始文件提取 EXIF 并注入到处理后的图片

### 4. 图片质量

- 缩略图使用 0.9 的 JPEG 质量（可配置）
- 提交时使用原图，保证最终质量
- 1080 的缩略图足够用于预览和编辑

## 未来优化方向

1. **渐进式加载**：
   - 先显示更小的预览图（如 360p）
   - 需要编辑时才加载 1080 缩略图
   
2. **Web Worker**：
   - 在 Worker 中生成缩略图，避免阻塞主线程
   
3. **IndexedDB 缓存**：
   - 缓存已生成的缩略图
   - 避免重复上传时重复生成
   
4. **智能质量调整**：
   - 根据设备性能动态调整缩略图质量
   - 低端设备使用更小的尺寸

## 测试建议

### 性能测试

```javascript
// 测试 100 张照片的内存占用
console.memory.usedJSHeapSize / 1024 / 1024 + 'MB'

// 测试缩略图生成速度
const start = performance.now();
await generateThumbnail(file);
console.log('耗时:', performance.now() - start, 'ms');
```

### 兼容性测试

- ✅ Chrome/Edge (最新版)
- ✅ Safari (iOS 14+)
- ✅ Firefox (最新版)
- ✅ 移动端浏览器

### 场景测试

- [x] 上传 100 张照片（4000x3000）
- [x] 编辑、旋转、缩放操作
- [x] 提交订单
- [x] 下载照片
- [x] HEIC 格式转换
- [x] 横竖图自动旋转

## 文件修改清单

### 新增文件
- `app/upload/photo/utils/thumbnailGenerator.ts`

### 修改文件
- `app/upload/photo/types/photo.types.ts` - 扩展 Photo 接口
- `app/upload/photo/page.tsx` - 上传逻辑改用缩略图
- `app/upload/photo/utils/photoSubmit.ts` - 提交时使用原图
- `app/upload/photo/utils/photoTransform.ts` - 计算时优先使用缩略图尺寸
- `app/upload/photo/components/PhotoEditor.tsx` - 显示和编辑使用缩略图
- `app/upload/photo/components/PhotoCard.tsx` - 预览使用缩略图

## 总结

通过缩略图优化方案，我们成功地将内存占用减少了约 70%，让用户可以流畅地处理几百张照片。同时保持了向后兼容性，确保旧数据也能正常使用。这是一个典型的以空间换时间、以客户端计算换取用户体验的优化案例。

