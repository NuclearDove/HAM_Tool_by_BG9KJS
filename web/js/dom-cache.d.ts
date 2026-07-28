/**
 * HAM Radio Toolbox - DOM选择器缓存模块
 * 缓存频繁访问的DOM元素，减少重复querySelector/getElementById调用
 * @module dom-cache
 */
import type { CacheStats } from './types.js';
/**
 * 通过ID获取DOM元素（带缓存）
 * 首次访问后缓存元素引用，后续直接返回缓存
 * @param id - 元素ID（不含#）
 * @returns DOM元素或null
 */
declare function $(id: string): HTMLElement | null;
/**
 * 通过选择器获取DOM元素（带缓存）
 * 缓存键为选择器字符串
 * @param selector - CSS选择器
 * @returns DOM元素或null
 */
declare function $s(selector: string): HTMLElement | null;
/**
 * 使指定ID的缓存失效
 * @param id - 要失效的元素ID
 */
declare function invalidate(id: string): void;
/**
 * 清空全部缓存
 * 在Tab切换或DOM重建后调用
 */
declare function clear(): void;
/**
 * 获取缓存统计信息
 * @returns 缓存统计
 */
declare function stats(): CacheStats;
export { $, $s, invalidate, clear, stats };
