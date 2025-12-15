import { log } from 'console';
import { OrderSubmitData, PhotoSubmitData } from './photoSubmit';
import { MAX_CONCURRENT_UPLOADS } from '../config/uploadConfig';

// API 基础配置
const API_BASE_URL = 'http://localhost:8888';
const PHOTO_UPLOAD_ENDPOINT = '/api/photo/upload';
const ORDER_SUBMIT_ENDPOINT = '/api/photo/submit';

// 上传响应类型
export interface UploadResponse {
    filename: string;
    size: number;
    sha1: string;
    url: string;
}

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
    orderSn?: string;
    message?: string;
}

/**
 * 提交订单到服务器
 */
export async function submitOrderToServer(
    photos: Photo[], // 使用原始的Photo数组，包含photoUrl
    watermarkConfig: any,
    orderInfo: any,
    onProgress: SubmitProgressCallback
): Promise<SubmitResult> {
    try {
        // 前端生成纯数字 order_sn
        const orderSn = generateOrderSn();

        // 步骤 1: 验证所有照片都有photoUrl
        onProgress('正在验证照片...', 10);

        const photosWithUrl = photos.filter(photo => photo.photoUrl);
        if (photosWithUrl.length !== photos.length) {
            const missingCount = photos.length - photosWithUrl.length;
            throw new Error(`${missingCount} 张照片未上传成功，请重新选择照片`);
        }

        // 步骤 2: 准备订单数据
        onProgress('正在准备订单数据...', 20);

        // 构建照片信息数组
        const photoInfos = photosWithUrl.map(photo => ({
            id: photo.id,
            url: photo.photoUrl!, // 使用之前上传的URL
            transform: photo.transform, // 包含编辑变换信息
        }));

        // 所有提交字段改为蛇形命名
        const orderPayload = toSnakeCaseKeys({
            ...orderInfo,
            watermarkConfig: watermarkConfig,
            photos: photoInfos,
            submitTime: new Date().toISOString(),
            orderSn,
        });

        // 步骤 3: 提交订单信息
        onProgress('正在提交订单信息...', 50);

        const response = await fetch(`${API_BASE_URL}${ORDER_SUBMIT_ENDPOINT}`, {
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
            orderSn: result.orderSn ?? orderSn,
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
 * 上传单个文件用于预览
 */
export async function uploadFileForPreview(
    file: File,
    prefix?: string
): Promise<UploadResponse> {
    const formData = new FormData();

    // 添加文件
    formData.append('file', file);

    // 如果有前缀参数，也添加上
    // if (prefix) {
        // formData.append('prefix', prefix);
    // }
    formData.append('prefix','debug_photo');

    const response = await fetch(`${API_BASE_URL}${PHOTO_UPLOAD_ENDPOINT}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`照片上传失败: ${response.status}`);
    }

    const result = await response.json();

    // 检查响应格式
    if (result.code !== 0) {
        throw new Error(result.msg || '上传失败');
    }

    return result.data;
}

/**
 * 上传单张照片
 */
async function uploadPhoto(photo: PhotoSubmitData): Promise<{ url: string }> {
    const formData = new FormData();

    // 添加照片信息
    formData.append('photo_id', photo.id);
    formData.append('quantity', photo.quantity.toString());
    formData.append('original_width', (photo.originalWidth || 0).toString());
    formData.append('original_height', (photo.originalHeight || 0).toString());
    formData.append('auto_rotated', (photo.autoRotated || false).toString());
    formData.append('taken_at', photo.takenAt || new Date().toISOString().split('T')[0]);
    formData.append('image', photo.composedImageBlob, `photo_${photo.id}.jpg`);

    // 如果是满版样式，添加裁切信息
    if (photo.cropInfo) {
        formData.append('crop_info', JSON.stringify(toSnakeCaseKeys(photo.cropInfo)));
    }

    const response = await fetch(`${API_BASE_URL}${PHOTO_UPLOAD_ENDPOINT}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`照片上传失败: ${response.status}`);
    }

    return await response.json();
}

/**
 * 并发受限上传所有照片
 */
async function uploadPhotosWithLimit(
    photos: PhotoSubmitData[],
    concurrency: number,
    onProgress: SubmitProgressCallback
): Promise<Array<{ id: string; url: string }>> {
    if (photos.length === 0) return [];
    const total = photos.length;
    const limit = Math.max(1, concurrency || 1);
    const results: Array<{ id: string; url: string }> = new Array(total);
    let completed = 0;
    let cursor = 0;

    const runNext = async (): Promise<void> => {
        const current = cursor++;
        if (current >= total) return;
        const photo = photos[current];
        try {
            const res = await uploadPhoto(photo);
            results[current] = { id: photo.id, url: res.url };
            completed += 1;
            const progress = 20 + (completed / total) * 60; // 20%-80%
            onProgress(`正在上传第 ${completed}/${total} 张照片...`, progress);
        } catch (err) {
            throw err;
        }
        if (cursor < total) {
            await runNext();
        }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(limit, total);
    for (let i = 0; i < workerCount; i++) {
        workers.push(runNext());
    }
    await Promise.all(workers);
    return results;
}

function generateOrderSn(): string {
    const ts = Date.now().toString();
    const rand = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
    return `${ts}${rand}`;
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
