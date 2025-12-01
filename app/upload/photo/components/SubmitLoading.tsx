'use client';

import { useEffect } from 'react';

interface SubmitLoadingProps {
    currentStep: string;
    progress: number;
    onCancel?: () => void;
    canCancel?: boolean;
}

export function SubmitLoading({ currentStep, progress, onCancel, canCancel }: SubmitLoadingProps) {
    // 防止用户意外关闭页面
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '提交正在进行中，请不要关闭页面';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 max-w-md mx-4 w-full shadow-2xl">
                {/* 加载动画 */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        {/* 外圈 */}
                        <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                        {/* 内圈进度条 */}
                        <div
                            className="absolute top-0 left-0 w-16 h-16 border-4 border-orange-500 rounded-full transition-all duration-300"
                            style={{
                                clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)`,
                                transform: 'rotate(-90deg)',
                            }}
                        ></div>
                        {/* 中心图标 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 进度文本 */}
                <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        正在提交订单
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        {currentStep}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-500">
                        {progress}% 完成
                    </p>
                </div>

                {/* 取消按钮（如果允许） */}
                {canCancel && onCancel && (
                    <div className="text-center">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            取消提交
                        </button>
                    </div>
                )}

                {/* 提示信息 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-blue-700">
                            <p className="font-medium mb-1">请勿关闭页面</p>
                            <p>正在处理您的照片和订单信息，完成后将自动跳转。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

