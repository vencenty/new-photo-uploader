/**
 * 检查是否为 HEIC/HEIF 文件
 */
const isHeicFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    return (
        fileName.endsWith('.heic') ||
        fileName.endsWith('.heif') ||
        mimeType === 'image/heic' ||
        mimeType === 'image/heif'
    );
};

/**
 * 从图片文件中读取 EXIF 拍摄日期
 * 支持 JPEG 和 HEIC 格式
 */
export async function readExifDate(file: File): Promise<string | undefined> {
    // HEIC 文件使用特殊的读取方法
    if (isHeicFile(file)) {
        return readHeicDate(file);
    }
    
    // 只处理 JPEG 格式
    if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !file.type.includes('image/')) {
        return undefined;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const date = extractDateFromExif(buffer);
                resolve(date);
            } catch {
                resolve(undefined);
            }
        };
        reader.onerror = () => resolve(undefined);
        reader.readAsArrayBuffer(file.slice(0, 128 * 1024)); // 只读取前 128KB
    });
}

/**
 * 从 HEIC 文件中读取拍摄日期
 * HEIC 文件的 EXIF 数据格式不同于 JPEG，需要特殊处理
 */
async function readHeicDate(file: File): Promise<string | undefined> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const uint8Array = new Uint8Array(buffer);
                
                // 尝试在二进制数据中搜索日期字符串模式
                // HEIC 文件可能包含类似 "2024:01:15 10:30:00" 的日期字符串
                const text = new TextDecoder('ascii', { fatal: false }).decode(uint8Array);
                
                // 搜索 EXIF 日期格式: YYYY:MM:DD HH:MM:SS
                const datePattern = /(\d{4}):(\d{2}):(\d{2})\s+\d{2}:\d{2}:\d{2}/g;
                const matches = text.match(datePattern);
                
                if (matches && matches.length > 0) {
                    // 使用找到的第一个日期
                    const dateMatch = matches[0].match(/(\d{4}):(\d{2}):(\d{2})/);
                    if (dateMatch) {
                        resolve(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
                        return;
                    }
                }
                
                // 尝试搜索其他日期格式
                const isoDatePattern = /(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}/g;
                const isoMatches = text.match(isoDatePattern);
                
                if (isoMatches && isoMatches.length > 0) {
                    const dateMatch = isoMatches[0].match(/(\d{4})-(\d{2})-(\d{2})/);
                    if (dateMatch) {
                        resolve(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
                        return;
                    }
                }
                
                resolve(undefined);
            } catch {
                resolve(undefined);
            }
        };
        reader.onerror = () => resolve(undefined);
        // HEIC 文件可能需要读取更多数据来找到日期信息
        reader.readAsArrayBuffer(file.slice(0, 256 * 1024)); // 读取前 256KB
    });
}

/**
 * 从文件的修改时间获取日期（作为备选方案）
 */
export function getFileDateFallback(file: File): string {
    const date = new Date(file.lastModified);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 从 ArrayBuffer 中提取 EXIF 日期
 */
function extractDateFromExif(buffer: ArrayBuffer): string | undefined {
    const view = new DataView(buffer);
    
    // 检查 JPEG SOI 标记
    if (view.getUint16(0) !== 0xFFD8) {
        return undefined;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset < length) {
        if (view.getUint8(offset) !== 0xFF) {
            return undefined;
        }

        const marker = view.getUint8(offset + 1);
        
        // APP1 标记 (EXIF)
        if (marker === 0xE1) {
            const exifLength = view.getUint16(offset + 2);
            return parseExifData(view, offset + 4, exifLength - 2);
        }
        
        // 跳过其他段
        if (marker === 0xD8 || marker === 0xD9) {
            offset += 2;
        } else {
            const segmentLength = view.getUint16(offset + 2);
            offset += 2 + segmentLength;
        }
    }

    return undefined;
}

/**
 * 解析 EXIF 数据获取日期
 */
function parseExifData(view: DataView, start: number, length: number): string | undefined {
    // 检查 "Exif\0\0" 标识
    const exifHeader = String.fromCharCode(
        view.getUint8(start),
        view.getUint8(start + 1),
        view.getUint8(start + 2),
        view.getUint8(start + 3)
    );
    
    if (exifHeader !== 'Exif') {
        return undefined;
    }

    const tiffStart = start + 6;
    
    // 检查字节序 (II = little endian, MM = big endian)
    const byteOrder = view.getUint16(tiffStart);
    const littleEndian = byteOrder === 0x4949;

    // 检查 TIFF 标识 (42)
    if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002A) {
        return undefined;
    }

    // 获取第一个 IFD 偏移
    const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
    
    // 解析 IFD0
    const exifIfdOffset = parseIfd(view, tiffStart, ifdOffset, littleEndian);
    
    if (exifIfdOffset) {
        // 解析 EXIF IFD 获取日期
        return parseDateFromExifIfd(view, tiffStart, exifIfdOffset, littleEndian, length);
    }

    return undefined;
}

/**
 * 解析 IFD 获取 EXIF IFD 偏移
 */
function parseIfd(view: DataView, tiffStart: number, ifdOffset: number, littleEndian: boolean): number | undefined {
    const offset = tiffStart + ifdOffset;
    const numEntries = view.getUint16(offset, littleEndian);

    for (let i = 0; i < numEntries; i++) {
        const entryOffset = offset + 2 + i * 12;
        const tag = view.getUint16(entryOffset, littleEndian);
        
        // EXIF IFD 指针 (tag 0x8769)
        if (tag === 0x8769) {
            return view.getUint32(entryOffset + 8, littleEndian);
        }
    }

    return undefined;
}

/**
 * 从 EXIF IFD 中解析日期
 */
function parseDateFromExifIfd(
    view: DataView, 
    tiffStart: number, 
    exifIfdOffset: number, 
    littleEndian: boolean,
    maxLength: number
): string | undefined {
    const offset = tiffStart + exifIfdOffset;
    
    // 边界检查
    if (offset + 2 > view.byteLength) {
        return undefined;
    }
    
    const numEntries = view.getUint16(offset, littleEndian);

    for (let i = 0; i < numEntries; i++) {
        const entryOffset = offset + 2 + i * 12;
        
        // 边界检查
        if (entryOffset + 12 > view.byteLength) {
            break;
        }
        
        const tag = view.getUint16(entryOffset, littleEndian);
        
        // DateTimeOriginal (tag 0x9003) 或 DateTimeDigitized (0x9004) 或 DateTime (0x0132)
        if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
            const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
            const stringOffset = tiffStart + valueOffset;
            
            // 边界检查
            if (stringOffset + 19 > view.byteLength) {
                continue;
            }
            
            // 读取日期字符串 (格式: "YYYY:MM:DD HH:MM:SS")
            let dateStr = '';
            for (let j = 0; j < 19; j++) {
                dateStr += String.fromCharCode(view.getUint8(stringOffset + j));
            }
            
            // 解析日期
            const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2})/);
            if (match) {
                return `${match[1]}-${match[2]}-${match[3]}`;
            }
        }
    }

    return undefined;
}

/**
 * 格式化日期字符串
 */
export function formatDate(dateStr: string, format: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const [year, month, day] = parts;
    
    switch (format) {
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'YYYY/MM/DD':
            return `${year}/${month}/${day}`;
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'DD.MM.YYYY':
            return `${day}.${month}.${year}`;
        case 'YYYY年MM月DD日':
            return `${year}年${month}月${day}日`;
        default:
            return dateStr;
    }
}


