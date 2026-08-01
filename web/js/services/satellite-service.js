/**
 * HAM Radio Toolbox - 卫星跟踪服务层
 * 三API架构：WTIA免费API(仅ISS) / TLE本地计算(Celestrak+satellite.js) / N2YO高级API(需Key,多卫星+过境预测)
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
/** Celestrak TLE数据URL（业余无线电卫星组） */
const CELESTRAK_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle';
/** TLE缓存存储键 */
const TLE_CACHE_KEY = 'ham_tle_cache';
/** TLE内存缓存（避免频繁请求） */
let tleMemoryCache = null;
/** satellite.js 动态加载状态 */
let _satJsLoading = null;
const SAT_JS_URL = 'https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js';
/**
 * 动态加载 satellite.js 库
 * @returns Promise<void> 加载完成后 resolve，失败 reject
 */
export function loadSatelliteJs() {
    if (typeof satellite !== 'undefined')
        return Promise.resolve();
    if (_satJsLoading)
        return _satJsLoading;
    _satJsLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SAT_JS_URL;
        script.crossOrigin = 'anonymous';
        script.onload = () => { _satJsLoading = null; resolve(); };
        script.onerror = () => { _satJsLoading = null; reject(new Error('satellite.js 加载失败')); };
        document.head.appendChild(script);
    });
    return _satJsLoading;
}
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
    catch (_e) {
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
    catch (_e) {
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
        vel: wtiaData.velocity / 3600, // WTIA返回km/h，转换为km/s
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
 * 从Celestrak TLE数据获取所有业余卫星列表
 * @returns 按名称排序的卫星列表
 */
export async function getTleSatelliteList() {
    const tleData = await fetchTleData();
    if (!tleData || !tleData.tles)
        return [];
    return Object.entries(tleData.tles)
        .map(([noradId, tle]) => ({ name: tle.name, noradId: parseInt(noradId) }))
        .sort((a, b) => a.name.localeCompare(b.name));
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
// ============================================================
// TLE数据 + satellite.js本地轨道计算（自动选择SGP4/SDP4）
// ============================================================
/**
 * 从Celestrak获取业余无线电卫星TLE数据并缓存
 * 获取失败时回退到localStorage缓存
 * @param forceRefresh - 是否强制刷新（忽略内存缓存）
 * @returns TLE数据或null
 */
async function fetchTleData(forceRefresh = false) {
    // 使用内存缓存（非强制刷新且未过期时）
    if (!forceRefresh && tleMemoryCache && !isTleStale(tleMemoryCache.fetchTime)) {
        return tleMemoryCache;
    }
    // 尝试从Celestrak获取最新TLE
    try {
        const resp = await fetch(CELESTRAK_TLE_URL, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) {
            const text = await resp.text();
            const tles = parseTleText(text);
            if (Object.keys(tles).length > 0) {
                const result = { tles, fetchTime: Date.now(), fromCache: false };
                // 保存到localStorage
                try {
                    localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ tles, fetchTime: Date.now() }));
                }
                catch (_e) { /* 忽略存储错误 */ }
                tleMemoryCache = result;
                return result;
            }
        }
    }
    catch (e) {
        console.warn('[HAM] Celestrak TLE获取失败:', e.name === 'TimeoutError' || e.name === 'AbortError' ? '请求超时' : e.message);
    }
    // 回退到localStorage缓存
    const cached = getCachedTleData();
    if (cached) {
        const result = { ...cached, fromCache: true };
        tleMemoryCache = result;
        return result;
    }
    return null;
}
/**
 * 解析3行TLE格式文本
 * 格式: 名称行 + "1 "开头的line1 + "2 "开头的line2
 * @param text - Celestrak返回的TLE文本
 * @returns TLE集合 { noradId: { name, line1, line2 } }
 */
function parseTleText(text) {
    const tles = {};
    const lines = text.trim().split('\n');
    let lastName = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('1 ')) {
            const line1 = line;
            const line2 = (lines[i + 1] || '').trim();
            if (line2.startsWith('2 ')) {
                const noradId = parseInt(line1.substring(2, 7));
                tles[noradId] = { name: lastName, line1, line2 };
                i++; // 跳过line2
            }
        }
        else if (line && !line.startsWith('2 ')) {
            lastName = line;
        }
    }
    return tles;
}
/** TLE缓存有效期：24小时（毫秒） */
const TLE_CACHE_TTL = 24 * 60 * 60 * 1000;
/**
 * 判断TLE缓存是否过期
 * @param fetchTime - 缓存中的fetchTime时间戳
 * @returns true表示已过期
 */
function isTleStale(fetchTime) {
    return !fetchTime || (Date.now() - fetchTime) > TLE_CACHE_TTL;
}
/**
 * 从localStorage获取缓存的TLE数据
 * @returns 缓存的TLE数据或null（过期数据返回null）
 */
function getCachedTleData() {
    try {
        const data = localStorage.getItem(TLE_CACHE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed && parsed.tles && Object.keys(parsed.tles).length > 0) {
                // 检查TLE缓存是否过期（超过24小时）
                if (isTleStale(parsed.fetchTime)) {
                    console.warn('[HAM] TLE缓存已过期，将重新获取');
                    localStorage.removeItem(TLE_CACHE_KEY);
                    return null;
                }
                return parsed;
            }
        }
    }
    catch (_e) { /* 忽略解析错误 */ }
    return null;
}
/**
 * 获取指定卫星的TLE数据
 * 优先从Celestrak获取最新数据，失败时使用缓存
 * @param noradId - NORAD编号
 * @returns TLE信息或null
 */
export async function getTleForSatellite(noradId) {
    const tleData = await fetchTleData();
    if (tleData && tleData.tles[noradId]) {
        const tle = tleData.tles[noradId];
        return {
            ...tle,
            fetchTime: tleData.fetchTime,
            fromCache: tleData.fromCache,
            epoch: parseTleEpoch(tle.line1)
        };
    }
    // 内存缓存中未找到，尝试localStorage缓存
    const cached = getCachedTleData();
    if (cached && cached.tles[noradId]) {
        const tle = cached.tles[noradId];
        return {
            ...tle,
            fetchTime: cached.fetchTime,
            fromCache: true,
            epoch: parseTleEpoch(tle.line1)
        };
    }
    return null;
}
/**
 * 使用satellite.js库计算卫星位置（自动选择SGP4/SDP4算法）
 * 依赖satellite.js库（全局变量satellite）
 * @param line1 - TLE第1行
 * @param line2 - TLE第2行
 * @param date - 计算时刻
 * @returns 卫星位置或null
 */
export async function calcSgp4Position(line1, line2, date) {
    if (typeof satellite === 'undefined') {
        try {
            await loadSatelliteJs();
        } catch (_e) {
            console.warn('[HAM] satellite.js库加载失败，无法进行轨道计算');
            return null;
        }
    }
    try {
        const satrec = satellite.twoline2satrec(line1, line2);
        const posVel = satellite.propagate(satrec, date);
        if (!posVel || !posVel.position || posVel.position === false) {
            return null;
        }
        const gmst = satellite.gstime(date);
        const geo = satellite.eciToGeodetic(posVel.position, gmst);
        const vel = Math.sqrt(posVel.velocity.x ** 2 +
            posVel.velocity.y ** 2 +
            posVel.velocity.z ** 2);
        return {
            lat: satellite.radiansToDegrees(geo.latitude),
            lon: satellite.radiansToDegrees(geo.longitude),
            alt: geo.height,
            vel: vel,
            timestamp: date.getTime()
        };
    }
    catch (e) {
        console.warn('[HAM] 轨道计算失败:', e.message);
        return null;
    }
}
/**
 * 从TLE line1提取历元时间
 * TLE历元位于line1的第19-32列（0索引18-31）
 * @param line1 - TLE第1行
 * @returns 历元时间
 */
function parseTleEpoch(line1) {
    if (!line1 || line1.length < 32)
        return null;
    try {
        const epochYear = parseInt(line1.substring(18, 20));
        const epochDay = parseFloat(line1.substring(20, 32));
        const year = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
        const epochDate = new Date(Date.UTC(year, 0, 1));
        epochDate.setTime(epochDate.getTime() + (epochDay - 1) * 86400000);
        return epochDate;
    }
    catch (_e) {
        return null;
    }
}
/**
 * 格式化TLE数据年龄为可读字符串
 * @param epoch - TLE历元时间
 * @returns 如 "3天前"、"2小时前"
 */
export function formatTleAge(epoch) {
    if (!epoch)
        return '未知';
    const now = Date.now();
    const ageMs = now - epoch.getTime();
    const ageHours = Math.floor(ageMs / 3600000);
    if (ageHours < 1)
        return '不到1小时';
    if (ageHours < 24)
        return ageHours + '小时';
    const ageDays = Math.floor(ageHours / 24);
    if (ageDays === 1)
        return '1天';
    return ageDays + '天';
}
/**
 * 从ECI坐标直接计算观测角（WGS84椭球模型，避免球体模型误差）
 * 用于TLE过境预测等需要高精度的场景
 * @param posEci - satellite.js propagate返回的ECI位置 {x,y,z}
 * @param gmst - 格林尼治恒星时(弧度)
 * @param obsLat - 观测者纬度(度)
 * @param obsLon - 观测者经度(度)
 * @param obsAlt - 观测者海拔(km)
 * @returns 仰角、方位角、距离
 */
function calcLookAngleFromEci(posEci, gmst, obsLat, obsLon, obsAlt) {
    // WGS84椭球参数
    const a = 6378.137; // 半长轴(km)
    const f = 1 / 298.257223563; // 扁率
    const e2 = 2 * f - f * f; // 偏心率平方
    const latR = obsLat * Math.PI / 180;
    const lonR = obsLon * Math.PI / 180;
    const sinLat = Math.sin(latR);
    const cosLat = Math.cos(latR);
    // 卯酉圈曲率半径
    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    // 观测者ECEF坐标（WGS84椭球）
    const xObsEcef = (N + obsAlt) * cosLat * Math.cos(lonR);
    const yObsEcef = (N + obsAlt) * cosLat * Math.sin(lonR);
    const zObsEcef = (N * (1 - e2) + obsAlt) * sinLat;
    // ECEF→ECI旋转（绕Z轴旋转-gmst）
    const cosGmst = Math.cos(gmst);
    const sinGmst = Math.sin(gmst);
    const xObsEci = cosGmst * xObsEcef - sinGmst * yObsEcef;
    const yObsEci = sinGmst * xObsEcef + cosGmst * yObsEcef;
    const zObsEci = zObsEcef;
    // ECI坐标系下的距离向量
    const rx = posEci.x - xObsEci;
    const ry = posEci.y - yObsEci;
    const rz = posEci.z - zObsEci;
    // ECI→ECEF旋转（绕Z轴旋转gmst）
    const rxEcef = cosGmst * rx + sinGmst * ry;
    const ryEcef = -sinGmst * rx + cosGmst * ry;
    const rzEcef = rz;
    // ECEF→ENU变换
    const sinLon = Math.sin(lonR);
    const cosLon = Math.cos(lonR);
    const east = -sinLon * rxEcef + cosLon * ryEcef;
    const north = -sinLat * cosLon * rxEcef - sinLat * sinLon * ryEcef + cosLat * rzEcef;
    const up = cosLat * cosLon * rxEcef + cosLat * sinLon * ryEcef + sinLat * rzEcef;
    const range = Math.sqrt(east * east + north * north + up * up);
    const elevation = Math.asin(up / range) * 180 / Math.PI;
    let azimuth = Math.atan2(east, north) * 180 / Math.PI;
    azimuth = (azimuth + 360) % 360;
    return { elevation, azimuth, distance: range };
}
/**
 * TLE本地过境预测（使用satellite.js propagate + calcLookAngle）
 * 在指定时间段内以固定间隔采样卫星位置，计算仰角变化，
 * 找出仰角从正→峰值→正的区间作为一次过境
 * @param noradId - NORAD编号
 * @param obsLat - 观测者纬度（度）
 * @param obsLon - 观测者经度（度）
 * @param obsAlt - 观测者海拔（km）
 * @param durationHours - 预测时长（小时）
 * @param minElev - 最小仰角阈值（度）
 * @param stepSeconds - 采样间隔（秒）
 * @returns 过境数组
 */
export async function predictPassesLocal(noradId, obsLat, obsLon, obsAlt = 0, durationHours = 24, minElev = 10, stepSeconds = 30) {
    if (typeof satellite === 'undefined') {
        try {
            await loadSatelliteJs();
        } catch (_e) {
            console.warn('[HAM] satellite.js库加载失败，无法进行过境预测');
            return [];
        }
    }
    // 获取TLE数据
    const tle = await getTleForSatellite(noradId);
    if (!tle || !tle.line1 || !tle.line2) {
        console.warn('[HAM] 未找到NORAD', noradId, '的TLE数据');
        return [];
    }
    try {
        const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        const now = new Date();
        const endTime = new Date(now.getTime() + durationHours * 3600000);
        const stepMs = stepSeconds * 1000;
        const coarsePasses = [];
        let inPass = false;
        let passStart = null;
        let maxElev = -90;
        let maxElevTime = null;
        let maxElevAz = 0;
        let startAz = 0;
        let prevElev = -90;
        // 第一遍：粗搜索（30秒步长）检测过境区间
        for (let t = now.getTime(); t <= endTime.getTime(); t += stepMs) {
            const date = new Date(t);
            const posVel = satellite.propagate(satrec, date);
            if (!posVel || !posVel.position || posVel.position === false) {
                prevElev = -90;
                continue;
            }
            const gmst = satellite.gstime(date);
            const look = calcLookAngleFromEci(posVel.position, gmst, obsLat, obsLon, obsAlt);
            const elev = look.elevation;
            const az = look.azimuth;
            if (elev > 0 && !inPass) {
                inPass = true;
                passStart = date;
                maxElev = elev;
                maxElevTime = date;
                maxElevAz = az;
                startAz = az;
            }
            else if (elev > 0 && inPass) {
                if (elev > maxElev) {
                    maxElev = elev;
                    maxElevTime = date;
                    maxElevAz = az;
                }
            }
            else if (elev <= 0 && inPass) {
                inPass = false;
                if (maxElev >= minElev && passStart) {
                    coarsePasses.push({
                        start: passStart, end: date,
                        peak: maxElevTime, maxElev, azimuth: maxElevAz,
                        startAz, endAz: az
                    });
                }
                maxElev = -90;
                passStart = null;
            }
            prevElev = elev;
        }
        if (inPass && maxElev >= minElev && passStart) {
            coarsePasses.push({
                start: passStart, end: endTime,
                peak: maxElevTime, maxElev, azimuth: maxElevAz,
                startAz, endAz: prevElev > 0 ? 0 : 0
            });
        }
        // 第二遍：精细搜索（1秒步长）精确定位每次过境的起止和峰值
        const passes = [];
        const fineStepMs = 1000; // 1秒
        for (const coarse of coarsePasses) {
            // 扩展搜索范围：前后各加2分钟
            const searchStart = coarse.start.getTime() - 120000;
            const searchEnd = coarse.end.getTime() + 120000;
            let fineStart = null, fineEnd = null;
            let fineMaxElev = -90, finePeakTime = null, finePeakAz = 0;
            let fineStartAz = 0, fineEndAz = 0;
            let wasAbove = false;
            for (let t = searchStart; t <= searchEnd; t += fineStepMs) {
                const date = new Date(t);
                const posVel = satellite.propagate(satrec, date);
                if (!posVel || !posVel.position || posVel.position === false)
                    continue;
                const gmst = satellite.gstime(date);
                const look = calcLookAngleFromEci(posVel.position, gmst, obsLat, obsLon, obsAlt);
                const elev = look.elevation;
                const az = look.azimuth;
                if (elev > 0 && !wasAbove) {
                    // 上升沿：过境开始
                    fineStart = date;
                    fineStartAz = az;
                    wasAbove = true;
                }
                if (elev > 0 && wasAbove) {
                    if (elev > fineMaxElev) {
                        fineMaxElev = elev;
                        finePeakTime = date;
                        finePeakAz = az;
                    }
                }
                if (elev <= 0 && wasAbove) {
                    // 下降沿：过境结束
                    fineEnd = date;
                    fineEndAz = az;
                    wasAbove = false;
                    break; // 找到结束点即可停止
                }
            }
            // 仅记录达到最小仰角阈值的过境
            if (fineMaxElev >= minElev && fineStart && fineEnd && finePeakTime) {
                passes.push({
                    start: fineStart,
                    peak: finePeakTime,
                    end: fineEnd,
                    maxElev: fineMaxElev,
                    azimuth: finePeakAz,
                    startAz: fineStartAz,
                    endAz: fineEndAz
                });
            }
        }
        console.log('[HAM] TLE本地过境预测完成:', passes.length, '次过境');
        return passes;
    }
    catch (e) {
        console.warn('[HAM] TLE过境预测失败:', e.message);
        return [];
    }
}
// ============================================================
// 地面轨迹计算
// ============================================================
/**
 * 计算卫星地面轨迹（24小时轨道点）
 * 使用satellite.js SGP4/SDP4传播算法
 * @param {string} line1 - TLE第1行
 * @param {string} line2 - TLE第2行
 * @param {number} durationHours - 计算时长（小时），默认24
 * @param {number} stepMinutes - 步长（分钟），默认1
 * @returns {Array<{lat: number, lon: number, timestamp: number}>} 轨道点数组
 */
export function calcGroundTrack(line1, line2, durationHours = 24, stepMinutes = 1) {
    if (typeof satellite === 'undefined') {
        console.warn('[HAM] satellite.js未加载，无法计算地面轨迹');
        return [];
    }
    try {
        const satrec = satellite.twoline2satrec(line1, line2);
        const now = new Date();
        const stepMs = stepMinutes * 60000;
        const endTime = now.getTime() + durationHours * 3600000;
        const points = [];
        let prevLon = null;
        for (let t = now.getTime(); t <= endTime; t += stepMs) {
            const date = new Date(t);
            const posVel = satellite.propagate(satrec, date);
            if (!posVel || !posVel.position || posVel.position === false) {
                prevLon = null;
                continue;
            }
            const gmst = satellite.gstime(date);
            const geo = satellite.eciToGeodetic(posVel.position, gmst);
            const lat = satellite.radiansToDegrees(geo.latitude);
            const lon = satellite.radiansToDegrees(geo.longitude);
            // 检测经度跳变（跨±180°），标记为不连续点
            let discontinuity = false;
            if (prevLon !== null && Math.abs(lon - prevLon) > 90) {
                discontinuity = true;
            }
            points.push({ lat, lon, timestamp: t, discontinuity });
            prevLon = lon;
        }
        return points;
    }
    catch (e) {
        console.warn('[HAM] 地面轨迹计算失败:', e.message);
        return [];
    }
}