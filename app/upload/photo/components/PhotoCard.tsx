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
        // 如果有警告且未确认，不允许进入编辑页面
        if (warningMessage && !isConfirmed) {
            return;
        }
        onEdit();
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
            ? '0 1px 2px rgba(0,0,0,0.6)'  // 亮色用深色阴影
            : `0 0 4px ${watermarkConfig.color}40, 0 0 2px ${watermarkConfig.color}60`; // 深色用自身颜色的柔和发光

        return (
            <div
                className="pointer-events-none z-20 whitespace-nowrap"
                style={{
                    ...getWatermarkPositionStyle(watermarkConfig.position, true),
                    fontFamily: "var(--font-dseg), monospace",
                    color: watermarkConfig.color,
                    fontSize: `${fontSize}px`,
                    opacity: watermarkConfig.opacity / 100,
                    textShadow,
                    letterSpacing: '1px',
                }}
            >
                {formatDate(photo.takenAt, watermarkConfig.dateFormat)}
            </div>
        );
    };

    // 当容器尺寸或照片变化时，重新计算缩放后的变换
    useEffect(() => {
        if (!photo.width || !photo.height) {
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
                            onClick={onRemove}
                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                        >
                            ×
                        </button>

                        {/* 图片区域 */}
                        <div
                            ref={innerContainerRef}
                            className={`w-full h-full bg-gray-50 overflow-hidden ${
                                warningMessage && !isConfirmed ? 'cursor-not-allowed' : 'cursor-pointer'
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
                                            width: photo.width ? `${photo.width}px` : 'auto',
                                            height: photo.height ? `${photo.height}px` : 'auto',
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
                                        className="px-2 py-1.5 bg-white text-black rounded-xl text-center text-sm font-medium active:scale-95 transition hover:bg-gray-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onConfirm();
                                        }}
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
                            onClick={onRemove}
                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                        >
                            ×
                        </button>

                        {/* 图片 */}
                        <div
                            className={`w-full h-full overflow-hidden ${
                                warningMessage && !isConfirmed ? 'cursor-not-allowed' : 'cursor-pointer'
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
                                            width: photo.width ? `${photo.width}px` : 'auto',
                                            height: photo.height ? `${photo.height}px` : 'auto',
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
                                        className="px-2 py-1.5 bg-white text-black rounded-xl text-center text-sm font-medium active:scale-95 transition hover:bg-gray-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onConfirm();
                                        }}
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
                    onClick={() => onQuantityChange(-1)}
                    className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                    disabled={photo.quantity <= 1}
                >
                    −
                </button>
                <span className="text-base font-medium w-8 text-center text-black">
                    {photo.quantity}
                </span>
                <button
                    onClick={() => onQuantityChange(1)}
                    className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                >
                    +
                </button>
            </div>
        </div>
    );
}




