/**
 * OSS 直传工具
 * 客户端直接上传文件到阿里云OSS，不经过服务端转发
 */

import { OSS_DOMAIN_TYPE, OssDomainType } from '../config/uploadConfig';

const API_BASE_URL = 'http://localhost:8888';
const OSS_SIGNATURE_ENDPOINT = '/api/post/signature';

// OSS签名响应类型
export interface OssSignatureResponse {
    policy: string;
    security_token: string;
    x_oss_signature_version: string;
    x_oss_credential: string;
    x_oss_date: string;
    signature: string;
    host: string;
    dir: string;
    proxy_domain: string;  // 代理域名
    cdn_domain: string;    // CDN域名
}

// 缓存签名信息
let cachedSignature: OssSignatureResponse | null = null;
let cacheExpireTime: number = 0;

/**
 * 获取OSS上传签名（带缓存）
 */
export async function getOssSignature(): Promise<OssSignatureResponse> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (cachedSignature && now < cacheExpireTime) {
        console.log('📦 使用缓存的OSS签名');
        return cachedSignature;
    }

    console.log('🔄 获取新的OSS签名...');
    
    const response = await fetch(`${API_BASE_URL}${OSS_SIGNATURE_ENDPOINT}`, {
        method: 'GET',
    });

    if (!response.ok) {
        throw new Error(`获取OSS签名失败: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
        throw new Error(result.msg || '获取OSS签名失败');
    }

    cachedSignature = result.data;
    // 设置缓存过期时间（比服务端缓存早5分钟过期）
    cacheExpireTime = now + 25 * 60 * 1000; // 25分钟
    
    console.log('✅ OSS签名获取成功', {
        host: cachedSignature?.host,
        cdn_domain: cachedSignature?.cdn_domain,
        proxy_domain: cachedSignature?.proxy_domain,
    });
    
    return cachedSignature!;
}

/**
 * 根据配置的域名类型获取图片访问URL
 * @param signature OSS签名信息
 * @param key 文件的OSS键
 * @param domainType 域名类型（可选，默认使用配置文件中的值）
 */
export function buildImageUrl(
    signature: OssSignatureResponse, 
    key: string, 
    domainType?: OssDomainType
): string {
    const type = domainType || OSS_DOMAIN_TYPE;
    
    let baseUrl: string;
    switch (type) {
        case 'cdn':
            baseUrl = signature.cdn_domain;
            break;
        case 'proxy':
            baseUrl = signature.proxy_domain;
            break;
        case 'origin':
        default:
            baseUrl = signature.host;
            break;
    }
    
    return `${baseUrl}/${key}`;
}

/**
 * 生成文件的SHA1哈希（用于文件名）
 */
async function generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    // 规范化扩展名
    if (ext === 'jpeg') return 'jpg';
    return ext;
}

/**
 * 生成唯一的OSS对象键
 */
function generateOssKey(dir: string, filename: string, hash: string): string {
    const ext = getFileExtension(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    // 格式: uploads/timestamp_random_hash.ext
    return `${dir}/${timestamp}_${random}_${hash.substring(0, 16)}.${ext}`;
}

export interface OssUploadResult {
    url: string;           // 使用配置域名的访问URL
    originUrl: string;     // OSS原始域名URL
    cdnUrl: string;        // CDN域名URL
    proxyUrl: string;      // 代理域名URL
    key: string;
    filename: string;
    size: number;
}

/**
 * 上传文件到OSS
 * @param file 要上传的文件
 * @param customPrefix 自定义前缀目录（可选）
 */
export async function uploadToOss(file: File, customPrefix?: string): Promise<OssUploadResult> {
    // 1. 获取签名
    const signature = await getOssSignature();
    
    // 2. 生成文件哈希
    const fileHash = await generateFileHash(file);
    
    // 3. 生成OSS对象键
    const dir = customPrefix || signature.dir;
    const key = generateOssKey(dir, file.name, fileHash);
    
    // 4. 构建FormData
    const formData = new FormData();
    
    // 注意：OSS POST上传的字段顺序很重要
    formData.append('key', key);
    formData.append('policy', signature.policy);
    formData.append('x-oss-signature-version', signature.x_oss_signature_version);
    formData.append('x-oss-credential', signature.x_oss_credential);
    formData.append('x-oss-date', signature.x_oss_date);
    formData.append('x-oss-signature', signature.signature);
    formData.append('x-oss-security-token', signature.security_token);
    formData.append('file', file);

    console.log(`🚀 开始上传到OSS: ${key}`);
    
    // 5. 上传到OSS
    const response = await fetch(signature.host, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OSS上传失败:', errorText);
        throw new Error(`OSS上传失败: ${response.status}`);
    }

    // 6. 构建各种域名的访问URL
    const originUrl = `${signature.host}/${key}`;
    const cdnUrl = `${signature.cdn_domain}/${key}`;
    const proxyUrl = `${signature.proxy_domain}/${key}`;
    
    // 根据配置选择默认URL
    const url = buildImageUrl(signature, key);
    
    console.log(`✅ OSS上传成功:`);
    console.log(`   📍 使用URL (${OSS_DOMAIN_TYPE}): ${url}`);
    console.log(`   🌐 CDN: ${cdnUrl}`);
    console.log(`   🔄 Proxy: ${proxyUrl}`);
    console.log(`   📦 Origin: ${originUrl}`);

    return {
        url,
        originUrl,
        cdnUrl,
        proxyUrl,
        key,
        filename: file.name,
        size: file.size,
    };
}

/**
 * 批量上传文件到OSS
 * @param files 文件列表
 * @param concurrency 并发数
 * @param onProgress 进度回调
 */
export async function uploadMultipleToOss(
    files: Array<{ id: string; file: File }>,
    concurrency: number = 3,
    onProgress?: (completed: number, total: number, currentId: string) => void
): Promise<Array<{ id: string; result: OssUploadResult }>> {
    const results: Array<{ id: string; result: OssUploadResult }> = [];
    let completed = 0;
    let cursor = 0;
    const total = files.length;

    const runNext = async (): Promise<void> => {
        const current = cursor++;
        if (current >= total) return;
        
        const { id, file } = files[current];
        try {
            const result = await uploadToOss(file);
            results.push({ id, result });
            completed++;
            onProgress?.(completed, total, id);
        } catch (error) {
            console.error(`上传失败: ${id}`, error);
            throw error;
        }
        
        if (cursor < total) {
            await runNext();
        }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, total);
    for (let i = 0; i < workerCount; i++) {
        workers.push(runNext());
    }
    
    await Promise.all(workers);
    return results;
}
