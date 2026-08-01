/**
 * HAM Radio Toolbox - 共享地图模块 (ES Module)
 * 统一管理 MapLibre GL JS 地图实例，供灰线地图、卫星地面轨迹等复用
 * 复用通联地图方案：MapLibre GL JS + 高德地图栅格瓦片（国内源，中文标注）
 * @module shared-map
 */
'use strict';
import { CONFIG } from './core.js?v=20260730';
// ============================================================
// MapLibre GL JS 动态加载（与 ham-map.js 共用同一加载逻辑）
// ============================================================
/** MapLibre GL JS 动态加载状态 */
let _mapLibreLoading = null;
const MAPLIBRE_JS_URL = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS_URL = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
/**
 * 动态加载 MapLibre GL JS 库（CSS + JS）
 * 如果已加载则立即返回，否则加载后返回Promise
 * @returns Promise<void>
 */
export function loadMapLibre() {
    if (typeof maplibregl !== 'undefined')
        return Promise.resolve();
    if (_mapLibreLoading)
        return _mapLibreLoading;
    _mapLibreLoading = new Promise((resolve, reject) => {
        // 加载CSS
        if (!document.querySelector('link[href*="maplibre-gl"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = MAPLIBRE_CSS_URL;
            css.crossOrigin = 'anonymous';
            document.head.appendChild(css);
        }
        // 加载JS
        const script = document.createElement('script');
        script.src = MAPLIBRE_JS_URL;
        script.crossOrigin = 'anonymous';
        script.onload = () => { _mapLibreLoading = null; resolve(); };
        script.onerror = () => { _mapLibreLoading = null; reject(new Error('MapLibre GL JS 加载失败')); };
        document.head.appendChild(script);
    });
    return _mapLibreLoading;
}
/**
 * 重新加载 MapLibre GL JS（清除旧状态后重新加载）
 * 用于地图库加载失败后的重试场景
 * @returns Promise<void>
 */
export function reloadMapLibre() {
    // 清除全局对象
    if (typeof maplibregl !== 'undefined')
        delete window.maplibregl;
    // 移除旧脚本标签
    const oldScript = document.querySelector('script[src*="maplibre"]');
    if (oldScript)
        oldScript.remove();
    // 重置加载状态
    _mapLibreLoading = null;
    return loadMapLibre();
}
// ============================================================
// 地图实例管理
// ============================================================
/** 已创建的地图实例 { id: maplibregl.Map } */
const _maps = {};
/** 各地图的加载状态 { id: boolean } */
const _mapReady = {};
/** 各地图的图层ID计数器 { id: number } */
const _layerIdCount = {};
/**
 * 获取或创建 MapLibre GL JS 地图实例
 * @param {string} mapId - 地图唯一标识（对应容器DOM id）
 * @param {object} [options] - 地图选项
 * @param {number[]} [options.center=[0,0]] - 初始中心点 [lng, lat]
 * @param {number} [options.zoom=2] - 初始缩放级别
 * @param {number} [options.minZoom=1] - 最小缩放
 * @param {number} [options.maxZoom=18] - 最大缩放
 * @param {object} [options.style] - MapLibre样式对象，默认CONFIG.MAP_STYLE
 * @returns Promise<maplibregl.Map|null> 地图实例（加载完成后可用）
 */
export async function getMap(mapId, options = {}) {
    // 如果已有实例且已初始化，直接返回
    if (_maps[mapId] && _mapReady[mapId]) {
        return _maps[mapId];
    }
    const container = document.getElementById(mapId);
    if (!container) {
        console.error('[SharedMap] Container not found:', mapId);
        return null;
    }
    // 确保 MapLibre GL JS 已加载
    try {
        await loadMapLibre();
    }
    catch (e) {
        console.error('[SharedMap] MapLibre load failed:', e);
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#c62828">⚠️ 地图库加载失败</div>';
        return null;
    }
    // 如果其他调用已创建实例，返回它
    if (_maps[mapId]) {
        return _maps[mapId];
    }
    const {
        center = [0, 0],
        zoom = 2,
        minZoom = 1,
        maxZoom = 18,
        style = CONFIG.MAP_STYLE
    } = options;
    // 创建地图实例
    const map = new maplibregl.Map({
        container: container,
        style: style,
        center: center,
        zoom: zoom,
        minZoom: minZoom,
        maxZoom: maxZoom
    });
    // 添加导航控件
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    // 捕获错误
    map.on('error', (e) => {
        console.error('[SharedMap] Map error:', e.error || e);
    });
    // 等待地图加载完成
    return new Promise((resolve) => {
        map.on('load', () => {
            _mapReady[mapId] = true;
            _layerIdCount[mapId] = 0;
            // 确保容器尺寸正确
            try { map.resize(); } catch (_) { /* ignore */ }
            resolve(map);
        });
        _maps[mapId] = map;
    });
}
/**
 * 检查地图是否已创建且就绪
 * @param {string} mapId - 地图标识
 * @returns {boolean}
 */
export function hasMap(mapId) {
    return !!_mapReady[mapId];
}
/**
 * 刷新地图尺寸（Tab切换后调用）
 * @param {string} mapId - 地图标识
 * @param {number} [delay=200] - 延迟毫秒数
 */
export function invalidateSize(mapId, delay = 200) {
    const map = _maps[mapId];
    if (map) {
        setTimeout(() => { try { map.resize(); } catch (_) { /* ignore */ } }, delay);
    }
}
/**
 * 销毁地图实例
 * @param {string} mapId - 地图标识
 */
export function destroyMap(mapId) {
    const map = _maps[mapId];
    if (map) {
        map.remove();
        delete _maps[mapId];
        delete _mapReady[mapId];
        delete _layerIdCount[mapId];
    }
}
// ============================================================
// 图层管理（MapLibre GL JS 使用 source + layer 模式）
// ============================================================
/**
 * 生成唯一图层ID
 * @param {string} mapId - 地图标识
 * @param {string} prefix - ID前缀
 * @returns {string}
 */
function _nextLayerId(mapId, prefix) {
    if (!_layerIdCount[mapId])
        _layerIdCount[mapId] = 0;
    return prefix + '-' + (++_layerIdCount[mapId]);
}
/**
 * 添加折线图层（用于轨迹线、晨昏线等）
 * @param {string} mapId - 地图标识
 * @param {Array} coords - 坐标数组 [[lng,lat], ...]
 * @param {object} [options] - 样式选项
 * @param {string} [options.color='#ff6b35'] - 线颜色
 * @param {number} [options.width=2] - 线宽
 * @param {number} [options.opacity=0.9] - 透明度
 * @param {string} [options.idPrefix='line'] - 图层ID前缀
 * @returns {string|null} 图层ID，失败返回null
 */
export function addPolyline(mapId, coords, options = {}) {
    const map = _maps[mapId];
    if (!map || !_mapReady[mapId])
        return null;
    const {
        color = '#ff6b35',
        width = 2,
        opacity = 0.9,
        idPrefix = 'line'
    } = options;
    const id = _nextLayerId(mapId, idPrefix);
    const sourceId = id + '-src';
    map.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords }
        }
    });
    map.addLayer({
        id: id,
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': color,
            'line-width': width,
            'line-opacity': opacity
        }
    });
    return id;
}
/**
 * 添加多段折线图层（处理不连续轨迹）
 * @param {string} mapId - 地图标识
 * @param {Array} segments - 段落数组，每个段落是 [[lng,lat], ...]
 * @param {object} [options] - 样式选项（同addPolyline）
 * @returns {string[]} 图层ID数组
 */
export function addMultiPolyline(mapId, segments, options = {}) {
    const ids = [];
    for (const seg of segments) {
        if (seg.length >= 2) {
            const id = addPolyline(mapId, seg, options);
            if (id)
                ids.push(id);
        }
    }
    return ids;
}
/**
 * 添加填充多边形图层（用于白天区域、灰线带等）
 * @param {string} mapId - 地图标识
 * @param {Array} coords - 坐标数组 [[lng,lat], ...]
 * @param {object} [options] - 样式选项
 * @param {string} [options.fillColor='#FFD700'] - 填充颜色
 * @param {number} [options.fillOpacity=0.15] - 填充透明度
 * @param {string} [options.borderColor='transparent'] - 边框颜色
 * @param {number} [options.borderWidth=0] - 边框宽度
 * @param {string} [options.idPrefix='fill'] - 图层ID前缀
 * @returns {string|null} 图层ID
 */
export function addPolygon(mapId, coords, options = {}) {
    const map = _maps[mapId];
    if (!map || !_mapReady[mapId])
        return null;
    const {
        fillColor = '#FFD700',
        fillOpacity = 0.15,
        borderColor = 'transparent',
        borderWidth = 0,
        idPrefix = 'fill'
    } = options;
    const id = _nextLayerId(mapId, idPrefix);
    const sourceId = id + '-src';
    map.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] }
        }
    });
    map.addLayer({
        id: id,
        type: 'fill',
        source: sourceId,
        paint: {
            'fill-color': fillColor,
            'fill-opacity': fillOpacity
        }
    });
    // 可选边框
    if (borderWidth > 0 && borderColor !== 'transparent') {
        map.addLayer({
            id: id + '-border',
            type: 'line',
            source: sourceId,
            paint: {
                'line-color': borderColor,
                'line-width': borderWidth,
                'line-opacity': 1
            }
        });
    }
    return id;
}
/**
 * 添加圆点标记图层（用于卫星位置、太阳直射点等）
 * @param {string} mapId - 地图标识
 * @param {number[]} coord - 坐标 [lng, lat]
 * @param {object} [options] - 样式选项
 * @param {string} [options.color='#e74c3c'] - 颜色
 * @param {number} [options.radius=6] - 半径（像素）
 * @param {number} [options.opacity=0.9] - 透明度
 * @param {string} [options.idPrefix='circle'] - 图层ID前缀
 * @returns {string|null} 图层ID
 */
export function addCircleMarker(mapId, coord, options = {}) {
    const map = _maps[mapId];
    if (!map || !_mapReady[mapId])
        return null;
    const {
        color = '#e74c3c',
        radius = 6,
        opacity = 0.9,
        idPrefix = 'circle'
    } = options;
    const id = _nextLayerId(mapId, idPrefix);
    const sourceId = id + '-src';
    map.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coord }
        }
    });
    map.addLayer({
        id: id,
        type: 'circle',
        source: sourceId,
        paint: {
            'circle-radius': radius,
            'circle-color': color,
            'circle-opacity': opacity,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
        }
    });
    return id;
}
/**
 * 添加Popup提示
 * @param {string} mapId - 地图标识
 * @param {number[]} coord - 坐标 [lng, lat]
 * @param {string} html - HTML内容
 * @param {object} [options] - Popup选项
 * @returns {maplibregl.Popup|null}
 */
export function addPopup(mapId, coord, html, options = {}) {
    const map = _maps[mapId];
    if (!map)
        return null;
    const popup = new maplibregl.Popup({ offset: 10, ...options })
        .setLngLat(coord)
        .setHTML(html)
        .addTo(map);
    return popup;
}
/**
 * 清除地图上的所有自定义图层和源
 * @param {string} mapId - 地图标识
 */
export function clearLayers(mapId) {
    const map = _maps[mapId];
    if (!map || !_mapReady[mapId])
        return;
    const style = map.getStyle();
    if (!style || !style.layers)
        return;
    // 收集所有自定义图层（以line-、fill-、circle-开头的）
    const layersToRemove = style.layers
        .filter(l => {
            const id = l.id;
            return id.match(/^(line-|fill-|circle-)\d+/) ||
                   id.match(/^(line-|fill-|circle-)\d+-border$/);
        })
        .map(l => l.id);
    // 收集对应的源
    const sourcesToRemove = layersToRemove.map(id => id.replace(/-border$/, '') + '-src');
    // 移除图层
    for (const layerId of layersToRemove) {
        try { map.removeLayer(layerId); } catch (_) { /* ignore */ }
    }
    // 移除源
    for (const sourceId of sourcesToRemove) {
        try { map.removeSource(sourceId); } catch (_) { /* ignore */ }
    }
    // 重置计数器
    _layerIdCount[mapId] = 0;
}