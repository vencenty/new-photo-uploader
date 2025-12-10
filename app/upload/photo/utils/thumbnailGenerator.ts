/**
 * 缩略图生成工具
 * 用于将上传的图片转换为长边1080的缩略图，减少内存占用
 */

export interface ThumbnailOptions {
    maxSize?: number; // 长边最大尺寸，默认1080
    quality?: number; // JPEG质量，0-1，默认0.9
}

/**
 * 生成缩略图
 * @param file 原始图片文件
 * @param options 缩略图选项
 * @returns { thumbnailUrl: 缩略图 blob URL, width: 缩略图宽度, height: 缩略图高度 }
 */
export async function generateThumbnail(
    file: Blob,
    options: ThumbnailOptions = {}
): Promise<{ thumbnailUrl: string; width: number; height: number }> {
    const { maxSize = 1080, quality = 0.9 } = options;

    return new Promise((resolve, reject) => {
        // 创建临时 URL 加载图片
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            // 释放临时 URL
            URL.revokeObjectURL(tempUrl);

            const { width: originalWidth, height: originalHeight } = img;

            // 计算缩略图尺寸
            let thumbnailWidth = originalWidth;
            let thumbnailHeight = originalHeight;

            // 只在图片超过最大尺寸时才缩放
            const maxDimension = Math.max(originalWidth, originalHeight);
            if (maxDimension > maxSize) {
                const scale = maxSize / maxDimension;
                thumbnailWidth = Math.round(originalWidth * scale);
                thumbnailHeight = Math.round(originalHeight * scale);
            }

            // 创建 canvas 生成缩略图
            const canvas = document.createElement('canvas');
            canvas.width = thumbnailWidth;
            canvas.height = thumbnailHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('无法创建 canvas 上下文'));
                return;
            }

            // 使用高质量缩放算法
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // 绘制缩放后的图片
            ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);

            // 转换为 Blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('生成缩略图失败'));
                        return;
                    }

                    // 创建缩略图 URL
                    const thumbnailUrl = URL.createObjectURL(blob);

                    resolve({
                        thumbnailUrl,
                        width: thumbnailWidth,
                        height: thumbnailHeight,
                    });
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error('图片加载失败'));
        };

        img.src = tempUrl;
    });
}

/**
 * 批量生成缩略图
 * @param files 原始图片文件数组
 * @param options 缩略图选项
 * @param onProgress 进度回调 (current, total)
 * @returns 缩略图信息数组
 */
export async function generateThumbnails(
    files: Blob[],
    options: ThumbnailOptions = {},
    onProgress?: (current: number, total: number) => void
): Promise<Array<{ thumbnailUrl: string; width: number; height: number }>> {
    const results: Array<{ thumbnailUrl: string; width: number; height: number }> = [];

    for (let i = 0; i < files.length; i++) {
        try {
            const thumbnail = await generateThumbnail(files[i], options);
            results.push(thumbnail);
            onProgress?.(i + 1, files.length);
        } catch (error) {
            console.error(`生成第 ${i + 1} 张缩略图失败:`, error);
            throw error;
        }
    }

    return results;
}

/**
 * 清理缩略图 URL（释放内存）
 * @param thumbnailUrls 需要清理的缩略图 URL 数组
 */
export function revokeThumbnailUrls(thumbnailUrls: string[]): void {
    thumbnailUrls.forEach((url) => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    });
}
