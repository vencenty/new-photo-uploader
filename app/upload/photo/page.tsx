'use client';

import { useState, useRef } from 'react';
import { 
    Photo, 
    PhotoSize, 
    StyleType, 
    PHOTO_SIZES,
    WatermarkConfig,
    DEFAULT_WATERMARK_CONFIG,
    WATERMARK_POSITIONS,
    WATERMARK_SIZES,
    DATE_FORMATS,
    WATERMARK_COLORS,
} from './types/photo.types';
import { PhotoEditor } from './components/PhotoEditor';
import { SizeSelector } from './components/SizeSelector';
import { PhotoCard } from './components/PhotoCard';
import { getPhotoWarning } from './utils/photoValidation';
import { readExifDate, getFileDateFallback } from './utils/exifReader';
import { prepareOrderSubmitData, mockSubmitOrder, downloadAllPhotos } from './utils/photoSubmit';
import { isHeicFile, convertHeicToJpeg } from './utils/heicConverter';
import { submitOrderToServer, checkServerConnection, SubmitProgressCallback } from './utils/submitApi';
import { SubmitLoading } from './components/SubmitLoading';

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

export default function PhotoPrintPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [selectedSize, setSelectedSize] = useState<PhotoSize>('5寸');
    const [selectedStyle, setSelectedStyle] = useState<StyleType>('full_bleed');
    const [showSizeSelector, setShowSizeSelector] = useState(false);
    const [confirmedPhotos, setConfirmedPhotos] = useState<Set<string>>(new Set());
    const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
    const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
    const [showWatermarkConfig, setShowWatermarkConfig] = useState(false);

    const PRICE_PER_PHOTO = 3.5;
    const SHIPPING_FEE = 6;
    const FREE_SHIPPING_THRESHOLD = 20;

    const totalQuantity = photos.reduce((sum, photo) => sum + photo.quantity, 0);
    const subtotal = totalQuantity * PRICE_PER_PHOTO;
    const shippingFee = totalQuantity >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shippingFee;
    const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalQuantity);

    // 获取当前选择的宽高比
    const currentAspectRatio =
        PHOTO_SIZES.find((s) => s.size === selectedSize)?.aspectRatio || 7 / 10;

    // 计算照片容器的样式（基于宽高比）
    const getPhotoContainerStyle = () => {
        return {
            paddingTop: `${(1 / currentAspectRatio) * 100}%`,
        };
    };

    const handleQuantityChange = (id: string, delta: number) => {
        setPhotos(
            photos.map((photo) => {
            if (photo.id === id) {
                const newQuantity = Math.max(1, photo.quantity + delta);
                return { ...photo, quantity: newQuantity };
            }
            return photo;
            })
        );
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(photos.filter((photo) => photo.id !== id));
        setConfirmedPhotos((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const handleClearAll = () => {
        setPhotos([]);
        setConfirmedPhotos(new Set());
    };

    const handleConfirmPhoto = (id: string) => {
        setConfirmedPhotos((prev) => new Set(prev).add(id));
    };

    const handleAddPhoto = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const errors: string[] = [];

        // 逐个加载和渲染照片
        for (const file of Array.from(files)) {
            // 检查是否为图片（包括 HEIC）
            const isImage = file.type.startsWith('image/') || isHeicFile(file);
            if (!isImage) {
                errors.push(`${file.name} 不是图片文件`);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name} 超过50MB限制`);
                continue;
            }

            try {
                let imageBlob: Blob = file;
                let wasHeicConverted = false;

                // 如果是 HEIC 文件，先转换为 JPEG
                if (isHeicFile(file)) {
                    console.log(`🔄 转换 HEIC 文件: ${file.name}`);
                    imageBlob = await convertHeicToJpeg(file);
                    wasHeicConverted = true;
                    console.log(`✅ HEIC 转换完成: ${file.name}`);
                }

                const imageUrl = URL.createObjectURL(imageBlob);

                // 并行读取图片尺寸和 EXIF 日期
                // 注意：EXIF 从原始文件读取（HEIC 转换后会丢失）
                const [dimensions, exifDate] = await Promise.all([
                    new Promise<{ width: number; height: number }>((resolve, reject) => {
                        const img = document.createElement('img');
                        img.onload = () => {
                            resolve({ width: img.width, height: img.height });
                        };
                        img.onerror = () => reject(new Error('图片加载失败'));
                        img.src = imageUrl;
                    }),
                    // 从原始文件读取 EXIF（包括 HEIC）
                    readExifDate(file),
                ]);

                // 如果 EXIF 读取失败，使用文件修改日期作为备选
                const takenAt = exifDate || getFileDateFallback(file);
                console.log(`📅 照片日期: ${takenAt} (${exifDate ? 'EXIF' : '文件日期'})`);

                const { width, height } = dimensions;

                // 检测是否为横图（宽度大于高度）
                const isLandscape = width > height;

                const newPhoto: Photo = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: imageUrl,
                    quantity: 1,
                    fileSize: file.size,
                    width,
                    height,
                    autoRotated: isLandscape, // 标记横图需要自动旋转
                    takenAt, // 从 EXIF 读取的拍摄日期
                };

                // 每加载完一张照片就立即添加到列表中
                setPhotos((prevPhotos) => [...prevPhotos, newPhoto]);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                errors.push(`${file.name}: ${errorMessage}`);
                console.error(`图片加载错误:`, error);
            }
        }

        if (errors.length > 0) {
            alert(`以下文件处理失败:\n${errors.join('\n')}`);
        }

        event.target.value = '';
    };


    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');
    const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStep, setUploadStep] = useState('');

    const handleDownloadAll = async () => {
        if (photos.length === 0) {
            alert('请先添加照片');
            return;
        }

        setIsDownloading(true);
        setDownloadProgress('准备下载...');

        try {
            await downloadAllPhotos(
                photos,
                watermarkConfig,
                selectedStyle,
                currentAspectRatio,
                (current, total, message) => {
                    setDownloadProgress(`${current}/${total}: ${message}`);
                }
            );

            setDownloadProgress('');
            alert('所有照片下载完成！');

        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败，请重试');
        } finally {
            setIsDownloading(false);
            setDownloadProgress('');
        }
    };

    const handleSubmitOrder = async () => {
        if (photos.length === 0) {
            alert('请先添加照片');
            return;
        }

        // 检查是否有未确认的警告照片
        const unconfirmedPhotos = photos.filter(
            p => getPhotoWarning(p) && !confirmedPhotos.has(p.id)
        );
        if (unconfirmedPhotos.length > 0) {
            alert(`还有 ${unconfirmedPhotos.length} 张照片需要确认后才能提交`);
            return;
        }

        // 检查服务器连接
        setUploadStep('检查服务器连接...');
        setIsUploadSubmitting(true);
        setUploadProgress(5);

        // const isServerConnected = await checkServerConnection();
        // if (!isServerConnected) {
        //     alert('无法连接到服务器，请检查网络连接或稍后重试');
        //     setIsUploadSubmitting(false);
        //     return;
        // }

        try {
            setUploadStep('正在准备订单数据...');
            setUploadProgress(10);

            // 准备订单数据（包含 canvas 合成水印）
            const orderData = await prepareOrderSubmitData(
                photos,
                selectedSize,
                selectedStyle,
                currentAspectRatio,
                watermarkConfig,
                PRICE_PER_PHOTO,
                shippingFee
            );

            // 调试：输出本次提交的全部参数
            const orderParamsSnake = toSnakeCaseKeys({
                selectedSize,
                selectedStyle,
                currentAspectRatio,
                watermarkConfig,
                pricePerPhoto: PRICE_PER_PHOTO,
                shippingFee,
                photosCount: photos.length,
                orderData,
            });
            console.log('[订单提交参数]', orderParamsSnake);

            // 提交到服务器的进度回调
            const progressCallback: SubmitProgressCallback = (step, progress) => {
                setUploadStep(step);
                setUploadProgress(progress);
            };

            // 提交到服务器
            const result = await submitOrderToServer(orderData, progressCallback);

            if (result.success) {
                setUploadStep('订单提交成功！');
                setUploadProgress(100);

                // 短暂延迟显示成功状态
                await new Promise(resolve => setTimeout(resolve, 1000));

                alert(`订单提交成功！订单号: ${result.orderId || '未知'}`);

                // 清空照片列表，准备新订单
                setPhotos([]);
                setConfirmedPhotos(new Set());

            } else {
                throw new Error(result.message || '提交失败');
            }

        } catch (error) {
            console.error('订单提交失败:', error);
            alert(`订单提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsUploadSubmitting(false);
            setUploadProgress(0);
            setUploadStep('');
        }
    };

    return (
        <>
            {/* 隐藏的文件输入元素 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            <div className="min-h-screen flex flex-col">
                {/* 顶部导航栏 */}
                <header className="bg-white border-b sticky top-0 z-10">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            className={`text-2xl ${isUploadSubmitting ? 'text-gray-400 cursor-not-allowed' : 'text-black'}`}
                            onClick={() => !isUploadSubmitting && window.history.back()}
                            disabled={isUploadSubmitting}
                        >
                            ←
                        </button>
                        <h1 className="text-lg font-medium text-black">测试上传</h1>
                        <button
                            className={`text-sm ${isUploadSubmitting ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600'}`}
                            onClick={() => !isUploadSubmitting && handleClearAll()}
                            disabled={isUploadSubmitting}
                        >
                            清空
                        </button>
                    </div>
                </header>

                {/* 规格选择区域 */}
                <div className="bg-white px-4 py-3 border-b">
                <div
                    className={`flex items-center justify-between ${isUploadSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    onClick={() => !isUploadSubmitting && setShowSizeSelector(true)}
                >
                        <span className="text-sm text-gray-600">规格</span>
                        <div className="flex items-center gap-2">
                            <div className="text-right">
                                <div className="text-sm text-gray-900">
                                    {PHOTO_SIZES.find((s) => s.size === selectedSize)?.label}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {PHOTO_SIZES.find((s) => s.size === selectedSize)?.styles.find((st) => st.type === selectedStyle)?.label}
                                </div>
                            </div>
                            <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 日期水印配置区域 */}
                <div className="bg-white px-4 py-3 border-b">
                    <div
                        className={`flex items-center justify-between ${isUploadSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        onClick={() => !isUploadSubmitting && setShowWatermarkConfig(!showWatermarkConfig)}
                    >
                        <span className="text-sm text-gray-600">日期水印</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900">
                                {watermarkConfig.enabled ? '已开启' : '未开启'}
                            </span>
                            <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${showWatermarkConfig ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* 展开的配置面板 */}
                    {showWatermarkConfig && (
                        <div className="mt-4 space-y-4">
                            {/* 开关 */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">添加拍摄日期</span>
                                <button
                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${
                                        watermarkConfig.enabled ? 'bg-orange-500' : 'bg-gray-300'
                                    }`}
                                >
                                    <span 
                                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            watermarkConfig.enabled ? 'translate-x-7' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {watermarkConfig.enabled && (
                                <>
                                    {/* 位置选择 */}
                                    <div>
                                        <span className="text-sm text-gray-700 block mb-2">位置</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {WATERMARK_POSITIONS.map((pos) => (
                                                <button
                                                    key={pos.value}
                                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, position: pos.value }))}
                                                    className={`py-2 px-3 text-xs rounded-lg border transition-colors ${
                                                        watermarkConfig.position === pos.value
                                                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {pos.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 大小选择 */}
                                    <div>
                                        <span className="text-sm text-gray-700 block mb-2">大小</span>
                                        <div className="flex gap-2">
                                            {WATERMARK_SIZES.map((size) => (
                                                <button
                                                    key={size.value}
                                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, size: size.value }))}
                                                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                                                        watermarkConfig.size === size.value
                                                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {size.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 日期格式 */}
                                    <div>
                                        <span className="text-sm text-gray-700 block mb-2">日期格式</span>
                                        <div className="space-y-2">
                                            {DATE_FORMATS.map((format) => (
                                                <button
                                                    key={format.value}
                                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, dateFormat: format.value }))}
                                                    className={`w-full py-2 px-3 text-left text-sm rounded-lg border transition-colors flex justify-between items-center ${
                                                        watermarkConfig.dateFormat === format.value
                                                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <span>{format.label}</span>
                                                    <span className="text-gray-400">{format.example}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 颜色选择 */}
                                    <div>
                                        <span className="text-sm text-gray-700 block mb-2">颜色</span>
                                        <div className="flex gap-2">
                                            {WATERMARK_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setWatermarkConfig(prev => ({ ...prev, color }))}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                                        watermarkConfig.color === color
                                                            ? 'border-orange-500 scale-110'
                                                            : 'border-gray-200'
                                                    }`}
                                                    style={{ 
                                                        backgroundColor: color,
                                                        boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px #e5e7eb' : undefined 
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* 透明度 */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-gray-700">透明度</span>
                                            <span className="text-sm text-gray-500">{watermarkConfig.opacity}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="20"
                                            max="100"
                                            value={watermarkConfig.opacity}
                                            onChange={(e) => setWatermarkConfig(prev => ({ 
                                                ...prev, 
                                                opacity: parseInt(e.target.value) 
                                            }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* 打印区域示意 */}
                <div className="px-4 py-3 bg-white border-b">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>显示区域即为打印区域，请点击图片进行调整</span>
                    </div>
                </div>

                {/* 照片列表区域 */}
                <div className="flex-1 px-4 py-4 bg-gray-50">
                    <div className="space-y-4">
                        {Array.from({ length: Math.ceil((photos.length + 1) / 3) }).map(
                            (_, rowIndex) => {
                                const items = [];

                                // 第一行第一个位置：添加按钮
                                if (rowIndex === 0) {
                                    items.push(
                                        <div key="add-button" className="flex-1 relative">
                            <button
                                onClick={() => !isUploadSubmitting && handleAddPhoto()}
                                disabled={isUploadSubmitting}
                                                className={`absolute inset-0 bg-white border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
                                                    isUploadSubmitting
                                                        ? 'border-gray-200 cursor-not-allowed opacity-60'
                                                        : 'border-gray-300 hover:border-orange-500'
                                                }`}
                            >
                                <div className="text-4xl text-gray-300 mb-2">+</div>
                                <div className="text-sm text-gray-400">添加照片</div>
                            </button>
                            <div style={getPhotoContainerStyle()}></div>
                        </div>
                                    );
                                }

                                // 计算当前行应该显示的照片
                                const startIndex = rowIndex === 0 ? 0 : rowIndex * 3 - 1;
                                const photosInRow = rowIndex === 0 ? 2 : 3;
                                const rowPhotos = photos.slice(startIndex, startIndex + photosInRow);

                                // 添加照片项
                                rowPhotos.forEach((photo) => {
                                    items.push(
                                        <PhotoCard
                                            key={photo.id}
                                            photo={photo}
                                            containerStyle={getPhotoContainerStyle()}
                                            styleType={selectedStyle}
                                            watermarkConfig={watermarkConfig}
                                            isConfirmed={confirmedPhotos.has(photo.id)}
                                            warningMessage={getPhotoWarning(photo)}
                                            onRemove={() => handleRemovePhoto(photo.id)}
                                            onQuantityChange={(delta) =>
                                                handleQuantityChange(photo.id, delta)
                                            }
                                            onConfirm={() => !isUploadSubmitting && handleConfirmPhoto(photo.id)}
                                            onEdit={() => {
                                                if (!isUploadSubmitting) {
                                                    const index = photos.findIndex(p => p.id === photo.id);
                                                    if (index !== -1) {
                                                        setEditingPhotoIndex(index);
                                                    }
                                                }
                                            }}
                                            disabled={isUploadSubmitting}
                                        />
                                    );
                                });

                                // 填充空白项以保持对齐
                                while (items.length < 3) {
                                    items.push(
                                        <div
                                            key={`placeholder-${rowIndex}-${items.length}`}
                                            className="flex-1"
                                        ></div>
                                    );
                                }

                                return (
                                    <div key={`row-${rowIndex}`} className="flex gap-3">
                                        {items}
                                    </div>
                                );
                            }
                        )}
                        </div>
                </div>

                {/* 底部结算区域 */}
                <div className="bg-white border-t px-4 py-3 sticky bottom-0">
                    {/* 包邮提示 */}
                    {remainingForFreeShipping > 0 && (
                        <div className="text-sm text-orange-500 mb-2">
                            {/* 满 {FREE_SHIPPING_THRESHOLD} 张包邮，还差 {remainingForFreeShipping}{' '} */}
                            {/* 张 */}
                        </div>
                    )}
                    {remainingForFreeShipping === 0 && (
                        <div className="text-sm text-green-500 mb-2">已满足包邮条件 🎉</div>
                    )}

                    {/* 下载进度提示 */}
                    {isDownloading && downloadProgress && (
                        <div className="text-sm text-blue-500 mb-2">
                            {downloadProgress}
                        </div>
                    )}

                    {/* 价格和按钮 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm text-gray-500">合计</span>
                                <span className="text-xl font-bold text-orange-500">
                                    {/* ¥{total.toFixed(2)} */}
                                    {totalQuantity} 张
                                </span>
                            </div>
                            {/* <div className="text-xs text-gray-400 mt-1"> */}
                                {/* 共 {totalQuantity} 张 运费 ¥{shippingFee} */}
                            {/* </div> */}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 下载按钮 */}
                            <button
                                onClick={handleDownloadAll}
                                className={`text-white px-6 py-3 rounded-full font-medium text-base transition-colors shadow-lg ${
                                    isDownloading || photos.length === 0
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                                disabled={photos.length === 0 || isDownloading}
                            >
                                {isDownloading ? '下载中...' : '下载照片'}
                            </button>

                            {/* 提交按钮（暂时禁用） */}
                            <button
                                onClick={handleSubmitOrder}
                                className="bg-gray-400 cursor-not-allowed text-white px-6 py-3 rounded-full font-medium text-base transition-colors shadow-lg"
                                disabled={false}
                                title="功能开发中"
                            >
                                提交订单
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 规格选择弹出层 */}
            {showSizeSelector && (
                <SizeSelector
                    selectedSize={selectedSize}
                    selectedStyle={selectedStyle}
                    onSelectSize={setSelectedSize}
                    onSelectStyle={setSelectedStyle}
                    onClose={() => setShowSizeSelector(false)}
                />
            )}

            {/* 照片编辑器弹窗 */}
            {editingPhotoIndex !== null && photos[editingPhotoIndex] && (
                <PhotoEditor
                    photos={photos}
                    currentIndex={editingPhotoIndex}
                    aspectRatio={currentAspectRatio}
                    styleType={selectedStyle}
                    watermarkConfig={watermarkConfig}
                    onClose={() => setEditingPhotoIndex(null)}
                    onSave={(updatedPhoto) => {
                        // 保存编辑后的照片信息
                        setPhotos(photos.map((p) => 
                            p.id === updatedPhoto.id ? updatedPhoto : p
                        ));
                    }}
                    onNavigate={(newIndex) => {
                        setEditingPhotoIndex(newIndex);
                    }}
                    onReplace={(oldPhoto, newPhoto) => {
                        // 替换照片
                        setPhotos(photos.map((p) => 
                            p.id === oldPhoto.id ? newPhoto : p
                        ));
                    }}
                />
            )}

            {/* 上传提交loading遮罩 */}
            {isUploadSubmitting && (
                <SubmitLoading
                    currentStep={uploadStep}
                    progress={uploadProgress}
                    canCancel={false} // 提交过程中不允许取消
                />
            )}
        </>
    );
}
