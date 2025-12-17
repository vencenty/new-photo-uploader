// 上传相关配置，可按需调整

/** 最大并发上传数 */
export const MAX_CONCURRENT_UPLOADS = 3;

/** 
 * OSS域名类型
 * - 'cdn': 使用CDN域名（推荐，速度快）
 * - 'proxy': 使用代理域名（轻量服务器代理）
 * - 'origin': 使用OSS原始域名
 */
export type OssDomainType = 'cdn' | 'proxy' | 'origin';

/**
 * 当前使用的OSS域名类型
 * 可以修改此值来切换图片回显的域名
 */
export const OSS_DOMAIN_TYPE: OssDomainType = 'cdn';
