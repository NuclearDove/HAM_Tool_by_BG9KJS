/**
 * 渲染地图（Leaflet可用时）或坐标列表（降级方案）
 */
declare function mapRender(): void;
/**
 * 重试加载地图：尝试重新加载Leaflet CDN脚本
 */
declare function retryMapLoad(): void;
declare function init(): void;
export { mapRender, init, retryMapLoad };
