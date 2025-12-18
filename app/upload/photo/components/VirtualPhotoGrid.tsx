'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Photo, StyleType, WatermarkConfig } from '../types/photo.types';
import { PhotoCard } from './PhotoCard';

interface VirtualPhotoGridProps {
    photos: Photo[];
    aspectRatio: number;
    styleType: StyleType;
    watermarkConfig: WatermarkConfig;
    confirmedPhotos: Set<string>;
    isUploadSubmitting: boolean;
    onAddPhoto: () => void;
    onRemovePhoto: (id: string) => void;
    onQuantityChange: (id: string, delta: number) => void;
    onConfirmPhoto: (id: string) => void;
    onEditPhoto: (index: number) => void;
    getPhotoWarning: (photo: Photo) => string | null;
    getPhotoContainerStyle: () => React.CSSProperties;
}

// 每行3列
const COLUMNS = 3;
// 行间距
const ROW_GAP = 16;
// 左右内边距
const PADDING_X = 16;

// 单个行组件 - 使用 memo 优化重渲染
const PhotoRow = memo(function PhotoRow({
    rowIndex,
    style,
    data,
}: {
    rowIndex: number;
    style: React.CSSProperties;
    data: {
        photos: Photo[];
        aspectRatio: number;
        styleType: StyleType;
        watermarkConfig: WatermarkConfig;
        confirmedPhotos: Set<string>;
        isUploadSubmitting: boolean;
        onAddPhoto: () => void;
        onRemovePhoto: (id: string) => void;
        onQuantityChange: (id: string, delta: number) => void;
        onConfirmPhoto: (id: string) => void;
        onEditPhoto: (index: number) => void;
        getPhotoWarning: (photo: Photo) => string | null;
        getPhotoContainerStyle: () => React.CSSProperties;
        columnWidth: number;
    };
}) {
    const {
        photos,
        aspectRatio,
        styleType,
        watermarkConfig,
        confirmedPhotos,
        isUploadSubmitting,
        onAddPhoto,
        onRemovePhoto,
        onQuantityChange,
        onConfirmPhoto,
        onEditPhoto,
        getPhotoWarning,
        getPhotoContainerStyle,
        columnWidth,
    } = data;

    const items = [];

    // 第一行第一个位置：添加按钮
    if (rowIndex === 0) {
        items.push(
            <div key="add-button" className="flex-1 relative" style={columnWidth > 0 ? { width: columnWidth } : undefined}>
                <div style={getPhotoContainerStyle()}>
                    <button
                        onClick={() => !isUploadSubmitting && onAddPhoto()}
                        disabled={isUploadSubmitting}
                        className={`absolute inset-0 bg-white border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
                            isUploadSubmitting
                                ? 'border-gray-200 cursor-not-allowed opacity-60'
                                : 'border-gray-300 hover:border-orange-500'
                        }`}
                    >
                        <div className="text-4xl text-gray-300 mb-2">+</div>
                        <div className="text-sm text-gray-400">添加照片</div>
                    </button>
                </div>
                {/* 数量调整器占位 */}
                <div className="mt-2 h-10"></div>
            </div>
        );
    }

    // 计算当前行应该显示的照片
    const startIndex = rowIndex === 0 ? 0 : rowIndex * COLUMNS - 1;
    const photosInRow = rowIndex === 0 ? COLUMNS - 1 : COLUMNS;
    const rowPhotos = photos.slice(startIndex, startIndex + photosInRow);

    // 添加照片项
    rowPhotos.forEach((photo) => {
        const photoIndex = photos.findIndex(p => p.id === photo.id);
        items.push(
            <div key={photo.id} className="flex-1" style={columnWidth > 0 ? { width: columnWidth, flex: 'none' } : undefined}>
                <PhotoCard
                    photo={photo}
                    containerStyle={getPhotoContainerStyle()}
                    aspectRatio={aspectRatio}
                    styleType={styleType}
                    watermarkConfig={watermarkConfig}
                    isConfirmed={confirmedPhotos.has(photo.id)}
                    warningMessage={getPhotoWarning(photo)}
                    onRemove={() => onRemovePhoto(photo.id)}
                    onQuantityChange={(delta) => onQuantityChange(photo.id, delta)}
                    onConfirm={() => !isUploadSubmitting && onConfirmPhoto(photo.id)}
                    onEdit={() => {
                        if (!isUploadSubmitting && photoIndex !== -1) {
                            onEditPhoto(photoIndex);
                        }
                    }}
                    disabled={isUploadSubmitting}
                />
            </div>
        );
    });

    // 填充空白项以保持对齐
    while (items.length < COLUMNS) {
        items.push(
            <div
                key={`placeholder-${rowIndex}-${items.length}`}
                className="flex-1"
                style={columnWidth > 0 ? { width: columnWidth, flex: 'none' } : undefined}
            />
        );
    }

    return (
        <div style={{ ...style, paddingLeft: PADDING_X, paddingRight: PADDING_X }}>
            <div className="flex gap-3">
                {items}
            </div>
        </div>
    );
});

export function VirtualPhotoGrid({
    photos,
    aspectRatio,
    styleType,
    watermarkConfig,
    confirmedPhotos,
    isUploadSubmitting,
    onAddPhoto,
    onRemovePhoto,
    onQuantityChange,
    onConfirmPhoto,
    onEditPhoto,
    getPhotoWarning,
    getPhotoContainerStyle,
}: VirtualPhotoGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600);
    const [ListComponent, setListComponent] = useState<any>(null);

    // 动态加载 react-window（避免 SSR 问题）
    // react-window@2.x 使用 List 而不是 FixedSizeList
    useEffect(() => {
        import('react-window').then((mod) => {
            setListComponent(() => mod.List);
        });
    }, []);

    // 监听容器尺寸变化
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                const height = window.innerHeight - containerRef.current.getBoundingClientRect().top - 120; // 留出底部结算区域
                setContainerWidth(width);
                setContainerHeight(Math.max(400, height));
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        
        // 使用 ResizeObserver 监听容器大小变化
        const resizeObserver = new ResizeObserver(updateSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateSize);
            resizeObserver.disconnect();
        };
    }, []);

    // 计算列宽（减去 padding 和 gap）
    // 确保 columnWidth 不为负数，使用 flex-1 作为后备
    const columnWidth = containerWidth > 0 
        ? Math.floor((containerWidth - PADDING_X * 2 - 12 * (COLUMNS - 1)) / COLUMNS)
        : 0;

    // 计算行高（根据宽高比 + 数量调整器高度 + 行间距）
    const photoHeight = columnWidth > 0 ? columnWidth / aspectRatio : 200;
    const rowHeight = photoHeight + 48 + ROW_GAP; // 48px 是数量调整器高度

    // 计算总行数
    const totalRows = Math.ceil((photos.length + 1) / COLUMNS);

    // 传递给行组件的数据
    const itemData = {
        photos,
        aspectRatio,
        styleType,
        watermarkConfig,
        confirmedPhotos,
        isUploadSubmitting,
        onAddPhoto,
        onRemovePhoto,
        onQuantityChange,
        onConfirmPhoto,
        onEditPhoto,
        getPhotoWarning,
        getPhotoContainerStyle,
        columnWidth,
    };

    // react-window@2.x 需要一个独立的 rowComponent
    // 注意：useCallback 必须在所有条件语句之前调用（Hooks 规则）
    const VirtualRow = useCallback(({ index, style, ...rest }: { index: number; style: React.CSSProperties; [key: string]: any }) => {
        return (
            <PhotoRow
                rowIndex={index}
                style={style}
                data={rest.itemData}
            />
        );
    }, []);

    // 如果照片数量较少（<= 30），使用普通渲染以避免虚拟列表的开销
    if (photos.length <= 30) {
        return (
            <div 
                ref={containerRef} 
                className="flex-1 px-4 py-4 bg-gray-50 min-h-0 overflow-y-auto"
            >
                <div className="space-y-4">
                    {Array.from({ length: totalRows }).map((_, rowIndex) => (
                        <PhotoRow
                            key={rowIndex}
                            rowIndex={rowIndex}
                            style={{}}
                            data={itemData}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // 照片数量较多时使用虚拟列表
    // 如果 ListComponent 还没加载完，显示加载中
    if (!ListComponent) {
        return (
            <div 
                ref={containerRef} 
                className="flex-1 px-4 py-4 bg-gray-50 min-h-0 overflow-y-auto"
            >
                <div className="space-y-4">
                    {Array.from({ length: Math.min(totalRows, 10) }).map((_, rowIndex) => (
                        <PhotoRow
                            key={rowIndex}
                            rowIndex={rowIndex}
                            style={{}}
                            data={itemData}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 bg-gray-50 min-h-0 overflow-hidden">
            {containerWidth > 0 && (
                <ListComponent
                    rowCount={totalRows}
                    rowHeight={rowHeight}
                    rowComponent={VirtualRow}
                    rowProps={{ itemData }}
                    overscanCount={3}
                    className="py-4"
                    style={{ height: containerHeight }}
                />
            )}
        </div>
    );
}

