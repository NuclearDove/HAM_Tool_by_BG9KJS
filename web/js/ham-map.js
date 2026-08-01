/**
 * HAM Radio Toolbox - 通联地图 Tab 模块 (ES Module)
 * 依赖: Core, Log, MapLibre GL JS(可选，CDN延迟加载)
 * 使用MapLibre GL JS + 高德地图栅格瓦片（国内源，中文标注）
 * 高德地图使用GCJ-02坐标系，标记坐标需从WGS-84转换
 * @module ham-map
 */
'use strict';
import { CONFIG, parseQth, escHtml } from './core.js';
import { loadMapLibre, reloadMapLibre } from './shared-map.js?v=20260802';
let mapInstance = null;
/** 跟踪已添加的标记，用于清除 */
let markers = [];
/** 地图是否已初始化完成 */
let mapInitialized = false;
// ============================================================
// WGS-84 → GCJ-02 坐标转换（高德地图坐标系偏移校正）
// ============================================================
const PI = Math.PI;
const GCJ_A = 6378245.0;
const GCJ_EE = 0.006693421622965943;
/**
 * 判断坐标是否在中国境外（境外不做偏移）
 */
function outOfChina(lng, lat) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}
function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}
function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}
/**
 * WGS-84坐标转GCJ-02坐标（高德地图偏移校正）
 * @param lng WGS-84经度
 * @param lat WGS-84纬度
 * @returns GCJ-02坐标
 */
function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat))
        return { lng, lat };
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - GCJ_EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * PI);
    return { lng: lng + dLng, lat: lat + dLat };
}
/**
 * 渲染地图（MapLibre可用时）或坐标列表（降级方案）
 */
function mapRender() {
    const container = document.getElementById('map-container');
    if (!container)
        return;
    // 动态加载 MapLibre GL JS（按需加载，首屏不阻塞）
    if (typeof maplibregl === 'undefined') {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#666">正在加载地图库...</div>';
        loadMapLibre().then(() => mapRender()).catch(() => renderFallback(container));
        return;
    }
    // 初始化地图实例
    if (!mapInstance) {
        try {
            console.log('[HAM Map] Initializing with 高德地图 raster tiles');
            mapInstance = new maplibregl.Map({
                container: container,
                style: CONFIG.MAP_STYLE,
                center: [105, 35],
                zoom: 4
            });
            // 添加导航控件（缩放+旋转）
            mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
            // 添加比例尺控件
            mapInstance.addControl(new maplibregl.ScaleControl(), 'bottom-left');
            // 捕获地图异步错误
            mapInstance.on('error', (e) => {
                console.error('[HAM Map] Map async error:', e.error || e);
            });
            // 地图加载完成后的初始化
            mapInstance.on('load', () => {
                console.log('[HAM Map] Map loaded successfully (高德地图)');
                mapInitialized = true;
                // 确保容器尺寸正确（Tab从display:none切换时需要）
                try {
                    mapInstance.resize();
                }
                catch (_) { /* ignore */ }
            });
        }
        catch (e) {
            console.error('[HAM Map] MapLibre init failed:', e);
            mapInstance = null;
            renderFallback(container);
            return;
        }
    }
    // 清除旧标记
    markers.forEach(m => m.remove());
    markers = [];
    // 等待地图加载完成后添加标记
    const addMarkers = () => {
        // 动态导入Log模块获取数据
        import('./ham-log.js').then(({ loadQsos }) => {
            const qsos = loadQsos();
            const locs = [];
            qsos.forEach(q => {
                if (!q.qth)
                    return;
                const loc = parseQth(q.qth);
                if (!loc)
                    return;
                locs.push(loc);
                // WGS-84 → GCJ-02 坐标转换（高德地图坐标系）
                const gcj = wgs84ToGcj02(loc.lon, loc.lat);
                const marker = new maplibregl.Marker()
                    .setLngLat([gcj.lng, gcj.lat])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<b>' + q.call + '</b><br>' + q.date + ' ' + q.time + '<br>' +
                    q.freq + ' MHz ' + q.mode + '<br>QTH: ' + q.qth +
                    (loc.grid ? ' (' + loc.grid + ')' : '')))
                    .addTo(mapInstance);
                markers.push(marker);
            });
            const countEl = document.getElementById('mapCount');
            if (countEl)
                countEl.textContent = markers.length + ' 个标记';
            if (locs.length > 0) {
                // 计算边界（转换后的GCJ-02坐标）
                const gcjLocs = locs.map(l => wgs84ToGcj02(l.lon, l.lat));
                const minLng = Math.min(...gcjLocs.map(l => l.lng));
                const maxLng = Math.max(...gcjLocs.map(l => l.lng));
                const minLat = Math.min(...gcjLocs.map(l => l.lat));
                const maxLat = Math.max(...gcjLocs.map(l => l.lat));
                const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
                mapInstance.fitBounds(bounds, { padding: 30, maxZoom: 12 });
            }
            // 延迟resize确保容器布局稳定
            setTimeout(() => { try {
                mapInstance.resize();
            }
            catch (_) { /* ignore */ } }, 200);
        }).catch(err => {
            console.error('[HAM Map] Failed to load QSO data:', err);
        });
    };
    // 如果地图已加载完成，直接添加标记；否则等待加载
    try {
        if (mapInitialized && mapInstance.loaded()) {
            addMarkers();
        }
        else {
            mapInstance.on('load', addMarkers);
        }
    }
    catch (_) {
        // loaded()可能抛异常，回退到等待load事件
        mapInstance.on('load', addMarkers);
    }
}
/**
 * 降级方案：MapLibre不可用时显示坐标列表
 */
function renderFallback(container) {
    import('./ham-log.js').then(({ loadQsos }) => {
        const qsos = loadQsos();
        let html = '<div style="padding:12px;font-size:13px;color:#666;">';
        html += '<p style="margin-bottom:8px;color:#c62828;">⚠️ 地图库加载失败，显示坐标列表：</p>';
        html += '<button class="btn btn-primary" style="margin-bottom:10px" data-action="retryMapLoad">🔄 重试加载地图</button>';
        if (qsos.length === 0) {
            html += '<p>暂无通联记录</p>';
        }
        else {
            html += '<table class="data-table"><tr><th>呼号</th><th>QTH</th><th>纬度</th><th>经度</th><th>网格</th><th>日期</th><th>频率</th><th>模式</th></tr>';
            let count = 0;
            qsos.forEach(q => {
                if (!q.qth)
                    return;
                const loc = parseQth(q.qth);
                if (!loc)
                    return;
                count++;
                html += '<tr><td>' + escHtml(q.call || '') + '</td><td>' + escHtml(q.qth || '') + '</td>';
                html += '<td>' + loc.lat.toFixed(4) + '</td><td>' + loc.lon.toFixed(4) + '</td>';
                html += '<td>' + escHtml(loc.grid || '-') + '</td><td>' + escHtml(q.date || '') + '</td>';
                html += '<td>' + escHtml(String(q.freq) || '') + '</td><td>' + escHtml(q.mode || '') + '</td></tr>';
            });
            html += '</table>';
            const countEl = document.getElementById('mapCount');
            if (countEl)
                countEl.textContent = count + ' 个坐标';
        }
        html += '</div>';
        container.innerHTML = html;
    }).catch(err => {
        console.error('[HAM Map] Fallback render failed:', err);
        container.innerHTML = '<div style="padding:12px;color:#c62828;">⚠️ 地图和数据加载均失败</div>';
    });
}
/**
 * 重试加载地图：尝试重新加载MapLibre GL JS CDN脚本
 */
function retryMapLoad() {
    const container = document.getElementById('map-container');
    if (!container)
        return;
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#666">正在重新加载地图库...</div>';
    // 清除旧状态
    mapInstance = null;
    markers = [];
    mapInitialized = false;
    reloadMapLibre().then(() => mapRender()).catch(() => renderFallback(container));
}
function init() { }
export { mapRender, init, retryMapLoad };