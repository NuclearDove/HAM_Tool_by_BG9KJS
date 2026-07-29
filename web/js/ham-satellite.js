/**
 * HAM Radio Toolbox - 卫星跟踪UI模块
 * 三API自选架构：WTIA免费API(仅ISS) / TLE本地计算(Celestrak+satellite.js) / N2YO高级API(需Key)
 * @module ham-satellite
 */
'use strict';
import * as SatService from './services/satellite-service.js?v=20260730';
import * as GeoService from './services/geo-service.js';
import { showToast } from './ham-toast.js';
import { latLonToGrid } from './core.js';
const $ = (id) => document.getElementById(id);
let initialized = false;
let currentSat = null;
let updateInterval = null;
let satList = [];
let lastObsGrid = '';
// ============================================================
// 初始化
// ============================================================
/**
 * 初始化卫星跟踪模块
 */
export function init() {
    if (initialized)
        return;
    loadApiKey();
    loadApiSource();
    updateSatellitePanel();
    setupSearchListener();
    initialized = true;
}
/**
 * 设置搜索输入监听
 */
function setupSearchListener() {
    const searchInput = $('satSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterSatellites(searchInput.value.trim());
        });
        // 聚焦时展开列表
        searchInput.addEventListener('focus', () => {
            const listEl = $('satList');
            if (listEl)
                listEl.style.display = '';
        });
    }
}
/**
 * 根据当前数据源更新卫星选择面板
 */
async function updateSatellitePanel() {
    const source = SatService.getApiSource();
    const listEl = $('satList');
    const panelEl = $('satSelectRow');
    const apiKeyRow = $('satApiKeyRow');
    // 显示/隐藏N2YO Key行
    if (apiKeyRow)
        apiKeyRow.style.display = source === 'n2yo' ? '' : 'none';
    // 清除当前选择
    currentSat = null;
    stopTracking();
    const selectedEl = $('satSelected');
    if (selectedEl)
        selectedEl.textContent = '未选择卫星';
    const searchInput = $('satSearch');
    if (searchInput)
        searchInput.value = '';
    if (source === 'wtia') {
        // WTIA: 仅支持ISS，隐藏选择面板，自动选中ISS
        if (panelEl)
            panelEl.style.display = 'none';
        currentSat = { name: 'ISS (ZARYA)', noradId: 25544 };
        if (selectedEl)
            selectedEl.innerHTML = '<span style="color:#1a237e;font-weight:bold">ISS (ZARYA)</span> <span style="color:#888">(NORAD: 25544)</span>';
        showToast('WTIA模式：自动跟踪ISS', 'info');
        updatePosition();
        startTracking();
    } else {
        // TLE/N2YO: 显示选择面板，清空位置数据，提示选择卫星
        if (panelEl)
            panelEl.style.display = '';
        // 清空位置和过境数据
        const posEl = $('satPosition');
        if (posEl)
            posEl.innerHTML = '<p style="color:#888">请从列表中选择卫星。</p>';
        const passEl = $('satPasses');
        if (passEl)
            passEl.innerHTML = '<p style="color:#888">选择卫星后点击"预测过境"查看未来24小时可见过境。</p>';
        const sourceLabel = source === 'tle' ? 'TLE本地计算' : 'N2YO高级API';
        showToast(`已切换至${sourceLabel}，请选择卫星`, 'info');
        if (source === 'tle') {
            // TLE: 从Celestrak获取业余卫星列表
            if (listEl)
                listEl.innerHTML = '<div style="color:#888;padding:8px;font-size:12px">正在从Celestrak获取卫星列表...</div>';
            try {
                satList = await SatService.getTleSatelliteList();
                if (satList.length === 0) {
                    if (listEl)
                        listEl.innerHTML = '<div style="color:#e74c3c;padding:8px;font-size:12px">无法获取卫星列表，请检查网络连接后重试</div>';
                    return;
                }
                renderSatList(satList);
            } catch (e) {
                if (listEl)
                    listEl.innerHTML = '<div style="color:#e74c3c;padding:8px;font-size:12px">获取卫星列表失败: ' + e.message + '</div>';
                return;
            }
        } else {
            // N2YO: 常用卫星列表
            satList = SatService.getPopularSatellites();
            renderSatList(satList);
        }
    }
}
/**
 * 渲染卫星列表到面板
 */
function renderSatList(sats) {
    const listEl = $('satList');
    if (!listEl)
        return;
    if (sats.length === 0) {
        listEl.innerHTML = '<div style="color:#888;padding:8px;font-size:12px">无匹配卫星</div>';
        return;
    }
    listEl.innerHTML = sats.map(sat =>
        `<div class="sat-item" data-norad="${sat.noradId}" data-name="${sat.name}" ` +
        `style="padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;` +
        `display:flex;justify-content:space-between;align-items:center" ` +
        `onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background=''">` +
        `<span>${sat.name}</span><span style="color:#888;font-size:11px">${sat.noradId}</span></div>`
    ).join('');
    // 点击选择卫星
    listEl.querySelectorAll('.sat-item').forEach(item => {
        item.addEventListener('click', () => {
            const noradId = parseInt(item.dataset.norad);
            const name = item.dataset.name;
            selectSatelliteFromPanel(name, noradId);
        });
    });
}
/**
 * 搜索筛选卫星
 */
function filterSatellites(query) {
    if (!query) {
        renderSatList(satList);
        return;
    }
    const q = query.toLowerCase();
    const filtered = satList.filter(sat =>
        sat.name.toLowerCase().includes(q) ||
        String(sat.noradId).includes(q)
    );
    renderSatList(filtered);
}
/**
 * 从面板选择卫星
 */
function selectSatelliteFromPanel(name, noradId) {
    currentSat = { name, noradId };
    // 更新选中显示
    const selectedEl = $('satSelected');
    if (selectedEl)
        selectedEl.innerHTML = `<span style="color:#1a237e;font-weight:bold">${name}</span> <span style="color:#888">(NORAD: ${noradId})</span>`;
    // 收起卫星列表
    const listEl = $('satList');
    if (listEl)
        listEl.style.display = 'none';
    // 清空搜索框
    const searchInput = $('satSearch');
    if (searchInput)
        searchInput.value = '';
    // 检查数据源兼容性
    const source = SatService.getApiSource();
    if (source === 'wtia' && !SatService.isWtiaSupported(noradId)) {
        showToast('WTIA仅支持ISS，请切换到N2YO或TLE数据源', 'warning');
    }
    const modeLabel = source === 'wtia' ? 'WTIA免费API' : source === 'tle' ? 'TLE本地计算' : 'N2YO高级API';
    showToast(`已选择: ${name} (${modeLabel})`, 'info');
    updatePosition();
    startTracking();
}
/**
 * 加载已保存的API Key
 */
function loadApiKey() {
    const input = $('satApiKey');
    if (input)
        input.value = SatService.getApiKey();
}
/**
 * 加载已保存的API数据源选择
 */
function loadApiSource() {
    const sel = $('satApiSource');
    if (!sel)
        return;
    sel.value = SatService.getApiSource();
    updateApiSourceHint();
}
/**
 * 更新API数据源提示
 */
function updateApiSourceHint() {
    const hint = $('satApiHint');
    if (!hint)
        return;
    const source = SatService.getApiSource();
    if (source === 'wtia') {
        hint.textContent = 'WTIA免费API仅支持ISS，其他卫星请选择N2YO';
        hint.style.color = '#2196F3';
    } else if (source === 'tle') {
        hint.textContent = 'TLE本地计算：使用Celestrak TLE+satellite.js，无需API Key';
        hint.style.color = '#27ae60';
    } else {
        if (SatService.hasApiKey()) {
            hint.textContent = 'N2YO高级API已配置，支持所有卫星+过境预测';
            hint.style.color = '#27ae60';
        } else {
            hint.textContent = '请先配置N2YO API Key';
            hint.style.color = '#e74c3c';
        }
    }
}
// ============================================================
// 用户交互
// ============================================================
/**
 * 切换API数据源
 */
export function switchApiSource() {
    const sel = $('satApiSource');
    if (!sel)
        return;
    const source = sel.value;
    SatService.setApiSource(source);
    updateApiSourceHint();
    // 根据数据源更新卫星选择面板
    updateSatellitePanel();
}
/**
 * 保存API Key
 */
export function saveApiKey() {
    const input = $('satApiKey');
    if (!input)
        return;
    const key = input.value.trim();
    SatService.setApiKey(key);
    // 如果选择了N2YO但没Key，提示
    if (SatService.getApiSource() === 'n2yo' && !key) {
        showToast('N2YO需要API Key，请前往 https://www.n2yo.com/api/ 免费注册', 'warning');
    }
    else {
        showToast(key ? 'API Key已保存' : 'API Key已清除', 'info');
    }
    updateApiSourceHint();
    // 如果当前有选中的卫星，重新更新位置
    if (currentSat) {
        updatePosition();
    }
}
/**
 * 开始实时跟踪
 */
function startTracking() {
    stopTracking();
    updateInterval = setInterval(updatePosition, 5000);
}
/**
 * 停止实时跟踪
 */
function stopTracking() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}
// ============================================================
// 位置更新（根据用户选择的API数据源）
// ============================================================
/**
 * 更新卫星位置显示
 */
export async function updatePosition() {
    if (!currentSat)
        return;
    const el = $('satPosition');
    if (!el)
        return;
    const source = SatService.getApiSource();
    // 获取观测者位置
    const obsGrid = $('satObsGrid')?.value?.trim() || '';
    let obsLat = 39.9, obsLon = 116.4;
    if (obsGrid) {
        const coord = GeoService.gridToLatLon(obsGrid);
        if (!coord) {
            el.innerHTML = '<p style="color:#e74c3c">网格坐标格式错误，请输入有效的Maidenhead坐标（如 OM89）</p>';
            return;
        }
        obsLat = coord.lat;
        obsLon = coord.lon;
    }
    // 观测者网格变化时强制完整重渲染（更新观测者标签）
    if (obsGrid !== lastObsGrid) {
        const satInfo = el.querySelector('.sat-info');
        if (satInfo)
            satInfo.remove();
        lastObsGrid = obsGrid;
    }
    // WTIA免费API
    if (source === 'wtia') {
        if (!SatService.isWtiaSupported(currentSat.noradId)) {
            el.innerHTML = '<p style="color:#e74c3c">WTIA仅支持ISS，请切换到N2YO或TLE数据源跟踪此卫星</p>';
            return;
        }
        try {
            const wtiaData = await SatService.fetchWtiaPosition(currentSat.noradId);
            if (wtiaData && wtiaData._error) {
                const errMsg = wtiaData._error === '请求超时' ? 'WTIA API请求超时，请稍后重试' : 'WTIA API请求失败，请检查网络连接';
                el.innerHTML = '<p style="color:#e74c3c">' + errMsg + '</p>';
                showToast(errMsg, 'error');
                return;
            }
            if (wtiaData) {
                const pos = SatService.parseWtiaPosition(wtiaData);
                if (pos) {
                    const look = SatService.calcLookAngle(pos, obsLat, obsLon);
                    renderWtiaPosition(el, pos, look, obsGrid);
                    return;
                }
            }
        }
        catch (e) {
            console.warn('[HAM] WTIA API failed:', e.message);
        }
        el.innerHTML = '<p style="color:#e74c3c">WTIA API请求失败，请检查网络连接</p>';
        showToast('WTIA API请求失败，请检查网络连接', 'error');
        return;
    }
    // TLE本地计算（satellite.js自动选择SGP4/SDP4）
    if (source === 'tle') {
        // 检查satellite.js库是否加载
        if (typeof satellite === 'undefined') {
            el.innerHTML = '<p style="color:#e74c3c">satellite.js库未加载，无法使用TLE本地计算。请检查网络连接后刷新页面。</p>';
            showToast('satellite.js库未加载', 'error');
            return;
        }
        try {
            const tle = await SatService.getTleForSatellite(currentSat.noradId);
            if (!tle) {
                el.innerHTML = '<p style="color:#e74c3c">无法获取 ' + currentSat.name + ' 的TLE数据，请检查网络连接或稍后重试</p>';
                showToast('无法获取TLE数据', 'error');
                return;
            }
            const now = new Date();
            const pos = SatService.calcSgp4Position(tle.line1, tle.line2, now);
            if (!pos) {
                el.innerHTML = '<p style="color:#e74c3c">SGP4轨道计算失败，TLE数据可能已过期</p>';
                showToast('SGP4计算失败', 'error');
                return;
            }
            const look = SatService.calcLookAngle(pos, obsLat, obsLon);
            renderTlePosition(el, pos, look, obsGrid, tle);
            return;
        }
        catch (e) {
            console.warn('[HAM] TLE calculation failed:', e.message);
            el.innerHTML = '<p style="color:#e74c3c">TLE计算出错：' + e.message + '</p>';
            showToast('TLE计算出错', 'error');
            return;
        }
    }
    // N2YO高级API
    if (source === 'n2yo') {
        if (!SatService.hasApiKey()) {
            el.innerHTML = '<p style="color:#e74c3c">请先配置N2YO API Key（<a href="https://www.n2yo.com/api/" target="_blank" style="color:#1a237e">免费注册</a>）</p>';
            return;
        }
        try {
            const n2yoData = await SatService.fetchSatPosition(currentSat.noradId, obsLat, obsLon, 0, 0);
            if (n2yoData && n2yoData._error) {
                const errMsg = n2yoData._error === '请求超时' ? 'N2YO API请求超时，请稍后重试' : 'N2YO API请求失败，请检查API Key和网络连接';
                el.innerHTML = '<p style="color:#e74c3c">' + errMsg + '</p>';
                showToast(errMsg, 'error');
                return;
            }
            if (n2yoData) {
                const pos = SatService.parseN2yoPosition(n2yoData);
                if (pos) {
                    renderN2yoPosition(el, pos, obsGrid);
                    return;
                }
            }
        }
        catch (e) {
            console.warn('[HAM] N2YO API failed:', e.message);
        }
        el.innerHTML = '<p style="color:#e74c3c">N2YO API请求失败，请检查API Key和网络连接</p>';
        showToast('N2YO API请求失败，请检查API Key和网络连接', 'error');
        return;
    }
    el.innerHTML = '<p style="color:#e74c3c">未知数据源</p>';
}
// ============================================================
// 渲染函数
// ============================================================
/**
 * 渲染WTIA免费API的位置数据
 */
function renderWtiaPosition(el, pos, look, obsGrid) {
    const dirLabel = (az) => {
        const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        return dirs[Math.round(az / 45) % 8];
    };
    const elevColor = look.elevation > 0 ? '#27ae60' : '#e74c3c';
    const visLabel = { daylight: '日照区', eclipse: '阴影区', unknown: '未知' }[pos.visibility] || pos.visibility;
    // 检查是否已有渲染结构，有则只更新数值
    if (el.querySelector('.sat-info')) {
        el.querySelector('[data-field="lat"]').textContent = pos.lat.toFixed(4) + '°';
        el.querySelector('[data-field="lon"]').textContent = pos.lon.toFixed(4) + '°';
        el.querySelector('[data-field="alt"]').textContent = pos.alt.toFixed(1) + ' km';
        el.querySelector('[data-field="vel"]').textContent = pos.vel.toFixed(2) + ' km/s';
        el.querySelector('[data-field="vis"]').textContent = visLabel;
        el.querySelector('[data-field="footprint"]').textContent = pos.footprint.toFixed(0) + ' km';
        const elevSpan = el.querySelector('[data-field="elev"]');
        elevSpan.textContent = look.elevation.toFixed(1) + '°';
        elevSpan.style.color = elevColor;
        el.querySelector('[data-field="az"]').textContent = look.azimuth.toFixed(1) + '° (' + dirLabel(look.azimuth) + ')';
        el.querySelector('[data-field="dist"]').textContent = look.distance.toFixed(0) + ' km';
        el.querySelector('[data-field="updateTime"]').textContent = new Date().toLocaleTimeString();
        return;
    }
    el.innerHTML = `
    <div class="sat-info">
      <div class="sat-row"><label>纬度:</label><span data-field="lat">${pos.lat.toFixed(4)}°</span></div>
      <div class="sat-row"><label>经度:</label><span data-field="lon">${pos.lon.toFixed(4)}°</span></div>
      <div class="sat-row"><label>高度:</label><span data-field="alt">${pos.alt.toFixed(1)} km</span></div>
      <div class="sat-row"><label>速度:</label><span data-field="vel">${pos.vel.toFixed(2)} km/s</span></div>
      <div class="sat-row"><label>可见性:</label><span data-field="vis">${visLabel}</span></div>
      <div class="sat-row"><label>足迹:</label><span data-field="footprint">${pos.footprint.toFixed(0)} km</span></div>
    </div>
    <div class="sat-look">
      <h5>观测参数 (观测者: ${obsGrid || '北京'})</h5>
      <div class="sat-row"><label>仰角:</label><span data-field="elev" style="color:${elevColor}">${look.elevation.toFixed(1)}°</span></div>
      <div class="sat-row"><label>方位角:</label><span data-field="az">${look.azimuth.toFixed(1)}° (${dirLabel(look.azimuth)})</span></div>
      <div class="sat-row"><label>距离:</label><span data-field="dist">${look.distance.toFixed(0)} km</span></div>
    </div>
    <p style="font-size:11px;color:#2196F3;margin-top:6px">✓ WTIA免费API 实时数据（无需API Key）| 更新时间: <span data-field="updateTime">${new Date().toLocaleTimeString()}</span></p>
  `;
}
/**
 * 渲染N2YO高级API的位置数据
 */
function renderN2yoPosition(el, pos, obsGrid) {
    const dirLabel = (az) => {
        const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        return dirs[Math.round(az / 45) % 8];
    };
    const elevColor = pos.elevation > 0 ? '#27ae60' : '#e74c3c';
    if (el.querySelector('.sat-info')) {
        el.querySelector('[data-field="lat"]').textContent = pos.lat.toFixed(4) + '°';
        el.querySelector('[data-field="lon"]').textContent = pos.lon.toFixed(4) + '°';
        el.querySelector('[data-field="alt"]').textContent = pos.alt.toFixed(1) + ' km';
        el.querySelector('[data-field="vel"]').textContent = pos.vel.toFixed(2) + ' km/s';
        const elevSpan = el.querySelector('[data-field="elev"]');
        elevSpan.textContent = pos.elevation.toFixed(1) + '°';
        elevSpan.style.color = elevColor;
        el.querySelector('[data-field="az"]').textContent = pos.azimuth.toFixed(1) + '° (' + dirLabel(pos.azimuth) + ')';
        el.querySelector('[data-field="dist"]').textContent = pos.distance.toFixed(0) + ' km';
        el.querySelector('[data-field="updateTime"]').textContent = new Date().toLocaleTimeString();
        return;
    }
    el.innerHTML = `
    <div class="sat-info">
      <div class="sat-row"><label>纬度:</label><span data-field="lat">${pos.lat.toFixed(4)}°</span></div>
      <div class="sat-row"><label>经度:</label><span data-field="lon">${pos.lon.toFixed(4)}°</span></div>
      <div class="sat-row"><label>高度:</label><span data-field="alt">${pos.alt.toFixed(1)} km</span></div>
      <div class="sat-row"><label>速度:</label><span data-field="vel">${pos.vel.toFixed(2)} km/s</span></div>
    </div>
    <div class="sat-look">
      <h5>观测参数 (观测者: ${obsGrid || '北京'})</h5>
      <div class="sat-row"><label>仰角:</label><span data-field="elev" style="color:${elevColor}">${pos.elevation.toFixed(1)}°</span></div>
      <div class="sat-row"><label>方位角:</label><span data-field="az">${pos.azimuth.toFixed(1)}° (${dirLabel(pos.azimuth)})</span></div>
      <div class="sat-row"><label>距离:</label><span data-field="dist">${pos.distance.toFixed(0)} km</span></div>
    </div>
    <p style="font-size:11px;color:#27ae60;margin-top:6px">✓ N2YO高级API 实时数据 | 更新时间: <span data-field="updateTime">${new Date().toLocaleTimeString()}</span></p>
  `;
}

/**
 * 渲染TLE本地计算的位置数据
 * @param {HTMLElement} el - 目标DOM元素
 * @param {Object} pos - SGP4计算的位置 {lat, lon, alt, vel, timestamp}
 * @param {Object} look - 观测参数 {elevation, azimuth, distance}
 * @param {string} obsGrid - 观测者网格坐标
 * @param {Object} tle - TLE数据 {fetchTime, fromCache, epoch}
 */
function renderTlePosition(el, pos, look, obsGrid, tle) {
    const dirLabel = (az) => {
        const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        return dirs[Math.round(az / 45) % 8];
    };
    const elevColor = look.elevation > 0 ? '#27ae60' : '#e74c3c';
    // 构建TLE数据来源提示
    let tleInfo = '';
    if (tle.fromCache) {
        const fetchTimeStr = new Date(tle.fetchTime).toLocaleString('zh-CN');
        tleInfo = `<span style="color:#e67e22">⚠ 使用 ${fetchTimeStr} 获取的TLE数据计算，可能产生一定误差</span>`;
    } else if (tle.epoch) {
        const ageStr = SatService.formatTleAge(tle.epoch);
        const epochStr = tle.epoch.toLocaleString('zh-CN');
        const ageDays = (Date.now() - tle.epoch.getTime()) / 86400000;
        if (ageDays > 3) {
            tleInfo = `<span style="color:#e67e22">⚠ TLE历元: ${epochStr}（${ageStr}前），可能产生一定误差</span>`;
        } else {
            tleInfo = `<span style="color:#27ae60">TLE历元: ${epochStr}（${ageStr}前）</span>`;
        }
    }
    // 增量更新：已有结构时只更新数值
    if (el.querySelector('.sat-info')) {
        el.querySelector('[data-field="lat"]').textContent = pos.lat.toFixed(4) + '°';
        el.querySelector('[data-field="lon"]').textContent = pos.lon.toFixed(4) + '°';
        el.querySelector('[data-field="alt"]').textContent = pos.alt.toFixed(1) + ' km';
        el.querySelector('[data-field="vel"]').textContent = pos.vel.toFixed(2) + ' km/s';
        const elevSpan = el.querySelector('[data-field="elev"]');
        elevSpan.textContent = look.elevation.toFixed(1) + '°';
        elevSpan.style.color = elevColor;
        el.querySelector('[data-field="az"]').textContent = look.azimuth.toFixed(1) + '° (' + dirLabel(look.azimuth) + ')';
        el.querySelector('[data-field="dist"]').textContent = look.distance.toFixed(0) + ' km';
        el.querySelector('[data-field="updateTime"]').textContent = new Date().toLocaleTimeString();
        if (tleInfo) {
            const tleInfoEl = el.querySelector('[data-field="tleInfo"]');
            if (tleInfoEl)
                tleInfoEl.innerHTML = tleInfo;
        }
        return;
    }
    el.innerHTML = `
    <div class="sat-info">
      <div class="sat-row"><label>纬度:</label><span data-field="lat">${pos.lat.toFixed(4)}°</span></div>
      <div class="sat-row"><label>经度:</label><span data-field="lon">${pos.lon.toFixed(4)}°</span></div>
      <div class="sat-row"><label>高度:</label><span data-field="alt">${pos.alt.toFixed(1)} km</span></div>
      <div class="sat-row"><label>速度:</label><span data-field="vel">${pos.vel.toFixed(2)} km/s</span></div>
    </div>
    <div class="sat-look">
      <h5>观测参数 (观测者: ${obsGrid || '北京'})</h5>
      <div class="sat-row"><label>仰角:</label><span data-field="elev" style="color:${elevColor}">${look.elevation.toFixed(1)}°</span></div>
      <div class="sat-row"><label>方位角:</label><span data-field="az">${look.azimuth.toFixed(1)}° (${dirLabel(look.azimuth)})</span></div>
      <div class="sat-row"><label>距离:</label><span data-field="dist">${look.distance.toFixed(0)} km</span></div>
    </div>
    <p style="font-size:11px;color:#2196F3;margin-top:6px">✓ TLE本地计算 (satellite.js) | 更新时间: <span data-field="updateTime">${new Date().toLocaleTimeString()}</span></p>
    ${tleInfo ? '<p style="font-size:11px;margin-top:2px" data-field="tleInfo">' + tleInfo + '</p>' : ''}
  `;
}
// ============================================================
// 过境预测（仅N2YO支持）
// ============================================================
/**
 * 预测过境
 */
export async function predictPasses() {
    if (!currentSat) {
        showToast('请先选择卫星', 'warning');
        return;
    }
    const source = SatService.getApiSource();
    const el = $('satPasses');
    if (!el)
        return;
    // WTIA不提供过境预测
    if (source === 'wtia') {
        el.innerHTML = '<p style="color:#e74c3c">WTIA不支持过境预测，请切换到N2YO数据源</p>';
        return;
    }
    // 解析观测者坐标（TLE和N2YO共用）
    const obsGrid = $('satObsGrid')?.value?.trim() || '';
    let obsLat = 39.9, obsLon = 116.4;
    if (obsGrid) {
        const coord = GeoService.gridToLatLon(obsGrid);
        if (!coord) {
            el.innerHTML = '<p style="color:#e74c3c">网格坐标格式错误，请输入有效的Maidenhead坐标（如 OM89）</p>';
            return;
        }
        obsLat = coord.lat;
        obsLon = coord.lon;
    }
    const minElev = parseFloat($('satMinElev')?.value || '') || 10;
    // TLE本地过境预测
    if (source === 'tle') {
        el.innerHTML = '<p style="color:#888">正在计算TLE本地过境预测（可能需要数秒）...</p>';
        try {
            const passes = await SatService.predictPassesLocal(
                currentSat.noradId, obsLat, obsLon, 0, 24, minElev, 30
            );
            if (passes.length === 0) {
                el.innerHTML = '<p style="color:#888">未来24小时内无可见过境（仰角 ≥ ' + minElev + '°）</p>';
            } else {
                renderPasses(el, passes, minElev, 'tle');
            }
        } catch (e) {
            console.warn('[HAM] TLE本地过境预测失败:', e.message);
            el.innerHTML = '<p style="color:#e74c3c">TLE过境预测计算失败：' + e.message + '</p>';
        }
        return;
    }
    // N2YO需要API Key
    if (!SatService.hasApiKey()) {
        el.innerHTML = '<p style="color:#e74c3c">过境预测需要N2YO API Key（<a href="https://www.n2yo.com/api/" target="_blank" style="color:#1a237e">免费注册</a>）</p>';
        return;
    }
    el.innerHTML = '<p style="color:#888">正在计算过境预测...</p>';
    try {
        const n2yoData = await SatService.fetchSatPasses(currentSat.noradId, obsLat, obsLon, 0, 1, minElev);
        if (n2yoData && n2yoData._error) {
            const errMsg = n2yoData._error === '请求超时' ? '过境预测请求超时，请稍后重试' : '过境预测请求失败，请检查API Key和网络连接';
            el.innerHTML = '<p style="color:#e74c3c">' + errMsg + '</p>';
            showToast(errMsg, 'error');
            return;
        }
        if (n2yoData && n2yoData.passes) {
            const passes = SatService.parseN2yoPasses(n2yoData);
            renderPasses(el, passes, minElev);
            return;
        }
    }
    catch (e) {
        console.warn('[HAM] N2YO passes API failed:', e.message);
    }
    el.innerHTML = '<p style="color:#e74c3c">过境预测请求失败，请检查API Key和网络连接</p>';
    showToast('过境预测请求失败，请检查API Key和网络连接', 'error');
}
/**
 * 渲染过境预测结果
 * @param {HTMLElement} el - 渲染目标元素
 * @param {Array} passes - 过境数组
 * @param {number} minElev - 最小仰角
 * @param {string} [source='n2yo'] - 数据源标识
 */
function renderPasses(el, passes, minElev, source = 'n2yo') {
    if (!passes.length) {
        el.innerHTML = '<p style="color:#888">未来24小时内无可见过境（仰角 ≥ ' + minElev + '°）</p>';
        return;
    }
    const fmt = (d) => d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sourceTag = source === 'tle'
        ? '<span style="color:#2196F3;font-size:11px"> ✓ TLE本地计算 (satellite.js)</span><span style="color:#e67e22;font-size:11px"> ⚠ 精度较差，仅供参考</span>'
        : '<span style="color:#27ae60;font-size:11px"> ✓ N2YO高级API</span>';
    let html = `<p>找到 ${passes.length} 次过境（仰角 ≥ ${minElev}°）${sourceTag}</p>`;
    html += '<table class="data-table"><tr><th>开始</th><th>峰值</th><th>结束</th><th>最高仰角</th><th>方位</th></tr>';
    passes.slice(0, 10).forEach(p => {
        html += `<tr>
      <td>${fmt(p.start)}</td>
      <td>${fmt(p.peak)}</td>
      <td>${fmt(p.end)}</td>
      <td style="font-weight:bold">${p.maxElev.toFixed(1)}°</td>
      <td>${p.azimuth.toFixed(0)}°</td>
    </tr>`;
    });
    html += '</table>';
    el.innerHTML = html;
}
// ============================================================
// 清空
// ============================================================
/**
 * 清空卫星数据
 */
export function clearSatellite() {
    currentSat = null;
    stopTracking();
    const posEl = $('satPosition');
    if (posEl)
        posEl.innerHTML = '';
    const passEl = $('satPasses');
    if (passEl)
        passEl.innerHTML = '<p style="color:#888">选择卫星后点击"预测过境"查看未来24小时可见过境。</p>';
    const selectedEl = $('satSelected');
    if (selectedEl)
        selectedEl.textContent = '未选择卫星';
    const searchInput = $('satSearch');
    if (searchInput)
        searchInput.value = '';
    // 清除列表高亮
    const listEl = $('satList');
    if (listEl) {
        listEl.querySelectorAll('.sat-item').forEach(item => {
            item.style.background = '';
            item.style.fontWeight = '';
        });
    }
}

/**
 * 使用浏览器定位获取当前网格坐标，填入观测者网格输入框
 */
export function getMyLocation() {
    if (!navigator.geolocation) {
        showToast('此浏览器不支持定位功能', 'warning');
        return;
    }
    showToast('正在获取位置...', 'info');
    navigator.geolocation.getCurrentPosition(
        function (pos) {
            var lat = pos.coords.latitude;
            var lon = pos.coords.longitude;
            var grid = latLonToGrid(lat, lon);
            if (grid) {
                var input = $('satObsGrid');
                if (input)
                    input.value = grid.substring(0, 6);
                showToast('定位成功: ' + grid.substring(0, 6) + ' (' + lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°)', 'success');
                // 定位成功后自动刷新计算
                if (currentSat) {
                    updatePosition();
                }
            } else {
                showToast('定位成功但无法转换为网格坐标', 'warning');
            }
        },
        function (err) {
            var msgs = {
                1: '定位权限被拒绝，请在浏览器设置中允许定位权限',
                2: '无法获取位置信息，请检查设备定位服务',
                3: '定位请求超时，请重试'
            };
            showToast(msgs[err.code] || ('定位失败: ' + err.message), 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}
//# sourceMappingURL=ham-satellite.js.map