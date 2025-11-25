'use client';

import { Photo } from '../types/photo.types';
import { useRef, useEffect, useState } from 'react';

interface PhotoCardProps {
    photo: Photo;
    containerStyle: React.CSSProperties;
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
    isConfirmed,
    warningMessage,
    onRemove,
    onQuantityChange,
    onConfirm,
    onEdit,
}: PhotoCardProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scaledTransform, setScaledTransform] = useState<{
        position: { x: number; y: number };
        scale: number;
    } | null>(null);

    // 当容器尺寸或照片变化时，重新计算缩放后的变换
    useEffect(() => {
        if (!photo.transform || !photo.width || !photo.height) {
            setScaledTransform(null);
            return;
        }

        // 检查是否有容器尺寸信息（兼容旧数据）
        if (!photo.transform.containerWidth || !photo.transform.containerHeight) {
            setScaledTransform(null);
            return;
        }

        // 使用 requestAnimationFrame 确保容器已完成渲染
        const updateTransform = () => {
            if (!containerRef.current || !photo.transform) return;
            
            const currentWidth = containerRef.current.offsetWidth;
            
            // 如果容器宽度为 0，说明还没渲染完成，延迟更新
            if (currentWidth === 0) {
                requestAnimationFrame(updateTransform);
                return;
            }
            
            // 由于编辑器和列表使用相同的宽高比，按宽度比例缩放即可
            const scaleRatio = currentWidth / photo.transform.containerWidth;

            // 按比例调整 position 和 scale
            setScaledTransform({
                position: {
                    x: photo.transform.position.x * scaleRatio,
                    y: photo.transform.position.y * scaleRatio,
                },
                scale: photo.transform.scale * scaleRatio,
            });
        };

        requestAnimationFrame(updateTransform);
    }, [photo, photo.transform]);

    return (
        <div className="flex-1 relative">
            <div
                ref={containerRef}
                className="bg-white overflow-hidden shadow-sm relative"
                style={containerStyle}
            >
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
                        className="w-full h-full cursor-pointer overflow-hidden"
                        onClick={onEdit}
                    >
                        {photo.transform && scaledTransform ? (
                            // 如果有编辑信息，显示编辑后的效果
                            <div className="relative w-full h-full">
                                <img
                                    src={photo.url}
                                    alt="照片"
                                    className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                                    style={{
                                        transform: `translate(-50%, -50%) translate(${scaledTransform.position.x}px, ${scaledTransform.position.y}px) scale(${scaledTransform.scale}) rotate(${photo.transform.rotation}deg)`,
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
                            // 没有编辑信息，使用默认的 object-cover
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




