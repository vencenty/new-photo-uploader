/**
 * HEIC 图片转换工具
 * 将 HEIC/HEIF 格式转换为 JPEG 格式
 */

/**
 * 检查文件是否为 HEIC/HEIF 格式
 */
export const isHeicFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    return (
        fileName.endsWith('.heic') ||
        fileName.endsWith('.heif') ||
        mimeType === 'image/heic' ||
        mimeType === 'image/heif'
    );
};

/**
 * 将 HEIC 文件转换为 JPEG Blob
 * 使用 heic2any 库进行转换
 */
export const convertHeicToJpeg = async (file: File): Promise<Blob> => {
    // 动态导入 heic2any（因为它只能在客户端运行）
    const heic2any = (await import('heic2any')).default;
    
    try {
        const result = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 1.0, // 100% 质量，不压缩
        });
        
        // heic2any 可能返回单个 Blob 或 Blob 数组
        if (Array.isArray(result)) {
            return result[0];
        }
        return result;
    } catch (error) {
        console.error('HEIC 转换失败:', error);
        throw new Error('HEIC 图片转换失败，请尝试使用其他格式');
    }
};

/**
 * 处理上传的文件，如果是 HEIC 则转换为 JPEG
 * 返回可用于显示的 Blob URL 和原始/转换后的文件
 */
export const processUploadedFile = async (
    file: File,
    onProgress?: (message: string) => void
): Promise<{
    url: string;
    blob: Blob;
    originalFile: File;
    wasConverted: boolean;
}> => {
    if (isHeicFile(file)) {
        onProgress?.('正在转换 HEIC 格式...');
        
        const jpegBlob = await convertHeicToJpeg(file);
        const url = URL.createObjectURL(jpegBlob);
        
        return {
            url,
            blob: jpegBlob,
            originalFile: file,
            wasConverted: true,
        };
    }
    
    // 非 HEIC 文件直接使用
    const url = URL.createObjectURL(file);
    return {
        url,
        blob: file,
        originalFile: file,
        wasConverted: false,
    };
};

