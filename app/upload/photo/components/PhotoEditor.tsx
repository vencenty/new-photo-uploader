'use client';

import { useState, useRef, useEffect } from 'react';
import { Photo } from '../types/photo.types';

interface PhotoEditorProps {
    photo: Photo;
    aspectRatio: number;
    onClose: () => void;
    onSave: (photo: Photo) => void;
}

export function PhotoEditor({ photo, aspectRatio, onClose, onSave }: PhotoEditorProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [initialScale, setInitialScale] = useState(1);
    const imageRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 初始化图片尺寸，让它填满容器（类似 object-cover）
    useEffect(() => {
        if (!photo.width || !photo.height || !containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        
        // 计算图片宽高比
        const imageAspectRatio = photo.width / photo.height;
        // 容器宽高比
        const containerAspectRatio = containerWidth / containerHeight;

        // 类似 object-cover 的逻辑：选择较大的缩放比例，确保填满容器
        let newScale: number;
        if (imageAspectRatio > containerAspectRatio) {
            // 图片更宽，按高度填满
            newScale = containerHeight / photo.height;
        } else {
            // 图片更高或相等，按宽度填满
            newScale = containerWidth / photo.width;
        }

        setScale(newScale);
        setInitialScale(newScale);
    }, [photo, aspectRatio]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        setDragStart({
            x: e.touches[0].clientX - position.x,
            y: e.touches[0].clientY - position.y
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({
            x: e.touches[0].clientX - dragStart.x,
            y: e.touches[0].clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
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
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleReset = () => {
        setScale(initialScale);
        setPosition({ x: 0, y: 0 });
        setRotation(0);
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
                        onClick={() => onSave(photo)}
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
                        ref={containerRef}
                        className="relative w-full bg-white shadow-2xl overflow-hidden"
                        style={{ 
                            paddingTop: `${(1 / aspectRatio) * 100}%`,
                        }}
                    >
                        {/* 可拖动的图片 */}
                        <div 
                            ref={imageRef}
                            className="absolute inset-0 cursor-move select-none touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
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

