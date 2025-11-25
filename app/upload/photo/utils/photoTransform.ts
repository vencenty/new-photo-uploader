import { Photo, StyleType } from '../types/photo.types';

/**
 * 计算照片的初始缩放比例
 * @param photo 照片信息
 * @param containerWidth 容器宽度
 * @param containerHeight 容器高度
 * @param styleType 样式类型
 * @param rotation 旋转角度（可选，默认根据 autoRotated 判断）
 * @returns 缩放比例
 */
export function calculatePhotoScale(
    photo: Photo,
    containerWidth: number,
    containerHeight: number,
    styleType: StyleType,
    rotation?: number
): number {
    if (!photo.width || !photo.height) return 1;

    // 判断是否旋转（使用传入的 rotation 或者根据 autoRotated 判断）
    const isRotated = rotation !== undefined 
        ? (rotation % 180 === 90) 
        : (photo.autoRotated && !photo.transform);

    // 根据是否旋转，调整图片的实际宽高
    const actualWidth = isRotated ? photo.height : photo.width;
    const actualHeight = isRotated ? photo.width : photo.height;

    // 计算图片宽高比（使用旋转后的实际宽高）
    const imageAspectRatio = actualWidth / actualHeight;
    // 容器宽高比
    const containerAspectRatio = containerWidth / containerHeight;

    // 根据样式类型选择缩放逻辑
    let scale: number;
    if (styleType === 'white_margin') {
        // 留白模式：object-contain 逻辑，选择较小的缩放比例，确保完整显示
        if (imageAspectRatio > containerAspectRatio) {
            // 图片更宽，按宽度缩放
            scale = containerWidth / actualWidth;
        } else {
            // 图片更高或相等，按高度缩放
            scale = containerHeight / actualHeight;
        }
    } else {
        // 满版模式：object-cover 逻辑，选择较大的缩放比例，确保填满容器
        if (imageAspectRatio > containerAspectRatio) {
            // 图片更宽，按高度填满
            scale = containerHeight / actualHeight;
        } else {
            // 图片更高或相等，按宽度填满
            scale = containerWidth / actualWidth;
        }
    }

    return scale;
}

/**
 * 计算照片变换信息（用于未编辑的照片）
 * @param photo 照片信息
 * @param containerWidth 容器宽度
 * @param containerHeight 容器高度
 * @param styleType 样式类型
 * @returns 变换信息（position, scale, rotation）
 */
export function calculateDefaultTransform(
    photo: Photo,
    containerWidth: number,
    containerHeight: number,
    styleType: StyleType
) {
    if (!photo.width || !photo.height) {
        return null;
    }

    // 判断初始旋转角度
    const rotation = (photo.autoRotated && !photo.transform) ? 90 : 0;
    
    // 计算缩放
    const scale = calculatePhotoScale(
        photo,
        containerWidth,
        containerHeight,
        styleType,
        rotation
    );

    return {
        position: { x: 0, y: 0 },
        scale,
        rotation,
    };
}

/**
 * 缩放已保存的变换信息
 * @param photo 照片信息
 * @param currentContainerWidth 当前容器宽度
 * @returns 缩放后的变换信息
 */
export function scaleTransform(
    photo: Photo,
    currentContainerWidth: number
) {
    if (!photo.transform?.containerWidth || !photo.transform?.containerHeight) {
        return null;
    }

    const scaleRatio = currentContainerWidth / photo.transform.containerWidth;

    return {
        position: {
            x: photo.transform.position.x * scaleRatio,
            y: photo.transform.position.y * scaleRatio,
        },
        scale: photo.transform.scale * scaleRatio,
        rotation: photo.transform.rotation,
    };
}

