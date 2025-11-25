'use client';

import { useState, useRef, useEffect } from 'react';
import { Photo, StyleType } from '../types/photo.types';

interface PhotoEditorProps {
    photo: Photo;
    aspectRatio: number;
    styleType: StyleType;
    onClose: () => void;
    onSave: (photo: Photo) => void;
}

export function PhotoEditor({ photo, aspectRatio, styleType, onClose, onSave }: PhotoEditorProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [initialScale, setInitialScale] = useState(1);
    const [minScale, setMinScale] = useState(1);
    const [touchStartDistance, setTouchStartDistance] = useState(0);
    const [touchStartScale, setTouchStartScale] = useState(1);
    const imageRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
    const calculateMinScale = (rot: number) => {
        if (!photo.width || !photo.height || !containerRef.current) return 1;

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
    };

    // 限制位置
    const constrainPosition = (pos: { x: number; y: number }, currentScale: number, currentRotation: number) => {
        if (!photo.width || !photo.height || !containerRef.current) return pos;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // 计算缩放后的图片尺寸
        const scaledWidth = photo.width * currentScale;
        const scaledHeight = photo.height * currentScale;

        // 获取旋转后的边界
        const rotatedBounds = getRotatedBounds(scaledWidth, scaledHeight, currentRotation);

        if (styleType === 'white_margin') {
            // 留白模式：确保照片不会移出容器边界
            // 照片可能比容器小，所以限制照片不能完全移出视野
            const maxOffsetX = Math.max(0, (rotatedBounds.width - containerWidth) / 2);
            const maxOffsetY = Math.max(0, (rotatedBounds.height - containerHeight) / 2);
            
            // 如果照片比容器小，限制它不能完全移出边界
            // 如果照片比容器大，允许移动但不能露出白边
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
    };

    // 初始化图片尺寸
    useEffect(() => {
        if (!photo.width || !photo.height || !containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        
        // 如果有保存的 transform 或者是自动旋转的图片，需要考虑旋转
        const willBeRotated = photo.autoRotated && !photo.transform;
        
        // 根据是否旋转，调整图片的实际宽高
        const actualWidth = willBeRotated ? photo.height : photo.width;
        const actualHeight = willBeRotated ? photo.width : photo.height;
        
        // 计算图片宽高比（使用旋转后的实际宽高）
        const imageAspectRatio = actualWidth / actualHeight;
        // 容器宽高比
        const containerAspectRatio = containerWidth / containerHeight;

        // 根据样式类型选择缩放逻辑
        let newScale: number;
        if (styleType === 'white_margin') {
            // 留白模式：object-contain 逻辑，选择较小的缩放比例，确保完整显示
            if (imageAspectRatio > containerAspectRatio) {
                // 图片更宽，按宽度缩放
                newScale = containerWidth / actualWidth;
            } else {
                // 图片更高或相等，按高度缩放
                newScale = containerHeight / actualHeight;
            }
        } else {
            // 满版模式：object-cover 逻辑，选择较大的缩放比例，确保填满容器
            if (imageAspectRatio > containerAspectRatio) {
                // 图片更宽，按高度填满
                newScale = containerHeight / actualHeight;
            } else {
                // 图片更高或相等，按宽度填满
                newScale = containerWidth / actualWidth;
            }
        }

        // 如果有保存的变换信息，使用保存的值；否则使用默认值
        if (photo.transform) {
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
            setInitialScale(newScale);
        } else {
            // 检查是否需要自动旋转（横图转竖图）
            const initialRotation = photo.autoRotated ? 90 : 0;
            const minS = calculateMinScale(initialRotation);
            setMinScale(minS);
            setScale(newScale);
            setInitialScale(newScale);
            setPosition({ x: 0, y: 0 });
            setRotation(initialRotation);
        }
    }, [photo, aspectRatio, styleType]);

    // 计算两个触摸点之间的距离
    const getTouchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // 双指缩放开始
            const distance = getTouchDistance(e.touches);
            setTouchStartDistance(distance);
            setTouchStartScale(scale);
            setIsDragging(false);
        } else if (e.touches.length === 1) {
            // 单指拖拽
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        
        if (e.touches.length === 2 && touchStartDistance > 0) {
            // 双指缩放
            const distance = getTouchDistance(e.touches);
            const scaleChange = distance / touchStartDistance;
            const newScale = Math.max(minScale, touchStartScale * scaleChange);
            
            setScale(newScale);
            
            // 缩放后重新约束位置
            const constrainedPos = constrainPosition(position, newScale, rotation);
            setPosition(constrainedPos);
        } else if (isDragging && e.touches.length === 1) {
            // 单指拖拽
            const newPosition = {
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            };
            const constrainedPos = constrainPosition(newPosition, scale, rotation);
            setPosition(constrainedPos);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setTouchStartDistance(0);
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
        
        // 缩放后重新约束位置
        const constrainedPos = constrainPosition(position, newScale, rotation);
        setPosition(constrainedPos);
    };

    const handleRotate = () => {
        const newRotation = (rotation + 90) % 360;
        setRotation(newRotation);
        
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
        setRotation(0);
        const newMinScale = calculateMinScale(0);
        setMinScale(newMinScale);
    };

    const handleSave = () => {
        if (!containerRef.current) return;
        
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
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
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
                            // 留白样式 - 外层固定白边 + 内层 object-contain
                            <div className="absolute inset-0 p-[8%]">
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
                            </div>
                        )}
                    </div>

                    {/* 图片序号 - TODO: 实现切换功能 */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <button className="text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-base text-gray-600">2/12</span>
                        <button className="text-gray-400">
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
                    <button className="flex flex-col items-center gap-1 text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">换图</span>
                    </button>

                    {/* 裁剪 */}
                    <button className="flex flex-col items-center gap-1 text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                        </svg>
                        <span className="text-xs">裁剪</span>
                    </button>

                    {/* 旋转 */}
                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600"
                        onClick={handleRotate}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs">旋转</span>
                    </button>

                    {/* 重置 */}
                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600"
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

