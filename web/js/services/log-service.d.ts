/**
 * HAM Radio Toolbox - 日志业务逻辑服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/log-service
 */
import type { QsoEntry, QsoValidationResult, MonthStats } from '../types.js';
/**
 * 计算模式统计
 * @param qsos - QSO记录数组
 * @returns 排序后的[mode, count]数组
 */
export declare function calcModeStats(qsos: QsoEntry[]): [string, number][];
/**
 * 计算频段统计
 * @param qsos - QSO记录数组
 * @returns 排序后的[band, count]数组
 */
export declare function calcBandStats(qsos: QsoEntry[]): [string, number][];
/**
 * 计算月份统计（近12个月）
 * @param qsos - QSO记录数组
 * @returns {month: count}对象
 */
export declare function calcMonthStats(qsos: QsoEntry[]): MonthStats;
/**
 * 渲染单个统计表格HTML
 * @param title - 表格标题
 * @param label - 数据标签
 * @param data - 数据数组
 * @param total - 总数
 * @returns HTML字符串
 */
export declare function renderStatsTable(title: string, label: string, data: [string, number][], total: number): string;
/**
 * 渲染完整统计HTML
 * @param total - 总QSO数
 * @param uniqueCalls - 唯一呼号数
 * @param modeStats - 模式统计
 * @param bandStats - 频段统计
 * @param monthStats - 月份统计
 * @returns 完整HTML字符串
 */
export declare function renderStatsHtml(total: number, uniqueCalls: number, modeStats: [string, number][], bandStats: [string, number][], monthStats: MonthStats): string;
/**
 * 验证QSO记录数据完整性
 * @param qso - QSO记录对象
 * @returns 验证结果
 */
export declare function validateQso(qso: Partial<QsoEntry>): QsoValidationResult;
/**
 * 计算唯一呼号数
 * @param qsos - QSO记录数组
 * @returns 唯一呼号数
 */
export declare function countUniqueCalls(qsos: QsoEntry[]): number;
