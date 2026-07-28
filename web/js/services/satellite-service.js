/**
 * HAM Radio Toolbox - 卫星跟踪服务层
 * 双API架构：WTIA免费API(仅ISS) / N2YO高级API(需Key,多卫星+过境预测)
 * 用户自选数据源，无本地轨道计算（简化SGP4误差大，无实用价值）
 * WTIA API: https://api.wheretheiss.at/v1/satellites (免费,仅ISS)
 * N2YO API: https://www.n2yo.com/api/ (需Key,多卫星+过境预测)
 * @module services/satellite-service
 */
// ============================================================
// 常量
// ============================================================
/** 地球半径(km) - 用于仰角/方位角几何计算 */
const R_EARTH = 6371;
/** N2YO API基础URL */
const N2YO_BASE = 'https://api.n2yo.com/rest/v1/satellite';
/** WTIA API基础URL（无需API Key） */
const WTIA_BASE = 'https://api.wheretheiss.at/v1/satellites';
/** API Key存储键 */
const API_KEY_STORAGE = 'ham_n2yo_api_key';
/** API数据源存储键 */
const API_SOURCE_STORAGE = 'ham_sat_api_source';
// ============================================================
// API数据源管理
// ============================================================
/**
 * 获取当前API数据源
 * @returns 'wtia' | 'n2yo'
 */
export function getApiSource() {
    try {
        return localStorage.getItem(API_SOURCE_STORAGE) || 'wtia';
    }
    catch (e) {
        return 'wtia';
    }
}
/**
 * 设置API数据源
 * @param source - 'wtia' | 'n2yo'
 */
export function setApiSource(source) {
    try {
        localStorage.setItem(API_SOURCE_STORAGE, source || 'wtia');
    }
    catch (e) {
        console.warn('[HAM] Failed to save API source:', e);
    }
}
// ============================================================
// API Key管理
// ============================================================
/**
 * 获取N2YO API Key
 * @returns API Key
 */
export function getApiKey() {
    try {
        return localStorage.getItem(API_KEY_STORAGE) || '';
    }
    catch (e) {
        return '';
    }
}
/**
 * 设置N2YO API Key
 * @param key - API Key
 */
export function setApiKey(key) {
    try {
        localStorage.setItem(API_KEY_STORAGE, key || '');
    }
    catch (e) {
        console.warn('[HAM] Failed to save API key:', e);
    }
}
/**
 * 检查API Key是否已配置
 */
export function hasApiKey() {
    return !!getApiKey();
}
/**
 * 从N2YO获取卫星实时位置
 * @param noradId - NORAD编号
 * @param obsLat - 观测者纬度
 * @param obsLon - 观测者经度
 * @param obsAlt - 观测者高度(km)
 * @param seconds - 预测秒数(0=仅当前位置)
 * @returns N2YO位置数据
 */
export async function fetchSatPosition(noradId, obsLat, obsLon, obsAlt = 0, seconds = 0) {
    const apiKey = getApiKey();
    if (!apiKey)
        return null;
    try {
        const url = `${N2YO_BASE}/positions/${noradId}/${obsLat.toFixed(4)}/${obsLon.toFixed(4)}/${obsAlt.toFixed(0)}/${seconds}/?apiKey=${apiKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.warn('[HAM] N2YO positions API error:', resp.status);
            return null;
        }
        const data = await resp.json();
        if (data.error) {
            console.warn('[HAM] N2YO API error:', data.error);
            return null;
        }
        return data;
    }
    catch (e) {
        const msg = e.name === 'TimeoutError' || e.name === 'AbortError' ? '请求超时' : e.message;
        console.warn('[HAM] N2YO positions fetch failed:', msg);
        return { _error: msg };
    }
}
/**
 * 从N2YO获取卫星过境预测
 * @param noradId - NORAD编号
 * @param obsLat - 观测者纬度
 * @param obsLon - 观测者经度
 * @param obsAlt - 观测者高度(km)
 * @param days - 预测天数(1-10)
 * @param minElevation - 最低仰角(度)
 * @returns N2YO过境数据
 */
export async function fetchSatPasses(noradId, obsLat, obsLon, obsAlt = 0, days = 1, minElevation = 10) {
    const apiKey = getApiKey();
    if (!apiKey)
        return null;
    try {
        const url = `${N2YO_BASE}/passes/${noradId}/${obsLat.toFixed(4)}/${obsLon.toFixed(4)}/${obsAlt.toFixed(0)}/${days}/${minElevation}/?apiKey=${apiKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.warn('[HAM] N2YO passes API error:', resp.status);
            return null;
        }
        const data = await resp.json();
        if (data.error) {
            console.warn('[HAM] N2YO API error:', data.error);
            return null;
        }
        return data;
    }
    catch (e) {
        const msg = e.name === 'TimeoutError' || e.name === 'AbortError' ? '请求超时' : e.message;
        console.warn('[HAM] N2YO passes fetch failed:', msg);
        return { _error: msg };
    }
}
/**
 * 解析N2YO位置数据为标准格式
 * @param n2yoData - N2YO API返回数据
 * @returns N2YO位置数据或null
 */
export function parseN2yoPosition(n2yoData) {
    if (!n2yoData || !n2yoData.positions || !n2yoData.positions.length)
        return null;
    const p = n2yoData.positions[0];
    return {
        lat: p.satlatitude,
        lon: p.satlongitude,
        alt: p.sataltitude,
        vel: p.satvelocity,
        elevation: p.elevation,
        azimuth: p.azimuth,
        distance: p.dist,
        timestamp: p.timestamp
    };
}
/**
 * 解析N2YO过境数据为标准格式
 * @param n2yoData - N2YO API返回数据
 * @returns 过境信息数组
 */
export function parseN2yoPasses(n2yoData) {
    if (!n2yoData || !n2yoData.passes)
        return [];
    return n2yoData.passes.map(p => ({
        start: new Date(p.startUTC * 1000),
        peak: new Date(p.maxElUTC * 1000),
        end: new Date(p.endUTC * 1000),
        maxElev: p.maxEl,
        azimuth: p.maxElAz,
        startAz: p.startAz,
        endAz: p.endAz
    }));
}
/**
 * 从WTIA获取卫星实时位置（无需API Key）
 * 目前仅支持ISS(NORAD 25544)
 * @param noradId - NORAD编号
 * @returns WTIA位置数据
 */
export async function fetchWtiaPosition(noradId) {
    try {
        const url = `${WTIA_BASE}/${noradId}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.warn('[HAM] WTIA API error:', resp.status);
            return null;
        }
        const data = await resp.json();
        if (data.error) {
            console.warn('[HAM] WTIA API error:', data.error);
            return null;
        }
        return data;
    }
    catch (e) {
        const msg = e.name === 'TimeoutError' || e.name === 'AbortError' ? '请求超时' : e.message;
        console.warn('[HAM] WTIA fetch failed:', msg);
        return { _error: msg };
    }
}
/**
 * 解析WTIA位置数据为标准格式
 * WTIA不提供观测者相关数据(仰角/方位角/距离)，需calcLookAngle计算
 * @param wtiaData - WTIA API返回数据
 * @returns WTIA位置数据或null
 */
export function parseWtiaPosition(wtiaData) {
    if (!wtiaData || !wtiaData.latitude)
        return null;
    return {
        lat: wtiaData.latitude,
        lon: wtiaData.longitude,
        alt: wtiaData.altitude,
        vel: wtiaData.velocity,
        visibility: wtiaData.visibility || 'unknown',
        footprint: wtiaData.footprint || 0,
        timestamp: wtiaData.timestamp
    };
}
/**
 * 检查WTIA是否支持指定卫星
 * 目前WTIA仅支持ISS(25544)
 * @param noradId - NORAD编号
 */
export function isWtiaSupported(noradId) {
    return noradId === 25544;
}
// ============================================================
// 常用业余卫星列表（仅名称和NORAD编号，无硬编码TLE）
// ============================================================
/**
 * 获取常用业余卫星列表
 * @returns 卫星信息数组
 */
export function getPopularSatellites() {
    return [
        { name: 'ISS (ZARYA)', noradId: 25544 },
        { name: 'AO-91 (FOX-1B)', noradId: 43017 },
        { name: 'AO-92 (FOX-1D)', noradId: 43137 },
        { name: 'SO-50 (SAUDISAT-1C)', noradId: 27607 },
        { name: 'PO-101 (DIWATA-2B)', noradId: 43678 },
        { name: 'IO-86 (LAPAN-A2)', noradId: 40931 },
        { name: 'RS-44 (DZZ-1)', noradId: 44906 },
        { name: 'TEVEL-1', noradId: 50999 }
    ];
}
/**
 * 计算观测者到卫星的仰角和方位角
 * 纯几何计算，不涉及轨道模型，精度取决于卫星位置数据
 * @param satPos - 卫星位置 {lat, lon, alt} 或 {xEcef, yEcef, zEcef}
 * @param obsLat - 观测者纬度(度)
 * @param obsLon - 观测者经度(度)
 * @param obsAlt - 观测者高度(km)
 * @returns 仰角、方位角、距离
 */
export function calcLookAngle(satPos, obsLat, obsLon, obsAlt = 0) {
    const latR = obsLat * Math.PI / 180;
    const lonR = obsLon * Math.PI / 180;
    const rObs = R_EARTH + obsAlt;
    const xObs = rObs * Math.cos(latR) * Math.cos(lonR);
    const yObs = rObs * Math.cos(latR) * Math.sin(lonR);
    const zObs = rObs * Math.sin(latR);
    let xSat, ySat, zSat;
    if (satPos.xEcef !== undefined) {
        xSat = satPos.xEcef;
        ySat = satPos.yEcef;
        zSat = satPos.zEcef;
    }
    else {
        const rSat = R_EARTH + satPos.alt;
        const sLatR = satPos.lat * Math.PI / 180;
        const sLonR = satPos.lon * Math.PI / 180;
        xSat = rSat * Math.cos(sLatR) * Math.cos(sLonR);
        ySat = rSat * Math.cos(sLatR) * Math.sin(sLonR);
        zSat = rSat * Math.sin(sLatR);
    }
    const rx = xSat - xObs, ry = ySat - yObs, rz = zSat - zObs;
    const sinLat = Math.sin(latR), cosLat = Math.cos(latR);
    const sinLon = Math.sin(lonR), cosLon = Math.cos(lonR);
    const east = -sinLon * rx + cosLon * ry;
    const north = -sinLat * cosLon * rx - sinLat * sinLon * ry + cosLat * rz;
    const up = cosLat * cosLon * rx + cosLat * sinLon * ry + sinLat * rz;
    const range = Math.sqrt(east * east + north * north + up * up);
    const elevation = Math.asin(up / range) * 180 / Math.PI;
    let azimuth = Math.atan2(east, north) * 180 / Math.PI;
    azimuth = (azimuth + 360) % 360;
    return { elevation, azimuth, distance: range };
}
//# sourceMappingURL=satellite-service.js.map