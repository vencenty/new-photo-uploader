'use client';

import { Photo, StyleType, WatermarkConfig, WATERMARK_SIZES, parseAffineMatrix } from '../types/photo.types';
import { useRef, useEffect, useState } from 'react';
import { formatDate } from '../utils/exifReader';
import { PhotoCanvas } from './PhotoCanvas';

interface PhotoCardProps {
    photo: Photo;
    containerStyle: React.CSSProperties;
    aspectRatio: number; // 添加宽高比参数
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
    aspectRatio,
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
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [isClient, setIsClient] = useState(false);

    // 客户端渲染检测
    useEffect(() => {
        setIsClient(true);
    }, []);

    // 计算容器尺寸
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateSize = () => {
            const container = containerRef.current;
            if (!container) return;
            
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            
            if (containerWidth > 0 && containerHeight > 0) {
                setStageSize({
                    width: containerWidth,
                    height: containerHeight,
                });
            }
        };
        
        // 使用 requestAnimationFrame 确保容器已渲染
        const rafId = requestAnimationFrame(updateSize);
        
        // 监听窗口大小变化
        window.addEventListener('resize', updateSize);
        
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updateSize);
        };
    }, [aspectRatio, photo.id]);

    // 处理图片点击
    const handleImageClick = () => {
        if (disabled) return;
        if (warningMessage && !isConfirmed) return;
        onEdit();
    };

    // 获取基于原图方向的水印位置
    const getOriginalOrientationWatermarkPosition = (
        position: string, 
        isAutoRotated: boolean
    ): string => {
        if (!isAutoRotated) return position;
        
        const rotatedPositionMap: Record<string, string> = {
            'bottom-right': 'top-right',
            'bottom-left': 'bottom-right',
            'bottom-center': 'center-right',
            'top-right': 'top-left',
            'top-left': 'bottom-left',
            'top-center': 'center-left',
        };
        
        return rotatedPositionMap[position] || position;
    };

    // 获取当前旋转角度
    const getCurrentRotation = (): number => {
        if (photo.transform) {
            const { rotation } = parseAffineMatrix(photo.transform.matrix);
            return rotation;
        }
        return photo.autoRotated ? 90 : 0;
    };

    // 渲染上传状态指示器
    const renderUploadStatus = () => {
        if (photo.uploadStatus === 'pending') {
            return (
                <div className="flex items-center gap-1 bg-gray-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>等待中</span>
                </div>
            );
        } else if (photo.uploadStatus === 'uploading') {
            return (
                <div className="flex items-center gap-1 bg-blue-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>上传中</span>
                </div>
            );
        } else if (photo.uploadStatus === 'error') {
            return (
                <div className="flex items-center gap-1 bg-red-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>重试中{photo.retryCount ? ` (${photo.retryCount}/3)` : ''}</span>
                </div>
            );
        } else if (photo.uploadStatus === 'success') {
            return (
                <div className="flex items-center gap-1 bg-green-500 bg-opacity-80 text-white text-xs px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>已上传</span>
                </div>
            );
        } else if (photo.photoUrl === 'failed') {
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
        if (!watermarkConfig.enabled || !photo.takenAt) return null;

        const sizeConfig = WATERMARK_SIZES.find(s => s.value === watermarkConfig.size);
        const fontSize = (sizeConfig?.fontSize || 16) * 0.6;

        const isLightColor = ['#FFFFFF', '#FFD700'].includes(watermarkConfig.color);
        const textShadow = isLightColor
            ? '0 1px 2px rgba(0,0,0,0.6)'
            : `0 0 4px ${watermarkConfig.color}40, 0 0 2px ${watermarkConfig.color}60`;

        const rotation = getCurrentRotation();
        const isRotated90or270 = rotation % 180 !== 0;
        
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

    // 渲染警告遮罩
    const renderWarningOverlay = () => {
        if (isConfirmed || !warningMessage) return null;
        
        return (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40 z-30">
                <div className="text-lg font-medium text-red-100 mb-2">
                    {warningMessage}
                </div>
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
        );
    };

    return (
        <div className="flex-1 relative">
            <div
                ref={containerRef}
                className="bg-white overflow-hidden shadow-sm relative"
                style={containerStyle}
            >
                {/* Canvas 区域 */}
                <div 
                    className={`absolute inset-0 ${
                        disabled || (warningMessage && !isConfirmed) ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                >
                    {/* Konva Canvas - 使用与 PhotoEditor 完全相同的渲染方式 */}
                    {isClient && stageSize.width > 0 && stageSize.height > 0 && (
                        <PhotoCanvas
                            photo={photo}
                            stageSize={stageSize}
                            styleType={styleType}
                            editable={false}
                            showOverlay={false} // 列表中不显示出血线/留白遮罩
                            onClick={handleImageClick}
                        />
                    )}
                    
                    {/* 水印叠加层 */}
                    {renderWatermark()}
                    
                    {/* 警告遮罩层 */}
                    {renderWarningOverlay()}
                </div>

                {/* 删除按钮 */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        !disabled && onRemove();
                    }}
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
