'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Photo, 
    StyleType, 
    BLEED_AREA_PERCENT, 
    WHITE_MARGIN_PERCENT,
    parseAffineMatrix,
    createAffineMatrix,
    AffineMatrix,
} from '../types/photo.types';

/**
 * 图片属性（Konva 格式）
 */
export interface ImageAttrs {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    offsetX: number;
    offsetY: number;
}

interface PhotoCanvasProps {
    /** 照片数据 */
    photo: Photo;
    /** 画布尺寸 */
    stageSize: { width: number; height: number };
    /** 样式类型 */
    styleType: StyleType;
    /** 是否可编辑（可拖拽、缩放、旋转） */
    editable?: boolean;
    /** 是否显示出血线/留白遮罩 */
    showOverlay?: boolean;
    /** 变换改变回调 */
    onTransformChange?: (attrs: ImageAttrs, hasChanges: boolean) => void;
    /** 滚轮事件回调（用于缩放） */
    onWheel?: (deltaY: number) => void;
    /** 点击回调（用于列表页进入编辑） */
    onClick?: () => void;
}

/**
 * 计算初始图片属性
 */
function calculateInitialAttrs(
    image: HTMLImageElement,
    stageSize: { width: number; height: number },
    styleType: StyleType,
    photo: Photo
): ImageAttrs {
    const imgWidth = image.width;
    const imgHeight = image.height;
    
    const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
    const effectiveWidth = stageSize.width * (1 - margin * 2);
    const effectiveHeight = stageSize.height * (1 - margin * 2);
    const marginX = stageSize.width * margin;
    const marginY = stageSize.height * margin;
    
    // 如果有保存的变换，恢复它
    if (photo.transform) {
        const { scaleX, scaleY, rotation, tx, ty } = parseAffineMatrix(photo.transform.matrix);
        // 按比例缩放坐标
        const scaleRatio = stageSize.width / photo.transform.outputWidth;
        
        return {
            x: tx * scaleRatio,
            y: ty * scaleRatio,
            scaleX: scaleX * scaleRatio,
            scaleY: scaleY * scaleRatio,
            rotation,
            offsetX: imgWidth / 2,
            offsetY: imgHeight / 2,
        };
    }
    
    // 计算初始缩放
    const initialRotation = photo.autoRotated ? 90 : 0;
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
    
    return {
        x: centerX,
        y: centerY,
        scaleX: scale,
        scaleY: scale,
        rotation: initialRotation,
        offsetX: imgWidth / 2,
        offsetY: imgHeight / 2,
    };
}

/**
 * 计算边界约束
 */
function constrainPosition(
    x: number,
    y: number,
    scale: number,
    rotation: number,
    image: HTMLImageElement,
    stageSize: { width: number; height: number },
    styleType: StyleType
): { x: number; y: number } {
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
}

/**
 * 计算最小缩放比例
 */
function getMinScale(
    image: HTMLImageElement,
    stageSize: { width: number; height: number },
    styleType: StyleType,
    rotation: number
): number {
    const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
    const effectiveWidth = stageSize.width * (1 - margin * 2);
    const effectiveHeight = stageSize.height * (1 - margin * 2);
    
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedWidth = image.width * cos + image.height * sin;
    const rotatedHeight = image.width * sin + image.height * cos;
    
    if (styleType === 'white_margin') {
        return Math.min(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight) * 0.5;
    } else {
        return Math.max(effectiveWidth / rotatedWidth, effectiveHeight / rotatedHeight);
    }
}

/**
 * 共享的照片 Canvas 组件
 * 用于 PhotoCard（只读）和 PhotoEditor（可编辑）
 */
export function PhotoCanvas({
    photo,
    stageSize,
    styleType,
    editable = false,
    showOverlay = true,
    onTransformChange,
    onWheel,
    onClick,
}: PhotoCanvasProps) {
    const [konvaComponents, setKonvaComponents] = useState<{
        Stage: any;
        Layer: any;
        Image: any;
        Rect: any;
    } | null>(null);
    
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [imageAttrs, setImageAttrs] = useState<ImageAttrs | null>(null);
    const initializedRef = useRef(false);

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

    // 加载图片
    useEffect(() => {
        if (!photo) return;
        
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImage(img);
        img.src = photo.url;
        
        // 重置初始化标记
        initializedRef.current = false;
    }, [photo?.url]);

    // 计算图片属性
    useEffect(() => {
        if (!image || !stageSize.width || !stageSize.height) return;
        
        // 防止重复初始化（只在图片或尺寸变化时重新计算）
        const attrs = calculateInitialAttrs(image, stageSize, styleType, photo);
        setImageAttrs(attrs);
        initializedRef.current = true;
    }, [image, stageSize.width, stageSize.height, styleType, photo?.transform, photo?.autoRotated]);

    // 创建 dragBoundFunc
    const dragBoundFunc = useCallback((pos: { x: number; y: number }) => {
        if (!image || !imageAttrs) return pos;
        return constrainPosition(
            pos.x,
            pos.y,
            imageAttrs.scaleX,
            imageAttrs.rotation,
            image,
            stageSize,
            styleType
        );
    }, [image, imageAttrs, stageSize, styleType]);

    // 处理拖拽
    const handleDragMove = useCallback((e: any) => {
        if (!editable || !image) return;
        
        const constrained = constrainPosition(
            e.target.x(),
            e.target.y(),
            imageAttrs!.scaleX,
            imageAttrs!.rotation,
            image,
            stageSize,
            styleType
        );
        
        const newAttrs = { ...imageAttrs!, x: constrained.x, y: constrained.y };
        setImageAttrs(newAttrs);
        onTransformChange?.(newAttrs, true);
    }, [editable, image, imageAttrs, stageSize, styleType, onTransformChange]);

    // 处理滚轮缩放
    const handleWheel = useCallback((e: any) => {
        if (!editable || !image || !imageAttrs) return;
        
        e.evt.preventDefault();
        
        const scaleBy = 1.05;
        const minScale = getMinScale(image, stageSize, styleType, imageAttrs.rotation);
        const maxScale = minScale * 5;
        
        let newScale = e.evt.deltaY < 0 
            ? imageAttrs.scaleX * scaleBy 
            : imageAttrs.scaleX / scaleBy;
        
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        
        const constrained = constrainPosition(
            imageAttrs.x,
            imageAttrs.y,
            newScale,
            imageAttrs.rotation,
            image,
            stageSize,
            styleType
        );
        
        const newAttrs = {
            ...imageAttrs,
            scaleX: newScale,
            scaleY: newScale,
            x: constrained.x,
            y: constrained.y,
        };
        
        setImageAttrs(newAttrs);
        onTransformChange?.(newAttrs, true);
        onWheel?.(e.evt.deltaY);
    }, [editable, image, imageAttrs, stageSize, styleType, onTransformChange, onWheel]);

    // 计算有效区域
    const margin = styleType === 'white_margin' ? WHITE_MARGIN_PERCENT / 100 : 0;
    const effectiveX = stageSize.width * margin;
    const effectiveY = stageSize.height * margin;
    const effectiveWidth = stageSize.width * (1 - margin * 2);
    const effectiveHeight = stageSize.height * (1 - margin * 2);

    // 加载中状态
    if (!konvaComponents || !image || !imageAttrs) {
        return (
            <div 
                style={{ width: stageSize.width, height: stageSize.height }}
                className="bg-white flex items-center justify-center cursor-pointer"
                onClick={onClick}
            >
                <span className="text-gray-300 text-xs">加载中...</span>
            </div>
        );
    }

    const { Stage, Layer, Image: KonvaImage, Rect } = konvaComponents;

    return (
        <Stage 
            width={stageSize.width} 
            height={stageSize.height}
            onWheel={editable ? handleWheel : undefined}
            onClick={onClick}
            onTap={onClick}
        >
            <Layer>
                {/* 背景 */}
                <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="white" />
                
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
                    draggable={editable}
                    dragBoundFunc={editable ? dragBoundFunc : undefined}
                    onDragMove={editable ? handleDragMove : undefined}
                />
                
                {/* 满版模式的出血线遮罩 */}
                {showOverlay && styleType === 'full_bleed' && (
                    <>
                        <Rect x={0} y={0} width={stageSize.width} height={stageSize.height * (BLEED_AREA_PERCENT / 100)} fill="rgba(239, 68, 68, 0.15)" />
                        <Rect x={0} y={stageSize.height * (1 - BLEED_AREA_PERCENT / 100)} width={stageSize.width} height={stageSize.height * (BLEED_AREA_PERCENT / 100)} fill="rgba(239, 68, 68, 0.15)" />
                        <Rect x={0} y={stageSize.height * (BLEED_AREA_PERCENT / 100)} width={stageSize.width * (BLEED_AREA_PERCENT / 100)} height={stageSize.height * (1 - 2 * BLEED_AREA_PERCENT / 100)} fill="rgba(239, 68, 68, 0.15)" />
                        <Rect x={stageSize.width * (1 - BLEED_AREA_PERCENT / 100)} y={stageSize.height * (BLEED_AREA_PERCENT / 100)} width={stageSize.width * (BLEED_AREA_PERCENT / 100)} height={stageSize.height * (1 - 2 * BLEED_AREA_PERCENT / 100)} fill="rgba(239, 68, 68, 0.15)" />
                    </>
                )}
                
                {/* 留白模式的白色边框 */}
                {showOverlay && styleType === 'white_margin' && (
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

/**
 * 从 ImageAttrs 创建仿射矩阵
 */
export function imageAttrsToMatrix(attrs: ImageAttrs): AffineMatrix {
    return createAffineMatrix(
        attrs.scaleX,
        attrs.scaleY,
        attrs.rotation,
        attrs.x,
        attrs.y
    );
}

