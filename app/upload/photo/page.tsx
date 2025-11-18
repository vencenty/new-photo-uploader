'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

interface Photo {
    id: string;
    url: string;
    quantity: number;
}

type PhotoSize = '5寸' | '6寸' | '7寸' | '正方形';

interface SizeOption {
    size: PhotoSize;
    label: string;
    aspectRatio: number;
}

const PHOTO_SIZES: SizeOption[] = [
    { size: '5寸', label: '5寸:光面-普通版', aspectRatio: 7 / 10 },
    { size: '6寸', label: '6寸:光面-普通版', aspectRatio: 2 / 3 },
    { size: '7寸', label: '7寸:光面-普通版', aspectRatio: 5 / 7 },
    { size: '正方形', label: '正方形', aspectRatio: 1 / 1 },
];

export default function PhotoPrintPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photos, setPhotos] = useState<Photo[]>([] as Photo[]);
    const [selectedSize, setSelectedSize] = useState<PhotoSize>('5寸');
    const [showSizeSelector, setShowSizeSelector] = useState(false);

    const PRICE_PER_PHOTO = 3.5;
    const SHIPPING_FEE = 6;
    const FREE_SHIPPING_THRESHOLD = 20;

    const totalQuantity = photos.reduce((sum, photo) => sum + photo.quantity, 0);
    const subtotal = totalQuantity * PRICE_PER_PHOTO;
    const shippingFee = totalQuantity >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shippingFee;
    const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalQuantity);

    // 获取当前选择的宽高比
    const currentAspectRatio = PHOTO_SIZES.find(s => s.size === selectedSize)?.aspectRatio || 7 / 10;

    // 计算照片容器的样式（基于宽高比）
    const getPhotoContainerStyle = () => {
        // 基准宽度，容器会自动调整
        // 使用padding-top技巧来保持宽高比
        return {
            paddingTop: `${(1 / currentAspectRatio) * 100}%`
        };
    };

    const handleQuantityChange = (id: string, delta: number) => {
        setPhotos(photos.map(photo => {
            if (photo.id === id) {
                const newQuantity = Math.max(1, photo.quantity + delta);
                return { ...photo, quantity: newQuantity };
            }
            return photo;
        }));
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(photos.filter(photo => photo.id !== id));
    };

    const handleClearAll = () => {
        setPhotos([]);
    };

    const handleAddPhoto = () => {
        // 触发文件选择器
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const validPhotos: Photo[] = [];
        const errors: string[] = [];

        // 处理所有选中的文件
        for (const file of Array.from(files)) {
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                errors.push(`${file.name} 不是图片文件`);
                continue;
            }

            // 检查文件大小
            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name} 超过50MB限制`);
                continue;
            }

            try {
                // 创建图片URL
                const imageUrl = URL.createObjectURL(file);

                // 预加载图片以确保能正常显示
                await new Promise<void>((resolve, reject) => {
                    const img = document.createElement('img');
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('图片加载失败'));
                    img.src = imageUrl;
                });

                // 生成唯一ID（使用时间戳 + 随机数确保唯一性）
                const newPhoto: Photo = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: imageUrl,
                    quantity: 1
                };

                validPhotos.push(newPhoto);
            } catch (error) {
                errors.push(`${file.name} 加载失败`);
                console.error(`图片加载错误:`, error);
            }
        }

        // 批量添加有效的照片到列表
        if (validPhotos.length > 0) {
            setPhotos(prevPhotos => [...prevPhotos, ...validPhotos]);
        }

        // 显示错误信息（如果有）
        if (errors.length > 0) {
            alert(`以下文件处理失败:\n${errors.join('\n')}`);
        }

        // 重置文件输入，以便可以重复选择同一文件
        event.target.value = '';
    };

    const handleSubmitOrder = () => {
        // 这里实现提交订单逻辑
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
                        <button className="text-2xl text-black" onClick={() => window.history.back()}>
                            ←
                        </button>
                        <h1 className="text-lg font-medium text-black">田田洗照片</h1>
                        <button
                            className="text-gray-600 text-sm"
                            onClick={handleClearAll}
                        >
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
                                {PHOTO_SIZES.find(s => s.size === selectedSize)?.label}
                            </span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 打印区域示意 */}
                <div className="px-4 py-3 bg-white">
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span>显示区域即为打印区域，请点击图片进行调整</span>
                    </div>
                </div>

                {/* 照片列表区域 */}
                <div className="flex-1 px-4 py-4 bg-gray-50">
                    {/* 第一行：添加按钮 + 2张照片 */}
                    <div className="flex gap-3 mb-4">
                        {/* 添加照片按钮 - 固定 */}
                        <div className="flex-1 relative">
                            <button
                                onClick={handleAddPhoto}
                                className="absolute inset-0 bg-white  border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-orange-500 transition-colors"
                            >
                                <div className="text-4xl text-gray-300 mb-2">+</div>
                                <div className="text-sm text-gray-400">添加照片</div>
                            </button>
                            <div style={getPhotoContainerStyle()}></div>
                        </div>

                        {/* 第一行的前2张照片 */}
                        {photos.slice(0, 2).map((photo) => (
                            <div key={photo.id} className="flex-1 relative">
                                <div className="bg-white overflow-hidden shadow-sm relative" style={getPhotoContainerStyle()}>
                                    <div className="absolute inset-0">
                                        {/* 删除按钮 */}
                                        <button
                                            onClick={() => handleRemovePhoto(photo.id)}
                                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                                        >
                                            ×
                                        </button>

                                        {/* 图片 */}
                                        <div className="w-full h-full">
                                            <img
                                                src={photo.url}
                                                alt="照片"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    console.error('图片加载失败:', photo.url);
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <div className="flex flex-col items-center justify-center absolute inset-0 bg-black/40 rounded-xl">
                                                {/* 提示文字 */}
                                                
                                                    <div className="text-lg font-medium text-red-100 text-lg mb-2">
                                                        图片不清晰
                                                    </div>

                                                    {/* 确认按钮 */}
                                                    <button
                                                        className="p-2 py-2.5 bg-black text-white rounded-xl text-center text-base active:scale-95 transition text-xs"
                                                        onClick={() => {
                                                            // TODO: 你的确认逻辑
                                                            setShowSizeSelector(false);
                                                        }}
                                                    >
                                                        确认使用
                                                    </button>
                                                

                                            </div>

                                        </div>

                                        {/* 右上角徽章 */}
                                        {/* <div className="absolute top-2 left-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center"> */}
                                        {/* <span className="text-xs">👑</span> */}
                                        {/* </div> */}
                                    </div>
                                </div>

                                {/* 数量调整器 */}
                                <div className="mt-2 flex items-center justify-center gap-3 bg-white rounded-full py-2 shadow-sm">
                                    <button
                                        onClick={() => handleQuantityChange(photo.id, -1)}
                                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                                        disabled={photo.quantity <= 1}
                                    >
                                        −
                                    </button>
                                    <span className="text-base font-medium w-8 text-center text-black">{photo.quantity}</span>
                                    <button
                                        onClick={() => handleQuantityChange(photo.id, 1)}
                                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* 如果第一行不足3个（包含添加按钮），填充空白 */}
                        {photos.length < 2 && Array.from({ length: 2 - photos.length }).map((_, idx) => (
                            <div key={`placeholder-first-${idx}`} className="flex-1"></div>
                        ))}
                    </div>

                    {/* 后续行：每行3张照片 */}
                    {photos.length > 2 && (
                        <div className="space-y-4">
                            {Array.from({ length: Math.ceil((photos.length - 2) / 3) }).map((_, rowIndex) => {
                                const startIndex = 2 + rowIndex * 3;
                                const rowPhotos = photos.slice(startIndex, startIndex + 3);

                                return (
                                    <div key={`row-${rowIndex}`} className="flex gap-3">
                                        {rowPhotos.map((photo) => (
                                            <div key={photo.id} className="flex-1 relative">
                                                <div className="bg-white rounded-lg overflow-hidden shadow-sm relative" style={getPhotoContainerStyle()}>
                                                    <div className="absolute inset-0">
                                                        {/* 删除按钮 */}
                                                        <button
                                                            onClick={() => handleRemovePhoto(photo.id)}
                                                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                                                        >
                                                            ×
                                                        </button>

                                                        {/* 图片 */}
                                                        <div className="w-full h-full">
                                                            <img
                                                                src={photo.url}
                                                                alt="照片"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    console.error('图片加载失败:', photo.url);
                                                                    e.currentTarget.style.display = 'none';
                                                                }}
                                                            />
                                                        </div>

                                                        {/* 左上角徽章 */}
                                                        {/* <div className="absolute top-2 left-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center">
                                                            <span className="text-xs">👑</span>
                                                        </div> */}
                                                    </div>
                                                </div>

                                                {/* 数量调整器 */}
                                                <div className="mt-2 flex items-center justify-center gap-3 bg-white rounded-full py-2 shadow-sm">
                                                    <button
                                                        onClick={() => handleQuantityChange(photo.id, -1)}
                                                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                                                        disabled={photo.quantity <= 1}
                                                    >
                                                        −
                                                    </button>
                                                    <span className="text-base font-medium w-8 text-center text-black">{photo.quantity}</span>
                                                    <button
                                                        onClick={() => handleQuantityChange(photo.id, 1)}
                                                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-orange-500"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* 如果该行不足3张，填充空白以保持对齐 */}
                                        {rowPhotos.length < 3 && Array.from({ length: 3 - rowPhotos.length }).map((_, idx) => (
                                            <div key={`placeholder-${rowIndex}-${idx}`} className="flex-1"></div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 底部结算区域 */}
                <div className="bg-white border-t px-4 py-3 sticky bottom-0">
                    {/* 包邮提示 */}
                    {remainingForFreeShipping > 0 && (
                        <div className="text-sm text-orange-500 mb-2">
                            满 {FREE_SHIPPING_THRESHOLD} 张包邮，还差 {remainingForFreeShipping} 张
                        </div>
                    )}
                    {remainingForFreeShipping === 0 && (
                        <div className="text-sm text-green-500 mb-2">
                            已满足包邮条件 🎉
                        </div>
                    )}

                    {/* 价格和提交按钮 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm text-gray-500">合计</span>
                                <span className="text-xl font-bold text-orange-500">¥{total.toFixed(2)}</span>
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
                <div
                    className="fixed inset-0 bg-opacity-80 z-50 flex items-end"
                    onClick={() => setShowSizeSelector(false)}
                >
                    <div
                        className="bg-white w-full rounded-t-2xl animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 弹出层标题 */}
                        <div className="flex items-center justify-between px-4 py-4 border-b">
                            <span className="text-lg font-medium text-black">选择规格</span>
                            <button
                                onClick={() => setShowSizeSelector(false)}
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
                                    className={`flex items-center justify-between py-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedSize === option.size ? 'text-orange-500' : 'text-black'
                                        }`}
                                    onClick={() => {
                                        setSelectedSize(option.size);
                                        setShowSizeSelector(false);
                                    }}
                                >
                                    <span className="text-base">{option.label}</span>
                                    {selectedSize === option.size && (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* 安全区域 */}
                        <div className="h-8"></div>
                    </div>
                </div>
            )}
        </>
    );
}
