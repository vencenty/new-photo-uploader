'use client';

import { Photo } from '../types/photo.types';

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
    return (
        <div className="flex-1 relative">
            <div
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
                        className="w-full h-full cursor-pointer"
                        onClick={onEdit}
                    >
                        <img
                            src={photo.url}
                            alt="照片"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                console.error('图片加载失败:', photo.url);
                                e.currentTarget.style.display = 'none';
                            }}
                        />

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




