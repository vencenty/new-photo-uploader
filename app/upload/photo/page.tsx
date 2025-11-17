'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Photo {
    id: string;
    url: string;
    quantity: number;
}

export default function PhotoPrintPage() {
    const [photos, setPhotos] = useState<Photo[]>([
        {
            id: '1',
            url: '/placeholder1.jpg',
            quantity: 1,
        },
        {
            id: '2',
            url: '/placeholder2.jpg',
            quantity: 1,
        },
        {
            id: '3',
            url: '/placeholder3.jpg',
            quantity: 1,
        },
        {
            id: '4',
            url: '/placeholder4.jpg',
            quantity: 1,
        },
        {
            id: '5',
            url: '/placeholder5.jpg',
            quantity: 1,
        },
        {
            id: '6',
            url: '/placeholder6.jpg',
            quantity: 1,
        },
        {
            id: '7',
            url: '/placeholder7.jpg',
            quantity: 1,
        },
        {
            id: '8',
            url: '/placeholder8.jpg',
            quantity: 1,
        },
        {
            id: '9',
            url: '/placeholder9.jpg',
            quantity: 1,
        },
    ]);

    const PRICE_PER_PHOTO = 3.5;
    const SHIPPING_FEE = 6;
    const FREE_SHIPPING_THRESHOLD = 20;

    const totalQuantity = photos.reduce((sum, photo) => sum + photo.quantity, 0);
    const subtotal = totalQuantity * PRICE_PER_PHOTO;
    const shippingFee = totalQuantity >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shippingFee;
    const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalQuantity);

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
        // 这里可以实现图片上传逻辑
        console.log('添加照片');
    };

    const handleSubmitOrder = () => {
        // 这里实现提交订单逻辑
        console.log('提交订单');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* 顶部导航栏 */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="flex items-center justify-between px-4 py-3">
                    <button className="text-2xl" onClick={() => window.history.back()}>
                        ←
                    </button>
                    <h1 className="text-lg font-medium color-red">田田洗照片</h1>
                    <button
                        className="text-gray-600 text-sm"
                        onClick={handleClearAll}
                    >
                        清空
                    </button>
                </div>
            </header>

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
                    <button
                        onClick={handleAddPhoto}
                        className="flex-1 h-48 bg-white rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-orange-500 transition-colors"
                    >
                        <div className="text-4xl text-gray-300 mb-2">+</div>
                        <div className="text-sm text-gray-400">添加照片</div>
                    </button>

                    {/* 第一行的前2张照片 */}
                    {photos.slice(0, 2).map((photo) => (
                        <div key={photo.id} className="flex-1 relative">
                            <div className="h-48 bg-white rounded-lg overflow-hidden shadow-sm relative group">
                                {/* 删除按钮 */}
                                <button
                                    onClick={() => handleRemovePhoto(photo.id)}
                                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                                >
                                    ×
                                </button>

                                {/* 图片 */}
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                    <span className="text-gray-400 text-xs">照片预览</span>
                                </div>

                                {/* 右上角徽章 */}
                                <div className="absolute top-2 left-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center">
                                    <span className="text-xs">👑</span>
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
                                <span className="text-base font-medium w-8 text-center">{photo.quantity}</span>
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
                                            <div className="h-48 bg-white rounded-lg overflow-hidden shadow-sm relative group">
                                                {/* 删除按钮 */}
                                                <button
                                                    onClick={() => handleRemovePhoto(photo.id)}
                                                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
                                                >
                                                    ×
                                                </button>

                                                {/* 图片 */}
                                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                                    <span className="text-gray-400 text-xs">照片预览</span>
                                                </div>

                                                {/* 右上角徽章 */}
                                                <div className="absolute top-2 left-2 bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center">
                                                    <span className="text-xs">👑</span>
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
                                                <span className="text-base font-medium w-8 text-center">{photo.quantity}</span>
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
    );
}
