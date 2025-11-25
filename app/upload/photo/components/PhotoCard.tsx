'use client';

import { Photo, StyleType } from '../types/photo.types';
import { useRef, useEffect, useState } from 'react';

interface PhotoCardProps {
    photo: Photo;
    containerStyle: React.CSSProperties;
    styleType: StyleType;
    isConfirmed: boolean;
    warningMessage: string | null;
    onRemove: () => void;
    onQuantityChange: (delta: number) => void;
    onConfirm: () => void;
    onEdit: () => void;
}

export function PhotoCard({
    photo,
    containerStyle,
    styleType,
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
                // 如果有编辑信息，按比例缩放
                if (!photo.transform.containerWidth || !photo.transform.containerHeight) {
                    setScaledTransform(null);
                    return;
                }

                const scaleRatio = currentWidth / photo.transform.containerWidth;

                setScaledTransform({
                    position: {
                        x: photo.transform.position.x * scaleRatio,
                        y: photo.transform.position.y * scaleRatio,
                    },
                    scale: photo.transform.scale * scaleRatio,
                    rotation: photo.transform.rotation,
                });
            } else if (photo.autoRotated && photo.width && photo.height) {
                // 自动旋转的照片，手动计算缩放
                const actualWidth = photo.height; // 旋转后宽高互换
                const actualHeight = photo.width;
                const imageAspectRatio = actualWidth / actualHeight;
                const containerAspectRatio = currentWidth / currentHeight;

                let calculatedScale: number;
                if (styleType === 'white_margin') {
                    // 留白模式：object-contain
                    calculatedScale = imageAspectRatio > containerAspectRatio
                        ? currentWidth / actualWidth
                        : currentHeight / actualHeight;
                } else {
                    // 满版模式：object-cover
                    calculatedScale = imageAspectRatio > containerAspectRatio
                        ? currentHeight / actualHeight
                        : currentWidth / actualWidth;
                }

                setScaledTransform({
                    position: { x: 0, y: 0 },
                    scale: calculatedScale,
                    rotation: 90,
                });
            } else {
                setScaledTransform(null);
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
                    // 留白样式 - 添加白边
                    <div className="absolute inset-0 p-[8%] flex items-center justify-center">
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

                            {/* 只对未确认且有警告的照片显示警告遮罩层 */}
                            {!isConfirmed && warningMessage && (
                                <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40">
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

                            {/* 只对未确认且有警告的照片显示警告遮罩层 */}
                            {!isConfirmed && warningMessage && (
                                <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40">
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




