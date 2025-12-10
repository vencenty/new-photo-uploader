import { log } from 'console';
import { OrderSubmitData, PhotoSubmitData } from './photoSubmit';

// API 基础配置
const API_BASE_URL = 'http://localhost:9898';
const API_ENDPOINT = '/index.php';

// 工具：对象键转蛇形命名
const toSnakeCase = (key: string) =>
    key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase();

const toSnakeCaseKeys = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(v => toSnakeCaseKeys(v));
    const isFile = typeof File !== 'undefined' && value instanceof File;
    if (value instanceof Blob || isFile) return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        return Object.keys(value).reduce((acc, key) => {
            acc[toSnakeCase(key)] = toSnakeCaseKeys((value as any)[key]);
            return acc;
        }, {} as Record<string, any>);
    }
    return value;
};

// 提交进度回调类型
export interface SubmitProgressCallback {
    (step: string, progress: number): void;
}

// 提交结果类型
export interface SubmitResult {
    success: boolean;
    orderId?: string;
    message?: string;
}

/**
 * 提交订单到服务器
 */
export async function submitOrderToServer(
    orderData: OrderSubmitData,
    onProgress: SubmitProgressCallback
): Promise<SubmitResult> {
    try {
        // 步骤 1: 准备数据
        onProgress('正在准备订单数据...', 10);

        // 步骤 2: 上传照片（逐个上传以显示进度）
        const photoResults: Array<{ id: string; url: string }> = [];
        const totalPhotos = orderData.photos.length;

        for (let i = 0; i < totalPhotos; i++) {
            const photo = orderData.photos[i];
            const progress = 20 + (i / totalPhotos) * 60; // 20%-80%

            onProgress(`正在上传第 ${i + 1}/${totalPhotos} 张照片...`, progress);

            try {
                const photoResult = await uploadPhoto(photo);
                photoResults.push({
                    id: photo.id,
                    url: photoResult.url,
                });
            } catch (error) {
                console.error(`照片 ${photo.id} 上传失败:`, error);
                throw new Error(`照片 ${i + 1} 上传失败，请重试`);
            }

            // 短暂延迟避免服务器过载
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 步骤 3: 提交订单信息
        onProgress('正在提交订单信息...', 85);

        // 所有提交字段改为蛇形命名
        const orderPayload = toSnakeCaseKeys({
            ...orderData.orderInfo,
            watermarkConfig: orderData.watermarkConfig,
            photos: photoResults,
            submitTime: orderData.submitTime,
        });

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }

        const result = await response.json();

        // 步骤 4: 完成
        onProgress('订单提交完成！', 100);

        // 短暂延迟显示完成状态
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            orderId: result.orderId,
            message: result.message,
        };

    } catch (error) {
        console.error('订单提交失败:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '提交失败，请重试',
        };
    }
}

/**
 * 上传单张照片
 */
async function uploadPhoto(photo: PhotoSubmitData): Promise<{ url: string }> {
    const formData = new FormData();

    // 添加照片信息
    formData.append('photo_id', photo.id);
    formData.append('quantity', photo.quantity.toString());
    formData.append('original_width', photo.originalWidth.toString());
    formData.append('original_height', photo.originalHeight.toString());
    formData.append('auto_rotated', photo.autoRotated.toString());
    formData.append('taken_at', photo.takenAt || '');
    formData.append('image', photo.composedImageBlob, `photo_${photo.id}.jpg`);

    // 如果是满版样式，添加裁切信息
    if (photo.cropInfo) {
        formData.append('crop_info', JSON.stringify(toSnakeCaseKeys(photo.cropInfo)));
    }

    const response = await fetch(`${API_BASE_URL}/index.php`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`照片上传失败: ${response.status}`);
    }

    return await response.json();
}

/**
 * 检查服务器连接
 */
export async function checkServerConnection(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5秒超时
        });
        return response.ok;
    } catch (error) {
        console.warn('服务器连接检查失败:', error);
        return false;
    }
}
