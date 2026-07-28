/**
 * 刷新太阳数据
 */
declare function solarRefresh(): Promise<void>;
/**
 * 清除太阳数据缓存
 */
declare function solarClearCache(): void;
declare function init(): void;
export { init, solarRefresh, solarClearCache };
