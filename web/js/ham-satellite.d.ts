/**
 * 初始化卫星跟踪模块
 */
export declare function init(): void;
/**
 * 切换API数据源
 */
export declare function switchApiSource(): void;
/**
 * 选择卫星
 */
export declare function selectSatellite(): void;
/**
 * 保存API Key
 */
export declare function saveApiKey(): void;
/**
 * 预测过境
 */
export declare function predictPasses(): Promise<void>;
/**
 * 清空卫星数据
 */
export declare function clearSatellite(): void;
