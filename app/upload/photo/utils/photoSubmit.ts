import { 
    Photo, 
    PhotoSize, 
    StyleType, 
    WatermarkConfig, 
    WATERMARK_SIZES,
    PhotoTransform,
    BLEED_AREA_PERCENT,
    WHITE_MARGIN_PERCENT,
} from '../types/photo.types';
import { formatDate } from './exifReader';

// ==================== 类型定义 ====================

/** 单张照片提交数据 */
export interface PhotoSubmitData {
    id: string;
    quantity: number;
    originalWidth: number;
    originalHeight: number;
    
    // 合成后的图片（带水印）
    composedImageBlob: Blob;
    composedImageBase64: string;
    
    // 满版样式需要的裁切信息
    cropInfo?: {
        // 相对于原图的裁切区域（百分比 0-1）
        cropX: number;       // 裁切区域左上角 X 坐标
        cropY: number;       // 裁切区域左上角 Y 坐标
        cropWidth: number;   // 裁切区域宽度
        cropHeight: number;  // 裁切区域高度
        rotation: number;    // 旋转角度
        scale: number;       // 缩放比例
    };
    
    // 是否自动旋转
    autoRotated: boolean;
    
    // 原始拍摄日期
    takenAt?: string;
}

/** 订单提交数据 */
export interface OrderSubmitData {
    // 订单信息
    orderInfo: {
        size: PhotoSize;
        style: StyleType;
        totalQuantity: number;
        totalPrice: number;
        shippingFee: number;
    };
    
    // 水印配置
    watermarkConfig: WatermarkConfig;
    
    // 照片列表
    photos: PhotoSubmitData[];
    
    // 提交时间
    submitTime: string;
}

// ==================== Canvas 合成函数 ====================

/**
 * 加载图片并返回 Image 元素
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
    });
};

/**
 * 加载 DSEG 字体
 */
const loadDsegFont = async (): Promise<void> => {
    const font = new FontFace(
        'DSEG7',
        'url(/fonts/dseg/DSEG7-Classic/DSEG7Classic-Regular.woff2)'
    );
    
    try {
        const loadedFont = await font.load();
        document.fonts.add(loadedFont);
    } catch (error) {
        console.warn('DSEG 字体加载失败，使用备用字体', error);
    }
};

/**
 * 获取水印在 canvas 上的位置
 */
const getWatermarkCanvasPosition = (
    position: string,
    canvasWidth: number,
    canvasHeight: number,
    textWidth: number,
    fontSize: number,
    padding: number
): { x: number; y: number; textAlign: CanvasTextAlign } => {
    let x: number;
    let y: number;
    let textAlign: CanvasTextAlign = 'left';
    
    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + fontSize;
            textAlign = 'left';
            break;
        case 'top-center':
            x = canvasWidth / 2;
            y = padding + fontSize;
            textAlign = 'center';
            break;
        case 'top-right':
            x = canvasWidth - padding;
            y = padding + fontSize;
            textAlign = 'right';
            break;
        case 'bottom-left':
            x = padding;
            y = canvasHeight - padding;
            textAlign = 'left';
            break;
        case 'bottom-center':
            x = canvasWidth / 2;
            y = canvasHeight - padding;
            textAlign = 'center';
            break;
        case 'bottom-right':
        default:
            x = canvasWidth - padding;
            y = canvasHeight - padding;
            textAlign = 'right';
            break;
    }
    
    return { x, y, textAlign };
};

/**
 * 在 canvas 上绘制水印
 */
const drawWatermark = (
    ctx: CanvasRenderingContext2D,
    watermarkConfig: WatermarkConfig,
    takenAt: string,
    canvasWidth: number,
    canvasHeight: number
): void => {
    const sizeConfig = WATERMARK_SIZES.find(s => s.value === watermarkConfig.size);
    // 根据画布大小动态计算字体大小（相对于较短边的比例）
    const baseSize = Math.min(canvasWidth, canvasHeight);
    const fontSizeRatio = (sizeConfig?.fontSize || 16) / 300; // 假设 300px 是参考尺寸
    const fontSize = Math.max(12, Math.round(baseSize * fontSizeRatio));
    const padding = Math.round(fontSize * 0.8);
    
    const dateText = formatDate(takenAt, watermarkConfig.dateFormat);
    
    // 设置字体
    ctx.font = `${fontSize}px 'DSEG7', monospace`;
    ctx.letterSpacing = '2px';
    
    // 测量文字宽度
    const textMetrics = ctx.measureText(dateText);
    const textWidth = textMetrics.width;
    
    // 获取位置
    const { x, y, textAlign } = getWatermarkCanvasPosition(
        watermarkConfig.position,
        canvasWidth,
        canvasHeight,
        textWidth,
        fontSize,
        padding
    );
    
    // 设置样式
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = watermarkConfig.opacity / 100;
    
    // 绘制阴影/描边增强可读性
    if (watermarkConfig.color === '#FFFFFF') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
    } else {
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
    }
    
    // 绘制文字
    ctx.fillStyle = watermarkConfig.color;
    ctx.fillText(dateText, x, y);
    
    // 重置透明度和阴影
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
};

/**
 * 合成单张照片（将水印绘制到图片上）
 */
export const composePhotoWithWatermark = async (
    photo: Photo,
    watermarkConfig: WatermarkConfig,
    aspectRatio: number,
    styleType: StyleType
): Promise<{ blob: Blob; base64: string }> => {
    // 加载字体（如果需要水印）
    if (watermarkConfig.enabled && photo.takenAt) {
        await loadDsegFont();
    }
    
    // 加载原图
    const img = await loadImage(photo.url);
    
    // 获取原图尺寸
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // 确定输出画布尺寸（基于照片原始尺寸和目标宽高比）
    let canvasWidth: number;
    let canvasHeight: number;
    
    // 使用原图的较大边作为基准
    const maxDimension = Math.max(imgWidth, imgHeight);
    
    if (aspectRatio >= 1) {
        canvasWidth = maxDimension;
        canvasHeight = Math.round(maxDimension / aspectRatio);
    } else {
        canvasHeight = maxDimension;
        canvasWidth = Math.round(maxDimension * aspectRatio);
    }
    
    // 创建 canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    
    // 填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 计算绘制区域
    let drawX: number, drawY: number, drawWidth: number, drawHeight: number;
    
    if (styleType === 'white_margin') {
        // 留白样式：先留出边距，再 object-contain
        const marginPercent = WHITE_MARGIN_PERCENT / 100;
        const innerWidth = canvasWidth * (1 - marginPercent * 2);
        const innerHeight = canvasHeight * (1 - marginPercent * 2);
        const marginX = canvasWidth * marginPercent;
        const marginY = canvasHeight * marginPercent;
        
        // 计算 rotation 后的实际尺寸
        const rotation = photo.transform?.rotation || (photo.autoRotated ? 90 : 0);
        let actualImgWidth = imgWidth;
        let actualImgHeight = imgHeight;
        
        if (rotation % 180 !== 0) {
            // 90 或 270 度旋转时，宽高交换
            actualImgWidth = imgHeight;
            actualImgHeight = imgWidth;
        }
        
        // object-contain 逻辑
        const imgAspect = actualImgWidth / actualImgHeight;
        const innerAspect = innerWidth / innerHeight;
        
        if (imgAspect > innerAspect) {
            drawWidth = innerWidth;
            drawHeight = innerWidth / imgAspect;
        } else {
            drawHeight = innerHeight;
            drawWidth = innerHeight * imgAspect;
        }
        
        drawX = marginX + (innerWidth - drawWidth) / 2;
        drawY = marginY + (innerHeight - drawHeight) / 2;
        
        // 处理旋转
        if (rotation !== 0) {
            ctx.save();
            ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            
            // 旋转后需要调整绘制尺寸
            if (rotation % 180 !== 0) {
                ctx.drawImage(img, -drawHeight / 2, -drawWidth / 2, drawHeight, drawWidth);
            } else {
                ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            }
            ctx.restore();
        } else {
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
    } else {
        // 满版样式：根据 transform 信息绘制
        const transform = photo.transform;
        const rotation = transform?.rotation || (photo.autoRotated ? 90 : 0);
        
        // 计算旋转后的实际尺寸
        let actualImgWidth = imgWidth;
        let actualImgHeight = imgHeight;
        
        if (rotation % 180 !== 0) {
            actualImgWidth = imgHeight;
            actualImgHeight = imgWidth;
        }
        
        // object-cover 逻辑（默认居中填充）
        const imgAspect = actualImgWidth / actualImgHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        if (imgAspect > canvasAspect) {
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * imgAspect;
        } else {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgAspect;
        }
        
        // 应用位移（如果有 transform）
        if (transform) {
            // 将编辑器中的位移转换为 canvas 坐标
            const scaleRatio = canvasWidth / transform.containerWidth;
            const offsetX = transform.position.x * scaleRatio;
            const offsetY = transform.position.y * scaleRatio;
            
            drawX = (canvasWidth - drawWidth) / 2 + offsetX;
            drawY = (canvasHeight - drawHeight) / 2 + offsetY;
        } else {
            drawX = (canvasWidth - drawWidth) / 2;
            drawY = (canvasHeight - drawHeight) / 2;
        }
        
        // 处理旋转
        if (rotation !== 0) {
            ctx.save();
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            
            // 计算相对于中心的偏移
            const relX = drawX - canvasWidth / 2;
            const relY = drawY - canvasHeight / 2;
            
            if (rotation % 180 !== 0) {
                ctx.drawImage(img, relY, relX, drawHeight, drawWidth);
            } else {
                ctx.drawImage(img, relX, relY, drawWidth, drawHeight);
            }
            ctx.restore();
        } else {
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
    }
    
    // 绘制水印
    if (watermarkConfig.enabled && photo.takenAt) {
        drawWatermark(ctx, watermarkConfig, photo.takenAt, canvasWidth, canvasHeight);
    }
    
    // 导出为 Blob（100% 质量）
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    // 同时生成 base64
                    const base64 = canvas.toDataURL('image/jpeg', 1.0);
                    resolve({ blob, base64 });
                } else {
                    reject(new Error('Canvas 导出失败'));
                }
            },
            'image/jpeg',
            1.0 // 100% 质量
        );
    });
};

/**
 * 计算裁切信息（满版样式用）
 */
export const calculateCropInfo = (
    photo: Photo,
    aspectRatio: number
): PhotoSubmitData['cropInfo'] | undefined => {
    if (!photo.width || !photo.height) return undefined;
    
    const transform = photo.transform;
    const rotation = transform?.rotation || (photo.autoRotated ? 90 : 0);
    
    // 计算旋转后的实际图片尺寸
    let actualWidth = photo.width;
    let actualHeight = photo.height;
    
    if (rotation % 180 !== 0) {
        actualWidth = photo.height;
        actualHeight = photo.width;
    }
    
    // 目标宽高比
    const targetAspect = aspectRatio;
    const imgAspect = actualWidth / actualHeight;
    
    // 计算裁切区域
    let cropWidth: number, cropHeight: number;
    let cropX: number, cropY: number;
    
    if (imgAspect > targetAspect) {
        // 图片更宽，需要裁切两侧
        cropHeight = 1;
        cropWidth = targetAspect / imgAspect;
        cropY = 0;
        cropX = (1 - cropWidth) / 2;
    } else {
        // 图片更高，需要裁切上下
        cropWidth = 1;
        cropHeight = imgAspect / targetAspect;
        cropX = 0;
        cropY = (1 - cropHeight) / 2;
    }
    
    // 应用位移调整
    if (transform && transform.containerWidth && transform.containerHeight) {
        const offsetXPercent = transform.position.x / transform.containerWidth;
        const offsetYPercent = transform.position.y / transform.containerHeight;
        
        // 调整裁切位置
        cropX = Math.max(0, Math.min(1 - cropWidth, cropX - offsetXPercent * cropWidth));
        cropY = Math.max(0, Math.min(1 - cropHeight, cropY - offsetYPercent * cropHeight));
    }
    
    return {
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        rotation,
        scale: transform?.scale || 1,
    };
};

/**
 * 准备订单提交数据
 */
export const prepareOrderSubmitData = async (
    photos: Photo[],
    size: PhotoSize,
    style: StyleType,
    aspectRatio: number,
    watermarkConfig: WatermarkConfig,
    pricePerPhoto: number,
    shippingFee: number
): Promise<OrderSubmitData> => {
    const totalQuantity = photos.reduce((sum, p) => sum + p.quantity, 0);
    const totalPrice = totalQuantity * pricePerPhoto + shippingFee;
    
    // 处理每张照片
    const photoDataList: PhotoSubmitData[] = [];
    
    for (const photo of photos) {
        try {
            // 合成图片（带水印）
            const { blob, base64 } = await composePhotoWithWatermark(
                photo,
                watermarkConfig,
                aspectRatio,
                style
            );
            
            const photoData: PhotoSubmitData = {
                id: photo.id,
                quantity: photo.quantity,
                originalWidth: photo.width || 0,
                originalHeight: photo.height || 0,
                composedImageBlob: blob,
                composedImageBase64: base64,
                autoRotated: photo.autoRotated || false,
                takenAt: photo.takenAt,
            };
            
            // 满版样式需要裁切信息
            if (style === 'full_bleed') {
                photoData.cropInfo = calculateCropInfo(photo, aspectRatio);
            }
            
            photoDataList.push(photoData);
        } catch (error) {
            console.error(`照片 ${photo.id} 处理失败:`, error);
            throw error;
        }
    }
    
    return {
        orderInfo: {
            size,
            style,
            totalQuantity,
            totalPrice,
            shippingFee,
        },
        watermarkConfig,
        photos: photoDataList,
        submitTime: new Date().toISOString(),
    };
};

/**
 * 模拟提交订单（用于测试）
 */
export const mockSubmitOrder = async (orderData: OrderSubmitData): Promise<void> => {
    console.log('========== 订单提交数据 ==========');
    console.log('📦 订单信息:', orderData.orderInfo);
    console.log('🎨 水印配置:', orderData.watermarkConfig);
    console.log('📅 提交时间:', orderData.submitTime);
    console.log('');
    
    console.log(`📸 共 ${orderData.photos.length} 张照片:`);
    orderData.photos.forEach((photo, index) => {
        console.log(`\n--- 照片 ${index + 1} ---`);
        console.log('  ID:', photo.id);
        console.log('  数量:', photo.quantity);
        console.log('  原始尺寸:', `${photo.originalWidth} x ${photo.originalHeight}`);
        console.log('  是否自动旋转:', photo.autoRotated);
        console.log('  拍摄日期:', photo.takenAt || '无');
        console.log('  合成图片大小:', `${(photo.composedImageBlob.size / 1024).toFixed(2)} KB`);
        
        if (photo.cropInfo) {
            console.log('  裁切信息:', {
                '裁切区域': `(${(photo.cropInfo.cropX * 100).toFixed(1)}%, ${(photo.cropInfo.cropY * 100).toFixed(1)}%)`,
                '裁切尺寸': `${(photo.cropInfo.cropWidth * 100).toFixed(1)}% x ${(photo.cropInfo.cropHeight * 100).toFixed(1)}%`,
                '旋转角度': `${photo.cropInfo.rotation}°`,
                '缩放比例': photo.cropInfo.scale.toFixed(2),
            });
        }
        
        // 显示合成后的图片预览（在新标签页打开）
        console.log('  合成图片预览 URL:', photo.composedImageBase64.substring(0, 100) + '...');
    });
    
    console.log('\n========== 提交数据完整对象 ==========');
    // 打印不含 base64 的精简版本（避免控制台过长）
    const simplifiedData = {
        ...orderData,
        photos: orderData.photos.map(p => ({
            ...p,
            composedImageBase64: '[BASE64_DATA]',
            composedImageBlob: `[Blob: ${(p.composedImageBlob.size / 1024).toFixed(2)} KB]`,
        })),
    };
    console.log(simplifiedData);
    
    // 模拟 API 请求
    console.log('\n🚀 模拟 API 请求...');
    
    // 构建 FormData（实际提交时使用）
    const formData = new FormData();
    formData.append('orderInfo', JSON.stringify(orderData.orderInfo));
    formData.append('watermarkConfig', JSON.stringify(orderData.watermarkConfig));
    formData.append('submitTime', orderData.submitTime);
    
    orderData.photos.forEach((photo, index) => {
        formData.append(`photos[${index}][id]`, photo.id);
        formData.append(`photos[${index}][quantity]`, photo.quantity.toString());
        formData.append(`photos[${index}][originalWidth]`, photo.originalWidth.toString());
        formData.append(`photos[${index}][originalHeight]`, photo.originalHeight.toString());
        formData.append(`photos[${index}][autoRotated]`, photo.autoRotated.toString());
        formData.append(`photos[${index}][image]`, photo.composedImageBlob, `photo_${photo.id}.jpg`);
        
        if (photo.takenAt) {
            formData.append(`photos[${index}][takenAt]`, photo.takenAt);
        }
        
        if (photo.cropInfo) {
            formData.append(`photos[${index}][cropInfo]`, JSON.stringify(photo.cropInfo));
        }
    });
    
    console.log('📋 FormData 已构建，字段列表:');
    for (const [key, value] of formData.entries()) {
        if (value instanceof Blob) {
            console.log(`  ${key}: [Blob: ${(value.size / 1024).toFixed(2)} KB]`);
        } else {
            console.log(`  ${key}:`, value);
        }
    }
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n✅ 模拟提交成功！');
    
    // 返回模拟响应
    return Promise.resolve();
};

