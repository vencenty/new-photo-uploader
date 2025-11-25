'use client';

import { useState, useRef } from 'react';
import { Photo, PhotoSize, PHOTO_SIZES } from './types/photo.types';
import { PhotoEditor } from './components/PhotoEditor';
import { SizeSelector } from './components/SizeSelector';
import { PhotoCard } from './components/PhotoCard';
import { getPhotoWarning } from './utils/photoValidation';

export default function PhotoPrintPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [selectedSize, setSelectedSize] = useState<PhotoSize>('5寸');
    const [showSizeSelector, setShowSizeSelector] = useState(false);
    const [confirmedPhotos, setConfirmedPhotos] = useState<Set<string>>(new Set());
    const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);

    const PRICE_PER_PHOTO = 3.5;
    const SHIPPING_FEE = 6;
    const FREE_SHIPPING_THRESHOLD = 20;

    const totalQuantity = photos.reduce((sum, photo) => sum + photo.quantity, 0);
    const subtotal = totalQuantity * PRICE_PER_PHOTO;
    const shippingFee = totalQuantity >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shippingFee;
    const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalQuantity);

    // 获取当前选择的宽高比
    const currentAspectRatio =
        PHOTO_SIZES.find((s) => s.size === selectedSize)?.aspectRatio || 7 / 10;

    // 计算照片容器的样式（基于宽高比）
    const getPhotoContainerStyle = () => {
        return {
            paddingTop: `${(1 / currentAspectRatio) * 100}%`,
        };
    };

    const handleQuantityChange = (id: string, delta: number) => {
        setPhotos(
            photos.map((photo) => {
            if (photo.id === id) {
                const newQuantity = Math.max(1, photo.quantity + delta);
                return { ...photo, quantity: newQuantity };
            }
            return photo;
            })
        );
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(photos.filter((photo) => photo.id !== id));
        setConfirmedPhotos((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const handleClearAll = () => {
        setPhotos([]);
        setConfirmedPhotos(new Set());
    };

    const handleConfirmPhoto = (id: string) => {
        setConfirmedPhotos((prev) => new Set(prev).add(id));
    };

    const handleAddPhoto = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const validPhotos: Photo[] = [];
        const errors: string[] = [];

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) {
                errors.push(`${file.name} 不是图片文件`);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name} 超过50MB限制`);
                continue;
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

                const newPhoto: Photo = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: imageUrl,
                    quantity: 1,
                    fileSize: file.size,
                    width,
                    height,
                };

                validPhotos.push(newPhoto);
            } catch (error) {
                errors.push(`${file.name} 加载失败`);
                console.error(`图片加载错误:`, error);
            }
        }

        if (validPhotos.length > 0) {
            setPhotos((prevPhotos) => [...prevPhotos, ...validPhotos]);
        }

        if (errors.length > 0) {
            alert(`以下文件处理失败:\n${errors.join('\n')}`);
        }

        event.target.value = '';
    };

    const handleSubmitOrder = () => {
        console.log('提交订单');
    };

    return (
        <>
            {/* 隐藏的文件输入元素 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            <div className="min-h-screen flex flex-col">
                {/* 顶部导航栏 */}
                <header className="bg-white border-b sticky top-0 z-10">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            className="text-2xl text-black"
                            onClick={() => window.history.back()}
                        >
                            ←
                        </button>
                        <h1 className="text-lg font-medium text-black">田田洗照片</h1>
                        <button className="text-gray-600 text-sm" onClick={handleClearAll}>
                            清空
                        </button>
                    </div>
                </header>

                {/* 规格选择区域 */}
                <div className="bg-white px-4 py-3 border-b">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowSizeSelector(true)}
                    >
                        <span className="text-sm text-gray-600">规格</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900">
                                {PHOTO_SIZES.find((s) => s.size === selectedSize)?.label}
                            </span>
                            <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 打印区域示意 */}
                <div className="px-4 py-3 bg-white">
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>显示区域即为打印区域，请点击图片进行调整</span>
                    </div>
                </div>

                {/* 照片列表区域 */}
                <div className="flex-1 px-4 py-4 bg-gray-50">
                    <div className="space-y-4">
                        {Array.from({ length: Math.ceil((photos.length + 1) / 3) }).map(
                            (_, rowIndex) => {
                                const items = [];

                                // 第一行第一个位置：添加按钮
                                if (rowIndex === 0) {
                                    items.push(
                                        <div key="add-button" className="flex-1 relative">
                            <button
                                onClick={handleAddPhoto}
                                                className="absolute inset-0 bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-orange-500 transition-colors"
                            >
                                <div className="text-4xl text-gray-300 mb-2">+</div>
                                <div className="text-sm text-gray-400">添加照片</div>
                            </button>
                            <div style={getPhotoContainerStyle()}></div>
                        </div>
                                    );
                                }

                                // 计算当前行应该显示的照片
                                const startIndex = rowIndex === 0 ? 0 : rowIndex * 3 - 1;
                                const photosInRow = rowIndex === 0 ? 2 : 3;
                                const rowPhotos = photos.slice(startIndex, startIndex + photosInRow);

                                // 添加照片项
                                rowPhotos.forEach((photo) => {
                                    items.push(
                                        <PhotoCard
                                            key={photo.id}
                                            photo={photo}
                                            containerStyle={getPhotoContainerStyle()}
                                            isConfirmed={confirmedPhotos.has(photo.id)}
                                            warningMessage={getPhotoWarning(photo)}
                                            onRemove={() => handleRemovePhoto(photo.id)}
                                            onQuantityChange={(delta) =>
                                                handleQuantityChange(photo.id, delta)
                                            }
                                            onConfirm={() => handleConfirmPhoto(photo.id)}
                                            onEdit={() => setEditingPhoto(photo)}
                                        />
                                    );
                                });

                                // 填充空白项以保持对齐
                                while (items.length < 3) {
                                    items.push(
                                        <div
                                            key={`placeholder-${rowIndex}-${items.length}`}
                                            className="flex-1"
                                        ></div>
                                    );
                                }

                                return (
                                    <div key={`row-${rowIndex}`} className="flex gap-3">
                                        {items}
                                    </div>
                                );
                            }
                        )}
                        </div>
                </div>

                {/* 底部结算区域 */}
                <div className="bg-white border-t px-4 py-3 sticky bottom-0">
                    {/* 包邮提示 */}
                    {remainingForFreeShipping > 0 && (
                        <div className="text-sm text-orange-500 mb-2">
                            满 {FREE_SHIPPING_THRESHOLD} 张包邮，还差 {remainingForFreeShipping}{' '}
                            张
                        </div>
                    )}
                    {remainingForFreeShipping === 0 && (
                        <div className="text-sm text-green-500 mb-2">已满足包邮条件 🎉</div>
                    )}

                    {/* 价格和提交按钮 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm text-gray-500">合计</span>
                                <span className="text-xl font-bold text-orange-500">
                                    ¥{total.toFixed(2)}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                共 {totalQuantity} 张 运费 ¥{shippingFee}
                            </div>
                        </div>

                        <button
                            onClick={handleSubmitOrder}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full font-medium text-base transition-colors shadow-lg"
                            disabled={photos.length === 0}
                        >
                            提交订单
                        </button>
                    </div>
                </div>
            </div>

            {/* 规格选择弹出层 */}
            {showSizeSelector && (
                <SizeSelector
                    selectedSize={selectedSize}
                    onSelectSize={setSelectedSize}
                    onClose={() => setShowSizeSelector(false)}
                />
            )}

            {/* 照片编辑器弹窗 */}
            {editingPhoto && (
                <PhotoEditor
                    photo={editingPhoto}
                    aspectRatio={currentAspectRatio}
                    onClose={() => setEditingPhoto(null)}
                    onSave={(updatedPhoto) => {
                        // TODO: 保存编辑后的照片信息
                        setEditingPhoto(null);
                    }}
                />
            )}
        </>
    );
}
