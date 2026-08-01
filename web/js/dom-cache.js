/**
 * HAM Radio Toolbox - DOM选择器缓存模块
 * 缓存频繁访问的DOM元素，减少重复querySelector/getElementById调用
 * @module dom-cache
 */
/** DOM元素缓存 Map: id → Element */
const _cache = new Map();
/** 缓存统计 */
let _hits = 0;
let _misses = 0;
/**
 * 通过ID获取DOM元素（带缓存）
 * 首次访问后缓存元素引用，后续直接返回缓存
 * @param id - 元素ID（不含#）
 * @returns DOM元素或null
 */
function $(id) {
    if (_cache.has(id)) {
        _hits++;
        return _cache.get(id);
    }
    _misses++;
    const el = document.getElementById(id);
    if (el)
        _cache.set(id, el);
    return el;
}
/**
 * 通过选择器获取DOM元素（带缓存）
 * 缓存键为选择器字符串
 * @param selector - CSS选择器
 * @returns DOM元素或null
 */
function $s(selector) {
    if (_cache.has(selector)) {
        _hits++;
        return _cache.get(selector);
    }
    _misses++;
    const el = document.querySelector(selector);
    if (el)
        _cache.set(selector, el);
    return el;
}
/**
 * 使指定ID的缓存失效
 * @param id - 要失效的元素ID
 */
function invalidate(id) {
    _cache.delete(id);
}
/**
 * 清空全部缓存
 * 在Tab切换或DOM重建后调用
 */
function clear() {
    _cache.clear();
    _hits = 0;
    _misses = 0;
}
/**
 * 获取缓存统计信息
 * @returns 缓存统计
 */
function stats() {
    return { size: _cache.size, hits: _hits, misses: _misses };
}
export { $, $s, invalidate, clear, stats };