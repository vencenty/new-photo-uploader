export interface Photo {
    id: string;
    url: string;
    quantity: number;
    fileSize: number; // 文件大小（字节）
    width?: number; // 图片宽度（像素）
    height?: number; // 图片高度（像素）
}

export type PhotoSize = '5寸' | '6寸' | '7寸' | '正方形';

export interface SizeOption {
    size: PhotoSize;
    label: string;
    aspectRatio: number;
}

export const PHOTO_SIZES: SizeOption[] = [
    { size: '5寸', label: '5寸:光面-普通版', aspectRatio: 7 / 10 },
    { size: '6寸', label: '6寸:光面-普通版', aspectRatio: 2 / 3 },
    { size: '7寸', label: '7寸:光面-普通版', aspectRatio: 5 / 7 },
    { size: '正方形', label: '正方形', aspectRatio: 1 / 1 },
];


