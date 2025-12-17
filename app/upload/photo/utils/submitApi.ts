import { OrderSubmitData, PhotoSubmitData } from './photoSubmit';
import { MAX_CONCURRENT_UPLOADS } from '../config/uploadConfig';
import { uploadToOss, OssUploadResult } from './ossUpload';
import { Photo, PhotoTransform, createAffineMatrix, WHITE_MARGIN_PERCENT } from '../types/photo.types';

// API 基础配置
const API_BASE_URL = 'http://localhost:8888';
const ORDER_SUBMIT_ENDPOINT = '/api/photo/submit';

/**
 * 为没有 transform 的照片生成默认变换
 * @param photo 照片数据
 * @param aspectRatio 画布宽高比
 * @param styleType 样式类型
 * @returns 默认的 PhotoTransform
 */
function generateDefaultTransform(
    photo: Photo,
    aspectRatio: number,
    styleType: string
): PhotoTransform | undefined {
    const sourceWidth = photo.width;
    const sourceHeight = photo.height;
    
    if (!sourceWidth || !sourceHeight) {
        console.warn(`照片 ${photo.id} 缺少尺寸信息，无法生成默认变换`);
        return undefined;
    }
    
    // 使用标准输出尺寸（与 PhotoCanvas 中一致）
    const outputWidth = 400; // 标准化宽度
    const outputHeight = outputWidth / aspectRatio;
    
    // 计算有效区域
    const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
    const effectiveWidth = outputWidth * (1 - margin * 2);
    const effectiveHeight = outputHeight * (1 - margin * 2);
    const marginX = outputWidth * margin;
    const marginY = outputHeight * margin;
    
    // 计算初始旋转（横图自动旋转90度）
    const initialRotation = photo.autoRotated ? 90 : 0;
    const rad = (initialRotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedWidth = sourceWidth * cos + sourceHeight * sin;
    const rotatedHeight = sourceWidth * sin + sourceHeight * cos;
    
    // 计算缩放比例
    let scale: number;
    if (styleType === 'white_margin') {
        scale = Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
    } else {
        scale = Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
    }
    
    // 计算中心位置
    const centerX = marginX + effectiveWidth / 2;
    const centerY = marginY + effectiveHeight / 2;
    
    // 创建仿射矩阵
    const matrix = createAffineMatrix(scale, scale, initialRotation, centerX, centerY);
    
    return {
        matrix,
        outputWidth,
        outputHeight,
        sourceWidth,
        sourceHeight,
    };
}

// 上传响应类型（兼容旧接口）
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

        const photosWithUrl = photos.filter(photo => photo.photoUrl && photo.photoUrl !== 'failed');
        if (photosWithUrl.length !== photos.length) {
            const missingCount = photos.length - photosWithUrl.length;
            throw new Error(`${missingCount} 张照片未上传成功，请重新选择照片`);
        }

        // 步骤 2: 准备订单数据
        onProgress('正在准备订单数据...', 20);

        // 获取订单的宽高比和样式（用于生成默认变换）
        const aspectRatio = orderInfo.aspectRatio || 0.7;
        const styleType = orderInfo.style || 'full_bleed';

        // 构建照片信息数组（包含完整的变换信息）
        // 注意：字段名使用驼峰命名，toSnakeCaseKeys 会自动转换为蛇形命名
        const photoInfos = photosWithUrl.map(photo => {
            // 获取变换信息：如果没有则生成默认值
            let transform = photo.transform;
            
            if (!transform) {
                // 为未编辑的照片生成默认变换
                transform = generateDefaultTransform(photo, aspectRatio, styleType);
                console.log(`🔧 照片 ${photo.id} 生成默认变换:`, transform ? {
                    matrix: transform.matrix,
                    outputSize: `${transform.outputWidth}x${transform.outputHeight}`,
                    sourceSize: `${transform.sourceWidth}x${transform.sourceHeight}`,
                } : '无法生成（缺少尺寸信息）');
            } else {
                console.log(`📐 照片 ${photo.id} 已有变换信息:`, {
                    matrix: transform.matrix,
                    outputSize: `${transform.outputWidth}x${transform.outputHeight}`,
                    sourceSize: `${transform.sourceWidth}x${transform.sourceHeight}`,
                });
            }
            
            return {
                id: photo.id,
                url: photo.photoUrl!, // 使用之前上传的URL
                quantity: photo.quantity,
                transform, // 包含完整的变换信息，toSnakeCaseKeys 会自动转换字段名
            };
        });

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
 * 上传单个文件到OSS（直传）
 * @param file 要上传的文件
 * @param prefix 自定义前缀目录（可选）
 */
export async function uploadFileForPreview(
    file: File,
    prefix?: string
): Promise<UploadResponse> {
    // 使用OSS直传
    const result = await uploadToOss(file, prefix || 'debug_photo');
    
    // 打印上传后的OSS地址到控制台
    console.log(`📸 照片已上传到OSS: ${result.url}`);
    
    // 转换为兼容的响应格式
    return {
        filename: result.filename,
        size: result.size,
        sha1: result.key, // 使用key作为sha1
        url: result.url,
    };
}

/**
 * 上传单张照片（兼容旧接口，现在使用OSS直传）
 */
async function uploadPhoto(photo: PhotoSubmitData): Promise<{ url: string }> {
    if (!photo.composedImageBlob) {
        throw new Error('照片数据为空');
    }
    
    // 将Blob转换为File
    const file = new File([photo.composedImageBlob], `photo_${photo.id}.jpg`, {
        type: 'image/jpeg'
    });
    
    const result = await uploadToOss(file);
    
    console.log(`📸 照片已上传到OSS: ${result.url}`);
    
    return { url: result.url };
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
