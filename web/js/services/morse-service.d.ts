/**
 * HAM Radio Toolbox - 莫尔斯电码服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/morse-service
 */
import type { MorseCodeMap } from '../types.js';
/**
 * 文本转莫尔斯电码
 * @param text - 输入文本
 * @returns 莫尔斯电码字符串
 */
export declare function morseEncode(text: string): string;
/**
 * 莫尔斯电码转文本
 * @param morse - 莫尔斯电码字符串
 * @returns 解码文本
 */
export declare function morseDecode(morse: string): string;
/**
 * 获取莫尔斯电码映射表
 * @returns 莫尔斯电码映射对象
 */
export declare function getMorseTable(): MorseCodeMap;
