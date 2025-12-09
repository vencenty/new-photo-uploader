// ==================== 配置常量 ====================

/**
 * 出血线区域百分比（满版样式）
 * 用于显示出血警告区域，提示用户该区域内容可能被裁切
 * 值范围：0-50，单位：%
 */
export const BLEED_AREA_PERCENT = 1;

/**
 * 留白边框百分比（留白样式）
 * 用于在照片四周添加白色边框
 * 值范围：0-50，单位：%
 */
export const WHITE_MARGIN_PERCENT = 5;

// ==================== 类型定义 ====================

export interface PhotoTransform {
    position: { x: number; y: number };
    scale: number;
    rotation: number;
    containerWidth: number; // 保存时编辑器容器的宽度
    containerHeight: number; // 保存时编辑器容器的高度
}

export interface Photo {
    id: string;
    url: string;
    quantity: number;
    fileSize: number; // 文件大小（字节）
    width?: number; // 图片宽度（像素）
    height?: number; // 图片高度（像素）
    transform?: PhotoTransform; // 编辑后的变换信息
    autoRotated?: boolean; // 是否自动旋转（横图转竖图）
    takenAt?: string; // 照片拍摄日期（从 EXIF 读取）
}

// ==================== 水印配置 ====================

/** 水印位置 */
export type WatermarkPosition = 
    | 'top-left' 
    | 'top-center' 
    | 'top-right' 
    | 'bottom-left' 
    | 'bottom-center' 
    | 'bottom-right';

/** 水印大小 */
export type WatermarkSize = 'small' | 'medium' | 'large';

/** 日期格式 */
export type DateFormat = 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYY MM DD' | '\'YY MM DD' | 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'YYYY年MM月DD日';

/** 水印配置接口 */
export interface WatermarkConfig {
    enabled: boolean;           // 是否启用水印
    position: WatermarkPosition; // 水印位置
    size: WatermarkSize;        // 水印大小
    color: string;              // 水印颜色（hex）
    dateFormat: DateFormat;     // 日期格式
    opacity: number;            // 透明度 0-100
}

/** 默认水印配置 */
export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
    enabled: false,
    position: 'bottom-right',
    size: 'medium',
    color: '#FF6B00',  // 橙红色 - 传统照片日期戳颜色
    dateFormat: 'YYYY-MM-DD',
    opacity: 90,
};

/** 水印位置选项 */
export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
    { value: 'top-left', label: '左上' },
    { value: 'top-center', label: '上中' },
    { value: 'top-right', label: '右上' },
    { value: 'bottom-left', label: '左下' },
    { value: 'bottom-center', label: '下中' },
    { value: 'bottom-right', label: '右下' },
];

/** 水印大小选项 */
export const WATERMARK_SIZES: { value: WatermarkSize; label: string; fontSize: number }[] = [
    { value: 'small', label: '小', fontSize: 8 },
    { value: 'medium', label: '中', fontSize: 10 },
    { value: 'large', label: '大', fontSize: 12 },
];

/** 日期格式选项 */
export const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
    { value: 'YYYY-MM-DD', label: '年-月-日', example: '2024-01-15' },
    { value: 'YYYY/MM/DD', label: '年/月/日', example: '2024/01/15' },
    { value: 'YYYY MM DD', label: '年 月 日', example: '2024 01 15' },
    // { value: 'MM/DD/YYYY', label: '月/日/年', example: '01/15/2024' },
    // { value: 'DD.MM.YYYY', label: '日.月.年', example: '15.01.2024' },
    // { value: 'YYYY年MM月DD日', label: '中文格式', example: '2024年01月15日' },
];

/** 预设颜色 - 传统照片日期戳风格 */
export const WATERMARK_COLORS = [
    '#FF6B00', // 橙红色（经典日期戳）
    '#FF8C00', // 暗橙色
    '#FFD700', // 金黄色
    '#FFFFFF', // 白色
    '#000000', // 黑色
];

export type PhotoSize = '5寸' | '6寸' | '7寸' | '正方形';

export type StyleType = 'full_bleed' | 'white_margin' | 'instax';

export interface StyleOption {
    label: string;
    description?: string;
    type: StyleType;
}

export interface SizeOption {
    size: PhotoSize;
    label: string;
    aspectRatio: number;
    styles: StyleOption[];
}

export const PHOTO_SIZES: SizeOption[] = [
    { 
        size: '5寸', 
        label: '5寸:光面-普通版', 
        aspectRatio: 7 / 10,
        styles: [
            { label: '满版', description: '此规格存在裁切', type: 'full_bleed' },
            { label: '留白', type: 'white_margin' },
        ]
    },
    { 
        size: '6寸', 
        label: '6寸:光面-普通版', 
        aspectRatio: 2 / 3,
        styles: [
            { label: '满版', description: '此规格存在裁切', type: 'full_bleed' },
            { label: '留白', type: 'white_margin' },
        ]
    },
    { 
        size: '7寸', 
        label: '7寸:光面-普通版', 
        aspectRatio: 5 / 7,
        styles: [
            { label: '满版', description: '此规格存在裁切', type: 'full_bleed' },
            { label: '留白', type: 'white_margin' },
        ]
    },
    { 
        size: '正方形', 
        label: '正方形', 
        aspectRatio: 1 / 1,
        styles: [
            { label: '满版', description: '此规格存在裁切', type: 'full_bleed' },
            { label: '留白', type: 'white_margin' },
        ]
    },
];




