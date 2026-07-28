/**
 * HAM Radio Toolbox - 卫星跟踪服务层
 * 双API架构：WTIA免费API(仅ISS) / N2YO高级API(需Key,多卫星+过境预测)
 * 用户自选数据源，无本地轨道计算（简化SGP4误差大，无实用价值）
 * WTIA API: https://api.wheretheiss.at/v1/satellites (免费,仅ISS)
 * N2YO API: https://www.n2yo.com/api/ (需Key,多卫星+过境预测)
 * @module services/satellite-service
 */
import type { SatApiSource, SatelliteInfo, N2yoPosition, WtiaPosition, SatPass, LookAngle } from '../types.js';
/**
 * 获取当前API数据源
 * @returns 'wtia' | 'n2yo'
 */
export declare function getApiSource(): SatApiSource;
/**
 * 设置API数据源
 * @param source - 'wtia' | 'n2yo'
 */
export declare function setApiSource(source: SatApiSource): void;
/**
 * 获取N2YO API Key
 * @returns API Key
 */
export declare function getApiKey(): string;
/**
 * 设置N2YO API Key
 * @param key - API Key
 */
export declare function setApiKey(key: string): void;
/**
 * 检查API Key是否已配置
 */
export declare function hasApiKey(): boolean;
/** N2YO API返回的位置数据结构 */
interface N2yoApiResponse {
    error?: string;
    positions?: Array<{
        satlatitude: number;
        satlongitude: number;
        sataltitude: number;
        satvelocity: number;
        elevation: number;
        azimuth: number;
        dist: number;
        timestamp: number;
    }>;
    passes?: Array<{
        startUTC: number;
        maxElUTC: number;
        endUTC: number;
        maxEl: number;
        maxElAz: number;
        startAz: number;
        endAz: number;
    }>;
}
/**
 * 从N2YO获取卫星实时位置
 * @param noradId - NORAD编号
 * @param obsLat - 观测者纬度
 * @param obsLon - 观测者经度
 * @param obsAlt - 观测者高度(km)
 * @param seconds - 预测秒数(0=仅当前位置)
 * @returns N2YO位置数据
 */
export declare function fetchSatPosition(noradId: number, obsLat: number, obsLon: number, obsAlt?: number, seconds?: number): Promise<N2yoApiResponse | null>;
/**
 * 从N2YO获取卫星过境预测
 * @param noradId - NORAD编号
 * @param obsLat - 观测者纬度
 * @param obsLon - 观测者经度
 * @param obsAlt - 观测者高度(km)
 * @param days - 预测天数(1-10)
 * @param minElevation - 最低仰角(度)
 * @returns N2YO过境数据
 */
export declare function fetchSatPasses(noradId: number, obsLat: number, obsLon: number, obsAlt?: number, days?: number, minElevation?: number): Promise<N2yoApiResponse | null>;
/**
 * 解析N2YO位置数据为标准格式
 * @param n2yoData - N2YO API返回数据
 * @returns N2YO位置数据或null
 */
export declare function parseN2yoPosition(n2yoData: N2yoApiResponse | null): N2yoPosition | null;
/**
 * 解析N2YO过境数据为标准格式
 * @param n2yoData - N2YO API返回数据
 * @returns 过境信息数组
 */
export declare function parseN2yoPasses(n2yoData: N2yoApiResponse | null): SatPass[];
/** WTIA API返回数据结构 */
interface WtiaApiResponse {
    error?: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    velocity?: number;
    visibility?: string;
    footprint?: number;
    timestamp?: number;
}
/**
 * 从WTIA获取卫星实时位置（无需API Key）
 * 目前仅支持ISS(NORAD 25544)
 * @param noradId - NORAD编号
 * @returns WTIA位置数据
 */
export declare function fetchWtiaPosition(noradId: number): Promise<WtiaApiResponse | null>;
/**
 * 解析WTIA位置数据为标准格式
 * WTIA不提供观测者相关数据(仰角/方位角/距离)，需calcLookAngle计算
 * @param wtiaData - WTIA API返回数据
 * @returns WTIA位置数据或null
 */
export declare function parseWtiaPosition(wtiaData: WtiaApiResponse | null): WtiaPosition | null;
/**
 * 检查WTIA是否支持指定卫星
 * 目前WTIA仅支持ISS(25544)
 * @param noradId - NORAD编号
 */
export declare function isWtiaSupported(noradId: number): boolean;
/**
 * 获取常用业余卫星列表
 * @returns 卫星信息数组
 */
export declare function getPopularSatellites(): SatelliteInfo[];
/** 卫星位置参数（支持经纬度或ECEF坐标） */
interface SatPositionInput {
    lat: number;
    lon: number;
    alt: number;
    xEcef?: number;
    yEcef?: number;
    zEcef?: number;
}
/**
 * 计算观测者到卫星的仰角和方位角
 * 纯几何计算，不涉及轨道模型，精度取决于卫星位置数据
 * @param satPos - 卫星位置 {lat, lon, alt} 或 {xEcef, yEcef, zEcef}
 * @param obsLat - 观测者纬度(度)
 * @param obsLon - 观测者经度(度)
 * @param obsAlt - 观测者高度(km)
 * @returns 仰角、方位角、距离
 */
export declare function calcLookAngle(satPos: SatPositionInput, obsLat: number, obsLon: number, obsAlt?: number): LookAngle;
export {};
