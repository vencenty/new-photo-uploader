'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Photo, 
    StyleType, 
    BLEED_AREA_PERCENT, 
    WHITE_MARGIN_PERCENT, 
    WatermarkConfig, 
    WATERMARK_SIZES,
    createAffineMatrix,
    parseAffineMatrix,
} from '../types/photo.types';
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
        default:
            return { ...baseStyle, bottom: padding, right: padding };
    }
};

// Konva Canvas 组件 - 用于处理图片编辑
interface KonvaCanvasProps {
    image: HTMLImageElement;
    stageSize: { width: number; height: number };
    imageAttrs: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
        offsetX: number;
        offsetY: number;
    };
    styleType: StyleType;
    effectiveX: number;
    effectiveY: number;
    effectiveWidth: number;
    effectiveHeight: number;
    onDragStart: () => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd: (x: number, y: number) => void;
    onWheel: (deltaY: number) => void;
    // 边界约束函数 - 实时限制拖拽位置
    dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number };
}

function KonvaCanvas({
    image,
    stageSize,
    imageAttrs,
    styleType,
    effectiveX,
    effectiveY,
    effectiveWidth,
    effectiveHeight,
    onDragStart,
    onDragMove,
    onDragEnd,
    onWheel,
    dragBoundFunc,
}: KonvaCanvasProps) {
    const [konvaComponents, setKonvaComponents] = useState<{
        Stage: any;
        Layer: any;
        Image: any;
        Rect: any;
    } | null>(null);

    // 动态加载 react-konva
    useEffect(() => {
        import('react-konva').then((mod) => {
            setKonvaComponents({
                Stage: mod.Stage,
                Layer: mod.Layer,
                Image: mod.Image,
                Rect: mod.Rect,
            });
        });
    }, []);

    if (!konvaComponents) {
        // 加载中显示占位
        return (
            <div 
                style={{ width: stageSize.width, height: stageSize.height }}
                className="bg-gray-100 flex items-center justify-center"
            >
                <span className="text-gray-400">加载中...</span>
            </div>
        );
    }

    const { Stage, Layer, Image: KonvaImage, Rect } = konvaComponents;

    return (
        <Stage
            width={stageSize.width}
            height={stageSize.height}
            onWheel={(e: any) => {
                e.evt.preventDefault();
                onWheel(e.evt.deltaY);
            }}
        >
            <Layer>
                {/* 背景 */}
                <Rect
                    x={0}
                    y={0}
                    width={stageSize.width}
                    height={stageSize.height}
                    fill="white"
                />
                
                {/* 图片 */}
                <KonvaImage
                    image={image}
                    x={imageAttrs.x}
                    y={imageAttrs.y}
                    scaleX={imageAttrs.scaleX}
                    scaleY={imageAttrs.scaleY}
                    rotation={imageAttrs.rotation}
                    offsetX={imageAttrs.offsetX}
                    offsetY={imageAttrs.offsetY}
                    draggable
                    dragBoundFunc={dragBoundFunc}
                    onDragStart={onDragStart}
                    onDragMove={(e: any) => {
                        onDragMove(e.target.x(), e.target.y());
                    }}
                    onDragEnd={(e: any) => {
                        onDragEnd(e.target.x(), e.target.y());
                    }}
                />
                
                {/* 满版模式的出血线遮罩 */}
                {styleType === 'full_bleed' && (
                    <>
                        <Rect
                            x={0}
                            y={0}
                            width={stageSize.width}
                            height={stageSize.height * (BLEED_AREA_PERCENT / 100)}
                            fill="rgba(239, 68, 68, 0.15)"
                        />
                        <Rect
                            x={0}
                            y={stageSize.height * (1 - BLEED_AREA_PERCENT / 100)}
                            width={stageSize.width}
                            height={stageSize.height * (BLEED_AREA_PERCENT / 100)}
                            fill="rgba(239, 68, 68, 0.15)"
                        />
                        <Rect
                            x={0}
                            y={stageSize.height * (BLEED_AREA_PERCENT / 100)}
                            width={stageSize.width * (BLEED_AREA_PERCENT / 100)}
                            height={stageSize.height * (1 - 2 * BLEED_AREA_PERCENT / 100)}
                            fill="rgba(239, 68, 68, 0.15)"
                        />
                        <Rect
                            x={stageSize.width * (1 - BLEED_AREA_PERCENT / 100)}
                            y={stageSize.height * (BLEED_AREA_PERCENT / 100)}
                            width={stageSize.width * (BLEED_AREA_PERCENT / 100)}
                            height={stageSize.height * (1 - 2 * BLEED_AREA_PERCENT / 100)}
                            fill="rgba(239, 68, 68, 0.15)"
                        />
                    </>
                )}
                
                {/* 留白模式的白色边框 */}
                {styleType === 'white_margin' && (
                    <>
                        <Rect x={0} y={0} width={effectiveX} height={stageSize.height} fill="white" />
                        <Rect x={stageSize.width - effectiveX} y={0} width={effectiveX} height={stageSize.height} fill="white" />
                        <Rect x={effectiveX} y={0} width={effectiveWidth} height={effectiveY} fill="white" />
                        <Rect x={effectiveX} y={stageSize.height - effectiveY} width={effectiveWidth} height={effectiveY} fill="white" />
                    </>
                )}
            </Layer>
        </Stage>
    );
}

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
    
    // Konva 相关状态
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [stageSize, setStageSize] = useState({ width: 300, height: 400 });
    const [imageAttrs, setImageAttrs] = useState({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [isClient, setIsClient] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 客户端渲染检测
    useEffect(() => {
        setIsClient(true);
    }, []);

    // 加载图片
    useEffect(() => {
        if (!photo) return;
        
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImage(img);
        };
        img.src = photo.url;
    }, [photo?.url]);

    // 计算容器尺寸
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateSize = () => {
            const container = containerRef.current;
            if (!container) return;
            
            const containerWidth = container.offsetWidth;
            const containerHeight = containerWidth / aspectRatio;
            
            setStageSize({
                width: containerWidth,
                height: containerHeight,
            });
        };
        
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [aspectRatio, styleType]);

    // 初始化图片位置和缩放
    useEffect(() => {
        if (!image || !stageSize.width || !stageSize.height) return;
        
        const imgWidth = image.width;
        const imgHeight = image.height;
        
        // 计算有效区域（考虑留白）
        const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
        const effectiveWidth = stageSize.width * (1 - margin * 2);
        const effectiveHeight = stageSize.height * (1 - margin * 2);
        const marginX = stageSize.width * margin;
        const marginY = stageSize.height * margin;
        
        // 如果有保存的变换，恢复它
        if (photo?.transform) {
            const { scaleX, scaleY, rotation, tx, ty } = parseAffineMatrix(photo.transform.matrix);
            setImageAttrs({
                x: tx,
                y: ty,
                scaleX,
                scaleY,
                rotation,
                offsetX: imgWidth / 2,
                offsetY: imgHeight / 2,
            });
            setHasChanges(false);
            return;
        }
        
        // 计算初始缩放 - 考虑是否自动旋转
        const initialRotation = photo?.autoRotated ? 90 : 0;
        const rad = (initialRotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rotatedWidth = imgWidth * cos + imgHeight * sin;
        const rotatedHeight = imgWidth * sin + imgHeight * cos;
        
        let scale: number;
        if (styleType === 'white_margin') {
            scale = Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        } else {
            scale = Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        }
        
        const centerX = marginX + effectiveWidth / 2;
        const centerY = marginY + effectiveHeight / 2;
        
        setImageAttrs({
            x: centerX,
            y: centerY,
            scaleX: scale,
            scaleY: scale,
            rotation: initialRotation,
            offsetX: imgWidth / 2,
            offsetY: imgHeight / 2,
        });
        
        setHasChanges(false);
    }, [image, stageSize, styleType, photo?.transform, photo?.autoRotated]);

    // 获取最小缩放比例
    const getMinScale = useCallback(() => {
        if (!image || !stageSize.width) return 0.1;
        
        const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
        const effectiveWidth = stageSize.width * (1 - margin * 2);
        const effectiveHeight = stageSize.height * (1 - margin * 2);
        
        const rad = (imageAttrs.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rotatedWidth = image.width * cos + image.height * sin;
        const rotatedHeight = image.width * sin + image.height * cos;
        
        if (styleType === 'white_margin') {
            return Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight) * 0.5;
        } else {
            return Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        }
    }, [image, stageSize, styleType, imageAttrs.rotation]);

    // 限制位置
    const constrainPosition = useCallback((x: number, y: number, scale: number, rotation: number) => {
        if (!image || !stageSize.width) return { x, y };
        
        const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
        const effectiveWidth = stageSize.width * (1 - margin * 2);
        const effectiveHeight = stageSize.height * (1 - margin * 2);
        const marginX = stageSize.width * margin;
        const marginY = stageSize.height * margin;
        
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const scaledWidth = (image.width * cos + image.height * sin) * scale;
        const scaledHeight = (image.width * sin + image.height * cos) * scale;
        
        const centerX = marginX + effectiveWidth / 2;
        const centerY = marginY + effectiveHeight / 2;
        
        const maxOffsetX = Math.max(0, (scaledWidth - effectiveWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - effectiveHeight) / 2);
        
        return {
            x: Math.max(centerX - maxOffsetX, Math.min(centerX + maxOffsetX, x)),
            y: Math.max(centerY - maxOffsetY, Math.min(centerY + maxOffsetY, y)),
        };
    }, [image, stageSize, styleType]);

    // 创建供 Konva 使用的 dragBoundFunc - 实时约束拖拽位置
    const dragBoundFunc = useCallback((pos: { x: number; y: number }) => {
        return constrainPosition(pos.x, pos.y, imageAttrs.scaleX, imageAttrs.rotation);
    }, [constrainPosition, imageAttrs.scaleX, imageAttrs.rotation]);

    // 处理拖拽
    const handleDragMove = useCallback((x: number, y: number) => {
        const constrained = constrainPosition(x, y, imageAttrs.scaleX, imageAttrs.rotation);
        setImageAttrs(prev => ({
            ...prev,
            x: constrained.x,
            y: constrained.y,
        }));
        setHasChanges(true);
    }, [constrainPosition, imageAttrs.scaleX, imageAttrs.rotation]);

    const handleDragEnd = useCallback((x: number, y: number) => {
        const constrained = constrainPosition(x, y, imageAttrs.scaleX, imageAttrs.rotation);
        setImageAttrs(prev => ({
            ...prev,
            x: constrained.x,
            y: constrained.y,
        }));
    }, [constrainPosition, imageAttrs.scaleX, imageAttrs.rotation]);

    // 处理滚轮缩放
    const handleWheel = useCallback((deltaY: number) => {
        const scaleBy = 1.05;
        const minScale = getMinScale();
        const maxScale = minScale * 5;
        
        let newScale = deltaY < 0 
            ? imageAttrs.scaleX * scaleBy 
            : imageAttrs.scaleX / scaleBy;
        
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        
        const constrained = constrainPosition(
            imageAttrs.x, 
            imageAttrs.y, 
            newScale, 
            imageAttrs.rotation
        );
        
        setImageAttrs(prev => ({
            ...prev,
            scaleX: newScale,
            scaleY: newScale,
            x: constrained.x,
            y: constrained.y,
        }));
        setHasChanges(true);
    }, [imageAttrs, getMinScale, constrainPosition]);

    // 旋转90度
    const handleRotate = useCallback(() => {
        const newRotation = (imageAttrs.rotation + 90) % 360;
        
        if (!image || !stageSize.width) return;
        
        const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
        const effectiveWidth = stageSize.width * (1 - margin * 2);
        const effectiveHeight = stageSize.height * (1 - margin * 2);
        
        const rad = (newRotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rotatedWidth = image.width * cos + image.height * sin;
        const rotatedHeight = image.width * sin + image.height * cos;
        
        let minScale: number;
        if (styleType === 'white_margin') {
            minScale = Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight) * 0.5;
        } else {
            minScale = Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        }
        
        const newScale = Math.max(imageAttrs.scaleX, minScale);
        const constrained = constrainPosition(imageAttrs.x, imageAttrs.y, newScale, newRotation);
        
        setImageAttrs(prev => ({
            ...prev,
            rotation: newRotation,
            scaleX: newScale,
            scaleY: newScale,
            x: constrained.x,
            y: constrained.y,
        }));
        setHasChanges(true);
    }, [imageAttrs, image, stageSize, styleType, constrainPosition]);

    // 重置
    const handleReset = useCallback(() => {
        if (!image || !stageSize.width) return;
        
        const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
        const effectiveWidth = stageSize.width * (1 - margin * 2);
        const effectiveHeight = stageSize.height * (1 - margin * 2);
        const marginX = stageSize.width * margin;
        const marginY = stageSize.height * margin;
        
        const initialRotation = photo?.autoRotated ? 90 : 0;
        const rad = (initialRotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rotatedWidth = image.width * cos + image.height * sin;
        const rotatedHeight = image.width * sin + image.height * cos;
        
        let scale: number;
        if (styleType === 'white_margin') {
            scale = Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        } else {
            scale = Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
        }
        
        const centerX = marginX + effectiveWidth / 2;
        const centerY = marginY + effectiveHeight / 2;
        
        setImageAttrs({
            x: centerX,
            y: centerY,
            scaleX: scale,
            scaleY: scale,
            rotation: initialRotation,
            offsetX: image.width / 2,
            offsetY: image.height / 2,
        });
        setHasChanges(true);
    }, [image, stageSize, styleType, photo?.autoRotated]);

    // 保存当前变换
    const saveCurrentPhoto = useCallback(() => {
        if (!photo || !image) return;
        
        const matrix = createAffineMatrix(
            imageAttrs.scaleX,
            imageAttrs.scaleY,
            imageAttrs.rotation,
            imageAttrs.x,
            imageAttrs.y
        );
        
        const updatedPhoto: Photo = {
            ...photo,
            transform: {
                matrix,
                outputWidth: stageSize.width,
                outputHeight: stageSize.height,
                sourceWidth: image.width,
                sourceHeight: image.height,
            },
        };
        
        onSave(updatedPhoto);
        setHasChanges(false);
    }, [photo, image, imageAttrs, stageSize, onSave]);

    // 保存并关闭
    const handleSave = useCallback(() => {
        saveCurrentPhoto();
        onClose();
    }, [saveCurrentPhoto, onClose]);

    // 关闭编辑器（自动保存修改）
    const handleClose = useCallback(() => {
        // 无论是否有改动，都保存当前状态（确保 transform 被记录）
        saveCurrentPhoto();
        onClose();
    }, [saveCurrentPhoto, onClose]);

    // 导航
    const handleNavigate = useCallback((direction: 'prev' | 'next') => {
        if (hasChanges) {
            saveCurrentPhoto();
        }
        
        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < photos.length) {
            onNavigate(newIndex);
        }
    }, [hasChanges, saveCurrentPhoto, currentIndex, photos.length, onNavigate]);

    // 替换图片
    const handleReplaceClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
            const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                const img = document.createElement('img');
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = imageUrl;
            });

            const isLandscape = width > height;

            const newPhoto: Photo = {
                id: photo.id,
                url: imageUrl,
                photoUrl: undefined,
                uploadStatus: 'pending',
                quantity: photo.quantity,
                fileSize: file.size,
                width,
                height,
                autoRotated: isLandscape,
                originalFile: file,
            };

            if (photo.url.startsWith('blob:')) {
                URL.revokeObjectURL(photo.url);
            }

            onReplace(photo, newPhoto);
        } catch (error) {
            console.error('图片加载错误:', error);
            alert('图片加载失败，请重试');
        }

        event.target.value = '';
    };

    // 渲染水印
    const renderWatermark = () => {
        if (!watermarkConfig.enabled || !photo?.takenAt) {
            return null;
        }

        const sizeConfig = WATERMARK_SIZES.find(s => s.value === watermarkConfig.size);
        const fontSize = sizeConfig?.fontSize || 16;
        const isLightColor = ['#FFFFFF', '#FFD700'].includes(watermarkConfig.color);
        const textShadow = isLightColor
            ? '0 1px 3px rgba(0,0,0,0.6)'
            : `0 0 6px ${watermarkConfig.color}40, 0 0 3px ${watermarkConfig.color}60`;

        return (
            <div
                className="pointer-events-none z-20 whitespace-nowrap"
                style={{
                    ...getWatermarkPositionStyle(watermarkConfig.position),
                    fontFamily: "var(--font-dseg), monospace",
                    color: watermarkConfig.color,
                    fontSize: `${fontSize}px`,
                    opacity: watermarkConfig.opacity / 100,
                    textShadow,
                    letterSpacing: '2px',
                }}
            >
                {formatDate(photo.takenAt, watermarkConfig.dateFormat)}
            </div>
        );
    };

    if (!photo) return null;

    // 计算有效区域
    const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
    const effectiveX = stageSize.width * margin;
    const effectiveY = stageSize.height * margin;
    const effectiveWidth = stageSize.width * (1 - margin * 2);
    const effectiveHeight = stageSize.height * (1 - margin * 2);

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
                    <button className="text-2xl text-black" onClick={handleClose}>←</button>
                    <h1 className="text-lg font-medium text-black">编辑</h1>
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
                    <span>拖动图片调整位置，滚轮/双指缩放</span>
                </div>
                {styleType === 'full_bleed' && (
                    <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
                        <div 
                            className="w-4 h-4 rounded-sm"
                            style={{
                                background: `repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(239, 68, 68, 0.5) 2px, rgba(239, 68, 68, 0.5) 4px)`,
                            }}
                        />
                        <span>红色区域为出血区域，此区域内容可能被裁切</span>
                    </div>
                )}
            </div>

            {/* Konva 编辑区域 */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
                <div className="relative w-full max-w-lg">
                    <div 
                        ref={containerRef}
                        className="relative w-full bg-white shadow-2xl overflow-hidden"
                        style={{ paddingTop: `${(1 / aspectRatio) * 100}%` }}
                    >
                        <div className="absolute inset-0">
                            {isClient && image && (
                                <KonvaCanvas
                                    image={image}
                                    stageSize={stageSize}
                                    imageAttrs={imageAttrs}
                                    styleType={styleType}
                                    effectiveX={effectiveX}
                                    effectiveY={effectiveY}
                                    effectiveWidth={effectiveWidth}
                                    effectiveHeight={effectiveHeight}
                                    onDragStart={() => {}}
                                    onDragMove={handleDragMove}
                                    onDragEnd={handleDragEnd}
                                    onWheel={handleWheel}
                                    dragBoundFunc={dragBoundFunc}
                                />
                            )}
                            
                            {/* 水印叠加层 */}
                            {renderWatermark()}
                        </div>
                    </div>

                    {/* 图片序号和翻页按钮 */}
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <button 
                            className={`p-2 rounded-full transition-colors ${
                                currentIndex > 0 
                                    ? 'text-gray-600 hover:bg-gray-200' 
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
                                    ? 'text-gray-600 hover:bg-gray-200' 
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
                    <button className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" strokeWidth={2} rx="2" />
                        </svg>
                        <span className="text-xs">边框样式</span>
                    </button>

                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600 hover:text-orange-500 transition-colors"
                        onClick={handleReplaceClick}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">换图</span>
                    </button>

                    <button className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                        </svg>
                        <span className="text-xs">裁剪</span>
                    </button>

                    <button 
                        className="flex flex-col items-center gap-1 text-gray-600 hover:text-orange-500 transition-colors"
                        onClick={handleRotate}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs">旋转</span>
                    </button>

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
