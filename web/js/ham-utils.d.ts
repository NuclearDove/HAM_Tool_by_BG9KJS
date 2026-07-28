/**
 * 更新时钟显示
 * 优化：仅在时钟列表变化时重建DOM，每秒仅更新时间/日期文本
 */
declare function updateClocks(): void;
declare function filterClockOptions(): void;
declare function hideClockOptions(): void;
declare function selectClock(name: string, tz: string): void;
declare function addCustomClock(): void;
declare function removeClock(idx: number): void;
declare function clearCustomClocks(): void;
declare function propFetch(): void;
declare function rstQuery(): void;
declare function init(): void;
declare function destroy(): void;
export { updateClocks, filterClockOptions, hideClockOptions, selectClock, addCustomClock, removeClock, clearCustomClocks, propFetch, rstQuery, init, destroy };
