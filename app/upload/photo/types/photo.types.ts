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
}

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




