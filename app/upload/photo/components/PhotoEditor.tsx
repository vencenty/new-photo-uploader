'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Photo, StyleType, BLEED_AREA_PERCENT, WHITE_MARGIN_PERCENT, WatermarkConfig, WATERMARK_SIZES } from '../types/photo.types';
import { calculatePhotoScale } from '../utils/photoTransform';
import { formatDate } from '../utils/exifReader';

interface PhotoEditorProps {
    photos: Photo[];
    currentIndex: number;
    aspectRatio: number;
    styleType: StyleType;
    watermarkConfig: WatermarkConfig;
    onClose: () => void;
    onSave: (photo: Photo) => void;
    onNavigate: (index: number) => void;
    onReplace: (oldPhoto: Photo, newPhoto: Photo) => void;
}

// 获取水印位置样式
const getWatermarkPositionStyle = (position: string): React.CSSProperties => {
    const padding = '12px';
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
        // 支持旋转后的中间位置
        case 'center-left':
            return { ...baseStyle, top: '50%', left: padding, transform: 'translateY(-50%)' };
        case 'center-right':
            return { ...baseStyle, top: '50%', right: padding, transform: 'translateY(-50%)' };
        default:
            return { ...baseStyle, bottom: padding, right: padding };
    }
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
    
    // 横图旋转90°显示为竖图时，位置映射
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

export function PhotoEditor({ 
    photos, 
    currentIndex, 
    aspectRatio, 
    styleType, 
    watermarkConfig,
    onClose, 
    onSave, 
    onNavigate,
    onReplace 
}: PhotoEditorProps) {
    const photo = photos[currentIndex];
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [initialScale, setInitialScale] = useState(1);
    const [minScale, setMinScale] = useState(1);
    const [touchStartDistance, setTouchStartDistance] = useState(0);
    const [touchStartScale, setTouchStartScale] = useState(1);
    const [touchStartPosition, setTouchStartPosition] = useState({ x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const imageRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // 使用 ref 存储中间缩放状态，避免频繁 setState 导致抖动
    const pendingScaleRef = useRef<number | null>(null);
    const rafIdRef = useRef<number | null>(null);
    
    // 标记当前照片是否有未保存的修改
    const [hasChanges, setHasChanges] = useState(false);

    // 计算旋转后的边界框尺寸
    const getRotatedBounds = (width: number, height: number, angle: number) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        return {
            width: width * cos + height * sin,
            height: width * sin + height * cos,
        };
    };

    // 计算在给定缩放和旋转下的最小缩放比例
    const calculateMinScale = useCallback((rot: number) => {
        if (!photo?.width || !photo?.height || !containerRef.current) return 1;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // 获取旋转后的边界框
        const rotatedBounds = getRotatedBounds(photo.width, photo.height, rot);
        
        // 计算需要的最小缩放比例
        const scaleX = containerWidth / rotatedBounds.width;
        const scaleY = containerHeight / rotatedBounds.height;
        
        // 满版：使用 Math.max 确保图片能覆盖容器（可能裁切）
        // 留白：使用 Math.min 确保图片完全显示在容器内（object-contain）
        return styleType === 'white_margin' 
            ? Math.min(scaleX, scaleY)
            : Math.max(scaleX, scaleY);
    }, [photo, styleType]);

    // 限制位置
    const constrainPosition = useCallback((pos: { x: number; y: number }, currentScale: number, currentRotation: number) => {
        if (!photo?.width || !photo?.height || !containerRef.current) return pos;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // 计算缩放后的图片尺寸
        const scaledWidth = photo.width * currentScale;
        const scaledHeight = photo.height * currentScale;

        // 获取旋转后的边界
        const rotatedBounds = getRotatedBounds(scaledWidth, scaledHeight, currentRotation);

        if (styleType === 'white_margin') {
            // 留白模式：确保照片不会移出容器边界
            const maxOffsetX = Math.max(0, (rotatedBounds.width - containerWidth) / 2);
            const maxOffsetY = Math.max(0, (rotatedBounds.height - containerHeight) / 2);
            
            return {
                x: Math.max(-maxOffsetX, Math.min(maxOffsetX, pos.x)),
                y: Math.max(-maxOffsetY, Math.min(maxOffsetY, pos.y)),
            };
        } else {
            // 满版模式：防止出现白边，照片必须覆盖容器
            const maxOffsetX = Math.max(0, (rotatedBounds.width - containerWidth) / 2);
            const maxOffsetY = Math.max(0, (rotatedBounds.height - containerHeight) / 2);

            return {
                x: Math.max(-maxOffsetX, Math.min(maxOffsetX, pos.x)),
                y: Math.max(-maxOffsetY, Math.min(maxOffsetY, pos.y)),
            };
        }
    }, [photo, styleType]);

    // 保存当前照片的编辑状态
    const saveCurrentPhoto = useCallback(() => {
        if (!containerRef.current || !photo) return;
        
        const updatedPhoto = {
            ...photo,
            transform: {
                position,
                scale,
                rotation,
                containerWidth: containerRef.current.offsetWidth,
                containerHeight: containerRef.current.offsetHeight,
            },
        };
        onSave(updatedPhoto);
        setHasChanges(false);
    }, [photo, position, scale, rotation, onSave]);

    // 初始化图片尺寸
    useEffect(() => {
        if (!photo?.width || !photo?.height || !containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // 如果有保存的变换信息，使用保存的值；否则使用默认值
        if (photo.transform) {
            // 使用保存的变换
            const rot = photo.transform.rotation;
            const minS = calculateMinScale(rot);
            setMinScale(minS);
            
            // 确保缩放不小于最小值
            const safeScale = Math.max(minS, photo.transform.scale);
            setScale(safeScale);
            setRotation(rot);
            
            // 限制位置
            const constrainedPos = constrainPosition(photo.transform.position, safeScale, rot);
            setPosition(constrainedPos);
            
            // 计算初始缩放用于重置
            const initScale = calculatePhotoScale(
                photo,
                containerWidth,
                containerHeight,
                styleType,
                rot
            );
            setInitialScale(initScale);
        } else {
            // 使用公共函数计算初始缩放
            const initialRotation = photo.autoRotated ? 90 : 0;
            const newScale = calculatePhotoScale(
                photo,
                containerWidth,
                containerHeight,
                styleType,
                initialRotation
            );
            
            const minS = calculateMinScale(initialRotation);
            setMinScale(minS);
            setScale(newScale);
            setInitialScale(newScale);
            setPosition({ x: 0, y: 0 });
            setRotation(initialRotation);
        }
        setHasChanges(false);
    }, [photo, aspectRatio, styleType, calculateMinScale, constrainPosition]);

    // 清理 requestAnimationFrame
    useEffect(() => {
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    // 计算两个触摸点之间的距离
    const getTouchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // 计算双指中心点
    const getTouchCenter = (touches: React.TouchList) => {
        if (touches.length < 2) return { x: 0, y: 0 };
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // 取消任何待处理的动画帧
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        
        if (e.touches.length === 2) {
            // 双指缩放开始
            const distance = getTouchDistance(e.touches);
            setTouchStartDistance(distance);
            setTouchStartScale(scale);
            setTouchStartPosition({ ...position });
            setIsPinching(true);
            setIsDragging(false);
        } else if (e.touches.length === 1 && !isPinching) {
            // 单指拖拽（仅在非缩放状态下）
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartDistance > 0 && isPinching) {
            // 双指缩放 - 使用 requestAnimationFrame 平滑更新
            const distance = getTouchDistance(e.touches);
            const scaleRatio = distance / touchStartDistance;
            const newScale = Math.max(minScale, Math.min(touchStartScale * scaleRatio, touchStartScale * 3));
            
            // 存储待更新的缩放值
            pendingScaleRef.current = newScale;
            
            // 使用 requestAnimationFrame 批量更新
            if (!rafIdRef.current) {
                rafIdRef.current = requestAnimationFrame(() => {
                    if (pendingScaleRef.current !== null) {
                        const finalScale = pendingScaleRef.current;
                        setScale(finalScale);
                        
                        // 缩放后约束位置
                        const constrainedPos = constrainPosition(touchStartPosition, finalScale, rotation);
                        setPosition(constrainedPos);
                        
                        setHasChanges(true);
                        pendingScaleRef.current = null;
                    }
                    rafIdRef.current = null;
                });
            }
        } else if (isDragging && e.touches.length === 1 && !isPinching) {
            // 单指拖拽
            const newPosition = {
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            };
            const constrainedPos = constrainPosition(newPosition, scale, rotation);
            setPosition(constrainedPos);
            setHasChanges(true);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // 如果还有一个手指在屏幕上，可能是从双指变成单指
        if (e.touches.length === 1 && isPinching) {
            // 从双指缩放切换到单指拖拽
            setIsPinching(false);
            setTouchStartDistance(0);
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
            });
        } else if (e.touches.length === 0) {
            // 所有手指都离开
            setIsDragging(false);
            setIsPinching(false);
            setTouchStartDistance(0);
            
            // 清理 RAF
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const newPosition = {
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        };
        const constrainedPos = constrainPosition(newPosition, scale, rotation);
        setPosition(constrainedPos);
        setHasChanges(true);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // 滚轮缩放
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY / 1000;
        const newScale = Math.max(minScale, Math.min(scale * (1 + delta), scale * 3));
        
        setScale(newScale);
        setHasChanges(true);
        
        // 缩放后重新约束位置
        const constrainedPos = constrainPosition(position, newScale, rotation);
        setPosition(constrainedPos);
    };

    const handleRotate = () => {
        const newRotation = (rotation + 90) % 360;
        setRotation(newRotation);
        setHasChanges(true);
        
        // 重新计算最小缩放比例
        const newMinScale = calculateMinScale(newRotation);
        setMinScale(newMinScale);
        
        // 如果当前缩放小于新的最小缩放，调整它
        const newScale = Math.max(scale, newMinScale);
        setScale(newScale);
        
        // 重新约束位置
        const constrainedPos = constrainPosition(position, newScale, newRotation);
        setPosition(constrainedPos);
    };

    const handleReset = () => {
        setScale(initialScale);
        setPosition({ x: 0, y: 0 });
        setRotation(photo?.autoRotated ? 90 : 0);
        const newMinScale = calculateMinScale(photo?.autoRotated ? 90 : 0);
        setMinScale(newMinScale);
        setHasChanges(true);
    };

    const handleSave = () => {
        saveCurrentPhoto();
        onClose();
    };

    // 渲染水印
    const renderWatermark = () => {
        // 如果水印未启用或照片没有拍摄日期，不渲染
        if (!watermarkConfig.enabled || !photo?.takenAt) {
            return null;
        }

        const sizeConfig = WATERMARK_SIZES.find(s => s.value === watermarkConfig.size);
        const fontSize = sizeConfig?.fontSize || 16;

        // 根据颜色类型选择不同的阴影效果
        const isLightColor = ['#FFFFFF', '#FFD700'].includes(watermarkConfig.color);
        const textShadow = isLightColor
            ? '0 1px 3px rgba(0,0,0,0.6)'
            : `0 0 6px ${watermarkConfig.color}40, 0 0 3px ${watermarkConfig.color}60`;

        // 检查是否旋转了90度或270度
        const isRotated90or270 = rotation % 180 !== 0;
        
        // 根据原图方向调整水印位置
        const adjustedPosition = getOriginalOrientationWatermarkPosition(
            watermarkConfig.position,
            isRotated90or270
        );
        
        const basePositionStyle = getWatermarkPositionStyle(adjustedPosition);

        return (
            <div
                className="pointer-events-none z-20 whitespace-nowrap"
                style={{
                    ...basePositionStyle,
                    fontFamily: "var(--font-dseg), monospace",
                    color: watermarkConfig.color,
                    fontSize: `${fontSize}px`,
                    opacity: watermarkConfig.opacity / 100,
                    textShadow,
                    letterSpacing: '2px',
                    // 如果图片旋转了，水印也需要旋转以匹配原图方向
                    transform: isRotated90or270 
                        ? `${basePositionStyle.transform || ''} rotate(-90deg)`.trim()
                        : basePositionStyle.transform,
                    transformOrigin: 'center',
                }}
            >
                {formatDate(photo.takenAt, watermarkConfig.dateFormat)}
            </div>
        );
    };

    // 导航到上一张/下一张照片
    const handleNavigate = (direction: 'prev' | 'next') => {
        // 先自动保存当前照片的修改
        if (hasChanges) {
            saveCurrentPhoto();
        }
        
        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < photos.length) {
            onNavigate(newIndex);
        }
    };

    // 处理替换图片
    const handleReplaceClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert('图片大小不能超过50MB');
            return;
        }

        try {
            const imageUrl = URL.createObjectURL(file);

            const { width, height } = await new Promise<{
                width: number;
                height: number;
            }>((resolve, reject) => {
                const img = document.createElement('img');
                img.onload = () => {
                    resolve({ width: img.width, height: img.height });
                };
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = imageUrl;
            });

            // 检测是否为横图（宽度大于高度）
            const isLandscape = width > height;

            // 创建新的 Photo 对象，保留原照片的 id 和数量
            const newPhoto: Photo = {
                id: photo.id, // 保留原 ID
                url: imageUrl,
                quantity: photo.quantity, // 保留原数量
                fileSize: file.size,
                width,
                height,
                autoRotated: isLandscape, // 自动应用横图旋转
                // 不传递 transform，让新图片重新计算
            };

            // 释放旧的 blob URL
            if (photo.url.startsWith('blob:')) {
                URL.revokeObjectURL(photo.url);
            }

            // 调用替换回调
            onReplace(photo, newPhoto);

        } catch (error) {
            console.error('图片加载错误:', error);
            alert('图片加载失败，请重试');
        }

        // 清空 input 以便再次选择相同文件
        event.target.value = '';
    };

    if (!photo) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* 隐藏的文件输入 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* 顶部导航栏 */}
            <header className="bg-white border-b">
                <div className="flex items-center justify-between px-4 py-3">
                    <button 
                        className="text-2xl text-black" 
                        onClick={onClose}
                    >
                        ←
                    </button>
                    <h1 className="text-lg font-medium text-black">一刻相册</h1>
                    <button
                        className="bg-black text-white px-6 py-2 rounded-full text-sm font-medium"
                        onClick={handleSave}
                    >
                        完成
                    </button>
                </div>
            </header>

            {/* 提示信息 */}
            <div className="px-4 py-3 bg-gray-50 border-b">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>显示区域即为打印区域，请点击图片进行调整</span>
                </div>
                {styleType === 'full_bleed' && (
                    <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
                        <div 
                            className="w-4 h-4 rounded-sm"
                            style={{
                                background: `repeating-linear-gradient(
                                    -45deg,
                                    transparent,
                                    transparent 2px,
                                    rgba(239, 68, 68, 0.5) 2px,
                                    rgba(239, 68, 68, 0.5) 4px
                                )`,
                            }}
                        />
                        <span>斜线区域为出血区域，此区域内容可能被裁切</span>
                    </div>
                )}
            </div>

            {/* 图片编辑区域 */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
                <div className="relative w-full max-w-lg">
                    {/* 裁剪框 - 保持宽高比 */}
                    <div 
                        className="relative w-full bg-white shadow-2xl overflow-hidden"
                        style={{ 
                            paddingTop: `${(1 / aspectRatio) * 100}%`,
                        }}
                    >
                        {styleType === 'white_margin' ? (
                            // 留白样式 - 外层等比白边（约4mm）+ 内层 object-contain
                            <div 
                                className="absolute inset-0"
                                style={{ padding: `${WHITE_MARGIN_PERCENT}%` }}
                            >
                                <div 
                                    ref={containerRef}
                                    className="relative w-full h-full overflow-hidden"
                                >
                                    {/* 可拖动的图片 */}
                                    <div 
                                        ref={imageRef}
                                        className="absolute inset-0 cursor-move select-none touch-none"
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                        onWheel={handleWheel}
                                        onTouchStart={handleTouchStart}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                    >
                                        <img
                                            src={photo.url}
                                            alt="编辑照片"
                                            className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                            style={{
                                                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                                transition: isDragging ? 'none' : 'transform 0.3s ease',
                                                width: photo.width ? `${photo.width}px` : 'auto',
                                                height: photo.height ? `${photo.height}px` : 'auto',
                                            }}
                                            draggable={false}
                                        />
                                    </div>
                                    {/* 日期水印 */}
                                    {renderWatermark()}
                                </div>
                            </div>
                        ) : (
                            // 满版样式 - 原有的显示方式
                            <div 
                                ref={containerRef}
                                className="absolute inset-0"
                            >
                                {/* 可拖动的图片 */}
                                <div 
                                    ref={imageRef}
                                    className="absolute inset-0 cursor-move select-none touch-none"
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onWheel={handleWheel}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    <img
                                        src={photo.url}
                                        alt="编辑照片"
                                        className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                        style={{
                                            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                            transition: isDragging ? 'none' : 'transform 0.3s ease',
                                            width: photo.width ? `${photo.width}px` : 'auto',
                                            height: photo.height ? `${photo.height}px` : 'auto',
                                        }}
                                        draggable={false}
                                    />
                                </div>

                                {/* 日期水印 */}
                                {renderWatermark()}

                                {/* 出血线警告遮罩 - 四周斜线区域 */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* 上边出血区域 */}
                                    <div 
                                        className="absolute top-0 left-0 right-0"
                                        style={{
                                            height: `${BLEED_AREA_PERCENT}%`,
                                            background: `repeating-linear-gradient(
                                                -45deg,
                                                transparent,
                                                transparent 3px,
                                                rgba(239, 68, 68, 0.4) 3px,
                                                rgba(239, 68, 68, 0.4) 6px
                                            )`,
                                        }}
                                    />
                                    {/* 下边出血区域 */}
                                    <div 
                                        className="absolute bottom-0 left-0 right-0"
                                        style={{
                                            height: `${BLEED_AREA_PERCENT}%`,
                                            background: `repeating-linear-gradient(
                                                -45deg,
                                                transparent,
                                                transparent 3px,
                                                rgba(239, 68, 68, 0.4) 3px,
                                                rgba(239, 68, 68, 0.4) 6px
                                            )`,
                                        }}
                                    />
                                    {/* 左边出血区域 */}
                                    <div 
                                        className="absolute left-0"
                                        style={{
                                            top: `${BLEED_AREA_PERCENT}%`,
                                            bottom: `${BLEED_AREA_PERCENT}%`,
                                            width: `${BLEED_AREA_PERCENT}%`,
                                            background: `repeating-linear-gradient(
                                                -45deg,
                                                transparent,
                                                transparent 3px,
                                                rgba(239, 68, 68, 0.4) 3px,
                                                rgba(239, 68, 68, 0.4) 6px
                                            )`,
                                        }}
                                    />
                                    {/* 右边出血区域 */}
                                    <div 
                                        className="absolute right-0"
                                        style={{
                                            top: `${BLEED_AREA_PERCENT}%`,
                                            bottom: `${BLEED_AREA_PERCENT}%`,
                                            width: `${BLEED_AREA_PERCENT}%`,
                                            background: `repeating-linear-gradient(
                                                -45deg,
                                                transparent,
                                                transparent 3px,
                                                rgba(239, 68, 68, 0.4) 3px,
                                                rgba(239, 68, 68, 0.4) 6px
                                            )`,
                                        }}
                                    />
                                    {/* 安全区域内边框线 */}
                                    <div 
                                        className="absolute border border-dashed border-red-400"
                                        style={{
                                            top: `${BLEED_AREA_PERCENT}%`,
                                            left: `${BLEED_AREA_PERCENT}%`,
                                            right: `${BLEED_AREA_PERCENT}%`,
                                            bottom: `${BLEED_AREA_PERCENT}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 图片序号和翻页按钮 */}
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <button 
                            className={`p-2 rounded-full transition-colors ${
                                currentIndex > 0 
                                    ? 'text-gray-600 hover:bg-gray-200 active:bg-gray-300' 
                                    : 'text-gray-300 cursor-not-allowed'
                            }`}
                            onClick={() => handleNavigate('prev')}
                            disabled={currentIndex === 0}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-base text-gray-600 min-w-[60px] text-center">
                            {currentIndex + 1}/{photos.length}
                        </span>
                        <button 
                            className={`p-2 rounded-full transition-colors ${
                                currentIndex < photos.length - 1 
                                    ? 'text-gray-600 hover:bg-gray-200 active:bg-gray-300' 
                                    : 'text-gray-300 cursor-not-allowed'
                            }`}
                            onClick={() => handleNavigate('next')}
                            disabled={currentIndex === photos.length - 1}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 底部工具栏 */}
            <div className="bg-white border-t py-4 px-4 safe-area-bottom">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    {/* 边框样式 */}
                    <button className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" strokeWidth={2} rx="2" />
                        </svg>
                        <span className="text-xs">边框样式</span>
                    </button>

                    {/* 换图 */}
                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600 hover:text-orange-500 transition-colors"
                        onClick={handleReplaceClick}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">换图</span>
                    </button>

                    {/* 裁剪 */}
                    <button className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                        </svg>
                        <span className="text-xs">裁剪</span>
                    </button>

                    {/* 旋转 */}
                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600 hover:text-orange-500 transition-colors"
                        onClick={handleRotate}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs">旋转</span>
                    </button>

                    {/* 重置 */}
                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600 hover:text-orange-500 transition-colors"
                        onClick={handleReset}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs">重置</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
