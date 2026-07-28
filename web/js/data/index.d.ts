/**
 * HAM Radio Toolbox - 静态数据加载器
 * 从JSON文件异步加载所有静态数据，实现数据与代码分离
 * @module data
 */
import type { StaticData } from '../types.js';
/**
 * 加载所有静态数据
 * 并行加载所有JSON文件，加载完成后设置_loaded标志
 */
declare function loadAll(): Promise<void>;
/**
 * 获取已加载的数据
 * @param key - 数据键名
 * @returns 对应的静态数据
 */
declare function get<K extends keyof StaticData>(key: K): StaticData[K];
/** 数据是否已加载完成 */
declare function isLoaded(): boolean;
export { loadAll, get, isLoaded };
