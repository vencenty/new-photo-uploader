'use client';

import { PhotoSize, PHOTO_SIZES } from '../types/photo.types';

interface SizeSelectorProps {
    selectedSize: PhotoSize;
    onSelectSize: (size: PhotoSize) => void;
    onClose: () => void;
}

export function SizeSelector({ selectedSize, onSelectSize, onClose }: SizeSelectorProps) {
    const handleSelectSize = (size: PhotoSize) => {
        onSelectSize(size);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            onClick={onClose}
        >
            <div
                className="bg-white w-full rounded-t-2xl animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 弹出层标题 */}
                <div className="flex items-center justify-between px-4 py-4 border-b">
                    <span className="text-lg font-medium text-black">选择规格</span>
                    <button
                        onClick={onClose}
                        className="text-gray-400 text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* 规格选项列表 */}
                <div className="px-4 py-2">
                    {PHOTO_SIZES.map((option) => (
                        <div
                            key={option.size}
                            className={`flex items-center justify-between py-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                                selectedSize === option.size ? 'text-orange-500' : 'text-black'
                            }`}
                            onClick={() => handleSelectSize(option.size)}
                        >
                            <span className="text-base">{option.label}</span>
                            {selectedSize === option.size && (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>

                {/* 安全区域 */}
                <div className="h-8"></div>
            </div>
        </div>
    );
}


