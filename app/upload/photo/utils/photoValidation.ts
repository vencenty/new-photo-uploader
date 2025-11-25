import { Photo } from '../types/photo.types';

/**
 * 获取照片的警告信息
 * @param photo 照片对象
 * @returns 警告信息字符串，如果没有警告则返回 null
 */
export function getPhotoWarning(photo: Photo): string | null {
    // TODO: 在这里添加更多的判断逻辑

    // 1. 检查文件大小 - 小于100KB可能模糊
    if (photo.fileSize < 100 * 1024) {
        return '照片模糊';
    }

    // 2. TODO: 检查图片分辨率是否足够
    // if (photo.width && photo.height) {
    //     const minResolution = 1200; // 最小分辨率要求
    //     if (photo.width < minResolution || photo.height < minResolution) {
    //         return '分辨率过低';
    //     }
    // }

    // 3. TODO: 检查宽高比是否合适
    // if (photo.width && photo.height) {
    //     const ratio = photo.width / photo.height;
    //     // 根据选择的规格检查宽高比
    // }

    // 4. TODO: 其他检查逻辑
    // - 检查图片是否过度压缩
    // - 检查图片质量
    // - 检查图片格式是否合适

    return null; // 没有警告
}


