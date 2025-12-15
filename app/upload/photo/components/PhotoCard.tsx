'use client';

import { Photo, StyleType, WHITE_MARGIN_PERCENT, WatermarkConfig, WATERMARK_SIZES } from '../types/photo.types';
import { useRef, useEffect, useState } from 'react';
import { scaleTransform, calculateDefaultTransform } from '../utils/photoTransform';
import { formatDate } from '../utils/exifReader';

interface PhotoCardProps {
    photo: Photo;
    containerStyle: React.CSSProperties;
    styleType: StyleType;
    watermarkConfig: WatermarkConfig;
    isConfirmed: boolean;
    warningMessage: string | null;
    onRemove: () => void;
    onQuantityChange: (delta: number) => void;
    onConfirm: () => void;
    onEdit: () => void;
    disabled?: boolean;
}

// 获取水印位置样式
const getWatermarkPositionStyle = (position: string, isSmallCard: boolean = false): React.CSSProperties => {
    const padding = isSmallCard ? '4px' : '8px';
    const baseStyle: React.CSSProperties = { position: 'absolute' };
    
    switch (position) {
        case 'top-left':
            return { ...baseStyle, top: padding, left: padding };
        case 'top-center':
            return { ...baseStyle, top: padding, left: '50%', transform: 'translateX(-50%)' };
        case 'top-right':
            return { ...baseStyle, top: padding, right: padding };
        case 'bottom-left':
            return { ...baseStyle, bottom: padding, left: padding };
        case 'bottom-center':
            return { ...baseStyle, bottom: padding, left: '50%', transform: 'translateX(-50%)' };
        case 'bottom-right':
            return { ...baseStyle, bottom: padding, right: padding };
        // 新增：支持旋转后的中间位置
        case 'center-left':
            return { ...baseStyle, top: '50%', left: padding, transform: 'translateY(-50%)' };
        case 'center-right':
            return { ...baseStyle, top: '50%', right: padding, transform: 'translateY(-50%)' };
        default:
            return { ...baseStyle, bottom: padding, right: padding };
    }
};

export function PhotoCard({
    photo,
    containerStyle,
    styleType,
    watermarkConfig,
    isConfirmed,
    warningMessage,
    onRemove,
    onQuantityChange,
    onConfirm,
    onEdit,
    disabled = false,
}: PhotoCardProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const innerContainerRef = useRef<HTMLDivElement>(null);
    const [scaledTransform, setScaledTransform] = useState<{
        position: { x: number; y: number };
        scale: number;
        rotation: number;
    } | null>(null);

    // 处理图片点击，只有确认后才能进入编辑
    const handleImageClick = () => {
        // 如果禁用状态，直接返回
        if (disabled) {
            return;
        }

        // 如果有警告且未确认，不允许进入编辑页面
        if (warningMessage && !isConfirmed) {
            return;
        }
        onEdit();
    };

    // 获取基于原图方向的水印位置
    // 如果图片被旋转显示，水印位置也需要相应调整
    const getOriginalOrientationWatermarkPosition = (
        position: string, 
        isAutoRotated: boolean
    ): string => {
        if (!isAutoRotated) {
            return position;
        }
        
        // 横图旋转90°显示为竖图时，位置映射：
        // 原图 bottom-right → 旋转后应该在 top-right（因为原图的右边变成了上边）
        // 但我们需要的是：水印在原图的 bottom-right，旋转后在显示容器中的位置
        const rotatedPositionMap: Record<string, string> = {
            'bottom-right': 'top-right',    // 原图右下 → 旋转后变成右上（从原图视角看）
            'bottom-left': 'bottom-right',  // 原图左下 → 旋转后变成右下
            'bottom-center': 'center-right', // 原图下中 → 旋转后变成右中
            'top-right': 'top-left',        // 原图右上 → 旋转后变成左上
            'top-left': 'bottom-left',      // 原图左上 → 旋转后变成左下
            'top-center': 'center-left',    // 原图上中 → 旋转后变成左中
        };
        
        return rotatedPositionMap[position] || position;
    };

    // 渲染上传状态指示器
    const renderUploadStatus = () => {
        if (photo.uploadStatus === 'pending') {
            // 等待上传
            return (
                <div className="flex items-center gap-1 bg-gray-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>等待中</span>
                </div>
            );
        } else if (photo.uploadStatus === 'uploading') {
            // 正在上传
            return (
                <div className="flex items-center gap-1 bg-blue-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>上传中</span>
                </div>
            );
        } else if (photo.uploadStatus === 'error') {
            // 上传失败 - 重试中
            return (
                <div className="flex items-center gap-1 bg-red-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>重试中{photo.retryCount ? ` (${photo.retryCount}/3)` : ''}</span>
                </div>
            );
        } else if (photo.uploadStatus === 'success') {
            // 上传成功
            return (
                <div className="flex items-center gap-1 bg-green-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>已上传</span>
                </div>
            );
        } else if (photo.photoUrl === 'failed') {
            // 最终失败
            return (
                <div className="flex items-center gap-1 bg-red-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>失败</span>
                </div>
            );
        }
        return null;
    };

    // 渲染水印
    const renderWatermark = () => {
        // 如果水印未启用或照片没有拍摄日期，不渲染
        if (!watermarkConfig.enabled || !photo.takenAt) {
            return null;
        }

        const sizeConfig = WATERMARK_SIZES.find(s => s.value === watermarkConfig.size);
        // PhotoCard 中字体缩小（约 60%）
        const fontSize = (sizeConfig?.fontSize || 16) * 0.6;

        // 根据颜色类型选择不同的阴影效果
        const isLightColor = ['#FFFFFF', '#FFD700'].includes(watermarkConfig.color);
        const textShadow = isLightColor
            ? '0 1px 2px rgba(0,0,0,0.6)'
            : `0 0 4px ${watermarkConfig.color}40, 0 0 2px ${watermarkConfig.color}60`;

        // 获取当前的旋转角度
        const rotation = scaledTransform?.rotation || (photo.autoRotated ? 90 : 0);
        const isRotated90or270 = rotation % 180 !== 0;
        
        // 根据原图方向调整水印位置
        const adjustedPosition = getOriginalOrientationWatermarkPosition(
            watermarkConfig.position,
            isRotated90or270
        );

        return (
            <div
                className="pointer-events-none z-20 whitespace-nowrap"
                style={{
                    ...getWatermarkPositionStyle(adjustedPosition, true),
                    fontFamily: "var(--font-dseg), monospace",
                    color: watermarkConfig.color,
                    fontSize: `${fontSize}px`,
                    opacity: watermarkConfig.opacity / 100,
                    textShadow,
                    letterSpacing: '1px',
                    // 如果图片旋转了，水印也需要旋转以匹配原图方向
                    transform: isRotated90or270 
                        ? `${getWatermarkPositionStyle(adjustedPosition, true).transform || ''} rotate(-90deg)`.trim()
                        : getWatermarkPositionStyle(adjustedPosition, true).transform,
                    transformOrigin: 'center',
                }}
            >
                {formatDate(photo.takenAt, watermarkConfig.dateFormat)}
            </div>
        );
    };

    // 当容器尺寸或照片变化时，重新计算缩放后的变换
    useEffect(() => {
        // 优先使用缩略图尺寸
        const width = photo.thumbnailWidth || photo.width;
        const height = photo.thumbnailHeight || photo.height;
        
        if (!width || !height) {
            setScaledTransform(null);
            return;
        }

        // 使用 requestAnimationFrame 确保容器已完成渲染
        const updateTransform = () => {
            const targetRef = styleType === 'white_margin' ? innerContainerRef : containerRef;
            if (!targetRef.current) return;
            
            const currentWidth = targetRef.current.offsetWidth;
            const currentHeight = targetRef.current.offsetHeight;
            
            // 如果容器宽度为 0，说明还没渲染完成，延迟更新
            if (currentWidth === 0) {
                requestAnimationFrame(updateTransform);
                return;
            }

            if (photo.transform) {
                // 如果有编辑信息，按比例缩放（使用公共函数）
                const scaled = scaleTransform(photo, currentWidth);
                setScaledTransform(scaled);
            } else {
                // 使用默认变换（未编辑的照片，包括自动旋转）
                const defaultTransform = calculateDefaultTransform(
                    photo,
                    currentWidth,
                    currentHeight,
                    styleType
                );
                setScaledTransform(defaultTransform);
            }
        };

        requestAnimationFrame(updateTransform);
    }, [photo, photo.transform, photo.autoRotated, styleType]);

    return (
        <div className="flex-1 relative">
            <div
                ref={containerRef}
                className="bg-white overflow-hidden shadow-sm relative"
                style={containerStyle}
            >
                {styleType === 'white_margin' ? (
                    // 留白样式 - 添加等比白边（与 PhotoEditor 保持相同比例）
                    <div 
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ padding: `${WHITE_MARGIN_PERCENT}%` }}
                    >
                        {/* 删除按钮 */}
                        <button
                            onClick={() => !disabled && onRemove()}
                            disabled={disabled}
                            className={`absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white transition-all ${
                                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-opacity-70'
                            }`}
                        >
                            ×
                        </button>

                        {/* 上传状态指示器 */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                            {renderUploadStatus()}
                        </div>

                        {/* 图片区域 */}
                        <div
                            ref={innerContainerRef}
                            className={`w-full h-full bg-gray-50 overflow-hidden ${
                                disabled || (warningMessage && !isConfirmed) ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            onClick={handleImageClick}
                        >
                            {scaledTransform ? (
                                // 有 transform 信息（编辑后或自动旋转）
                                <div className="relative w-full h-full">
                                    <img
                                        src={photo.url}
                                        alt="照片"
                                        className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                        style={{
                                            transform: `translate(-50%, -50%) translate(${scaledTransform.position.x}px, ${scaledTransform.position.y}px) scale(${scaledTransform.scale}) rotate(${scaledTransform.rotation}deg)`,
                                            width: (photo.thumbnailWidth || photo.width) ? `${photo.thumbnailWidth || photo.width}px` : 'auto',
                                            height: (photo.thumbnailHeight || photo.height) ? `${photo.thumbnailHeight || photo.height}px` : 'auto',
                                        }}
                                        onError={(e) => {
                                            console.error('图片加载失败:', photo.url);
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            ) : (
                                // 没有任何变换，使用默认的 object-contain
                                <img
                                    src={photo.url}
                                    alt="照片"
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        console.error('图片加载失败:', photo.url);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            )}

                            {/* 日期水印 */}
                            {renderWatermark()}

                            {/* 只对未确认且有警告的照片显示警告遮罩层 */}
                            {!isConfirmed && warningMessage && (
                                <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40 z-30">
                                    {/* 动态提示文字 */}
                                    <div className="text-lg font-medium text-red-100 mb-2">
                                        {warningMessage}
                                    </div>

                                    {/* 确认按钮 */}
                                    <button
                                        className={`px-2 py-1.5 rounded-xl text-center text-sm font-medium active:scale-95 transition ${
                                            disabled
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-black hover:bg-gray-100'
                                        }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            !disabled && onConfirm();
                                        }}
                                        disabled={disabled}
                                    >
                                        确认使用
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // 满版样式 - 原有的显示方式
                    <div className="absolute inset-0">
                        {/* 删除按钮 */}
                        <button
                            onClick={() => !disabled && onRemove()}
                            disabled={disabled}
                            className={`absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white transition-all ${
                                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-opacity-70'
                            }`}
                        >
                            ×
                        </button>

                        {/* 上传状态指示器 */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                            {renderUploadStatus()}
                        </div>

                        {/* 图片 */}
                        <div
                            className={`w-full h-full overflow-hidden ${
                                disabled || (warningMessage && !isConfirmed) ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            onClick={handleImageClick}
                        >
                            {scaledTransform ? (
                                // 有 transform 信息（编辑后或自动旋转）
                                <div className="relative w-full h-full">
                                    <img
                                        src={photo.url}
                                        alt="照片"
                                        className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                        style={{
                                            transform: `translate(-50%, -50%) translate(${scaledTransform.position.x}px, ${scaledTransform.position.y}px) scale(${scaledTransform.scale}) rotate(${scaledTransform.rotation}deg)`,
                                            width: (photo.thumbnailWidth || photo.width) ? `${photo.thumbnailWidth || photo.width}px` : 'auto',
                                            height: (photo.thumbnailHeight || photo.height) ? `${photo.thumbnailHeight || photo.height}px` : 'auto',
                                        }}
                                        onError={(e) => {
                                            console.error('图片加载失败:', photo.url);
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            ) : (
                                // 没有任何变换，使用默认的 object-cover
                                <img
                                    src={photo.url}
                                    alt="照片"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.error('图片加载失败:', photo.url);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            )}

                            {/* 日期水印 */}
                            {renderWatermark()}

                            {/* 只对未确认且有警告的照片显示警告遮罩层 */}
                            {!isConfirmed && warningMessage && (
                                <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40 z-30">
                                    {/* 动态提示文字 */}
                                    <div className="text-lg font-medium text-red-100 mb-2">
                                        {warningMessage}
                                    </div>

                                    {/* 确认按钮 */}
                                    <button
                                        className={`px-2 py-1.5 rounded-xl text-center text-sm font-medium active:scale-95 transition ${
                                            disabled
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-black hover:bg-gray-100'
                                        }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            !disabled && onConfirm();
                                        }}
                                        disabled={disabled}
                                    >
                                        确认使用
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 数量调整器 */}
            <div className="mt-2 flex items-center justify-center gap-3 bg-white rounded-full py-2 shadow-sm">
                <button
                    onClick={() => !disabled && onQuantityChange(-1)}
                    className={`w-6 h-6 flex items-center justify-center ${
                        disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-orange-500'
                    }`}
                    disabled={disabled || photo.quantity <= 1}
                >
                    −
                </button>
                <span className="text-base font-medium w-8 text-center text-black">
                    {photo.quantity}
                </span>
                <button
                    onClick={() => !disabled && onQuantityChange(1)}
                    className={`w-6 h-6 flex items-center justify-center ${
                        disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-orange-500'
                    }`}
                    disabled={disabled}
                >
                    +
                </button>
            </div>
        </div>
    );
}




