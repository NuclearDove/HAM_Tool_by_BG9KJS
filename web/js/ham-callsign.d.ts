/**
 * 查询呼号信息
 * 使用HamQTH公开API（无需API Key的基础查询）
 */
declare function callLookup(): Promise<void>;
/**
 * 清空查询
 */
declare function callClear(): void;
declare function init(): void;
export { init, callLookup, callClear };
