/**
 * HAM Radio Toolbox - 地理计算服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/geo-service
 */
import type { LatLon, DistanceBearingResult } from '../types.js';
/**
 * Maidenhead网格坐标转经纬度
 * @param grid - 4/6/8位Maidenhead网格定位符
 * @returns 经纬度对象或null
 */
export declare function gridToLatLon(grid: string): LatLon | null;
/**
 * 经纬度转Maidenhead网格定位符
 * @param lat - 纬度
 * @param lon - 经度
 * @param precision - 精度位数(4/6/8)，默认6
 * @returns Maidenhead网格定位符
 */
export declare function latLonToGrid(lat: number, lon: number, precision?: number): string;
/**
 * Haversine公式计算两点间距离和方位角
 * @param lat1 - 起点纬度
 * @param lon1 - 起点经度
 * @param lat2 - 终点纬度
 * @param lon2 - 终点经度
 * @returns 距离(km)和方位角(度)
 */
export declare function calcDistanceBearing(lat1: number, lon1: number, lat2: number, lon2: number): DistanceBearingResult;
/**
 * 解析QTH定位符（支持多种格式）
 * @param qth - QTH定位符字符串
 * @returns 经纬度或null
 */
export declare function parseQth(qth: string): LatLon | null;
