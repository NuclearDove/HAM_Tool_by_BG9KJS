/**
 * HAM Radio Toolbox - 卫星跟踪UI模块
 * 三API自选架构：WTIA免费API(仅ISS) / TLE本地计算(Celestrak+satellite.js) / N2YO高级API(需Key)
 * @module ham-satellite
 */
'use strict';
import * as SatService from './services/satellite-service.js?v=20260802';
import * as GeoService from './services/geo-service.js';
import { showToast } from './ham-toast.js';
import { latLonToGrid, escHtml } from './core.js';
import { renderWtiaPosition, renderN2yoPosition, renderTlePosition, renderPasses, renderSatList as renderSatListUI, renderGroundTrack, clearGroundTrackMap, dirLabel } from './satellite-ui.js?v=20260802';
const $ = (id) => document.getElementById(id);
let initialized = false;
/** 当前主跟踪卫星（用于单卫星功能：过境预测、地面轨迹） */
let currentSat = null;
/** 多卫星跟踪Map（noradId -> {name, noradId}） */
const trackedSats = new Map();
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
    trackedSats.clear();
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
        trackedSats.set(25544, { name: 'ISS (ZARYA)', noradId: 25544 });
        if (selectedEl)
            selectedEl.innerHTML = '<span style="color:#1a237e;font-weight:bold">ISS (ZARYA)</span> <span style="color:#888">(NORAD: 25544)</span>';
        showToast('WTIA模式：自动跟踪ISS', 'info');
        updatePosition();
        startTracking();
    }
    else {
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
                renderSatListUI(listEl, satList, selectSatelliteFromPanel);
            }
            catch (e) {
                if (listEl)
                    listEl.innerHTML = '<div style="color:#e74c3c;padding:8px;font-size:12px">获取卫星列表失败: ' + escHtml(e.message) + '</div>';
                return;
            }
        }
        else {
            // N2YO: 常用卫星列表
            satList = SatService.getPopularSatellites();
            renderSatListUI($('satList'), satList, selectSatelliteFromPanel);
        }
    }
}
/**
 * 搜索筛选卫星
 */
function filterSatellites(query) {
    if (!query) {
        renderSatListUI($('satList'), satList, selectSatelliteFromPanel);
        return;
    }
    const q = query.toLowerCase();
    const filtered = satList.filter(sat => sat.name.toLowerCase().includes(q) ||
        String(sat.noradId).includes(q));
    renderSatListUI($('satList'), filtered, selectSatelliteFromPanel);
}
/**
 * 从面板选择卫星（支持多选切换）
 */
function selectSatelliteFromPanel(name, noradId) {
    // 切换跟踪状态
    if (trackedSats.has(noradId)) {
        // 取消跟踪
        trackedSats.delete(noradId);
        showToast(`已取消跟踪: ${name}`, 'info');
    } else {
        // 添加跟踪
        trackedSats.set(noradId, { name, noradId });
        showToast(`已跟踪: ${name}`, 'info');
    }
    // 设置主卫星为第一个跟踪的卫星
    const first = trackedSats.values().next().value;
    currentSat = first || null;
    // 更新选中显示
    updateTrackedSatsDisplay();
    // 更新列表中的选中状态
    updateSatListSelection();
    // 开始/停止跟踪
    if (trackedSats.size > 0) {
        startTracking();
        updatePosition();
    } else {
        stopTracking();
        const posEl = $('satPosition');
        if (posEl)
            posEl.innerHTML = '<p style="color:#888">请从列表中选择卫星。</p>';
    }
}
/**
 * 更新已跟踪卫星显示
 */
function updateTrackedSatsDisplay() {
    const selectedEl = $('satSelected');
    if (!selectedEl)
        return;
    if (trackedSats.size === 0) {
        selectedEl.textContent = '未选择卫星';
        return;
    }
    const names = Array.from(trackedSats.values()).map(s =>
        `<span style="color:#1a237e;font-weight:bold">${escHtml(s.name)}</span> <span style="color:#888">(NORAD: ${s.noradId})</span>`
    ).join(' &nbsp;|&nbsp; ');
    selectedEl.innerHTML = names;
}
/**
 * 更新卫星列表中的选中状态（高亮已跟踪的卫星）
 */
function updateSatListSelection() {
    const listEl = $('satList');
    if (!listEl)
        return;
    listEl.querySelectorAll('.sat-item').forEach(item => {
        const noradId = parseInt(item.dataset.norad || '0');
        const checkEl = item.querySelector('.sat-check');
        if (trackedSats.has(noradId)) {
            item.style.background = '#e3f2fd';
            item.style.fontWeight = 'bold';
            if (checkEl)
                checkEl.textContent = '☑';
        } else {
            item.style.background = '';
            item.style.fontWeight = '';
            if (checkEl)
                checkEl.textContent = '☐';
        }
    });
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
    }
    else if (source === 'tle') {
        hint.textContent = 'TLE本地计算：使用Celestrak TLE+satellite.js，无需API Key';
        hint.style.color = '#27ae60';
    }
    else {
        if (SatService.hasApiKey()) {
            hint.textContent = 'N2YO高级API已配置，支持所有卫星+过境预测';
            hint.style.color = '#27ae60';
        }
        else {
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
 * 更新卫星位置显示（支持多卫星同时跟踪）
 */
export async function updatePosition() {
    if (trackedSats.size === 0)
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
    // 观测者网格变化时强制完整重渲染
    if (obsGrid !== lastObsGrid) {
        const satInfo = el.querySelector('.sat-info');
        if (satInfo)
            satInfo.remove();
        lastObsGrid = obsGrid;
    }
    // 单卫星模式（WTIA或仅跟踪1颗卫星）
    if (source === 'wtia' || trackedSats.size === 1) {
        await updateSinglePosition(el, source, obsLat, obsLon, obsGrid);
        return;
    }
    // 多卫星模式（TLE或N2YO）
    await updateMultiPosition(el, source, obsLat, obsLon, obsGrid);
}
/**
 * 单卫星位置更新
 */
async function updateSinglePosition(el, source, obsLat, obsLon, obsGrid) {
    if (!currentSat)
        return;
    el.innerHTML = '<p style="color:#888">正在获取卫星位置数据...</p>';
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
    // TLE本地计算
    if (source === 'tle') {
        if (typeof window.satellite === 'undefined') {
            el.innerHTML = '<p style="color:#666">正在加载 satellite.js 轨道计算库...</p>';
            try {
                await SatService.loadSatelliteJs();
            } catch (_e) {
                el.innerHTML = '<p style="color:#e74c3c">satellite.js库加载失败，请检查网络连接后重试。</p>';
                showToast('satellite.js库加载失败', 'error');
                return;
            }
        }
        try {
            const tle = await SatService.getTleForSatellite(currentSat.noradId);
            if (!tle) {
                el.innerHTML = '<p style="color:#e74c3c">无法获取 ' + escHtml(currentSat.name) + ' 的TLE数据，请检查网络连接或稍后重试</p>';
                showToast('无法获取TLE数据', 'error');
                return;
            }
            const now = new Date();
            const pos = await SatService.calcSgp4Position(tle.line1, tle.line2, now);
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
            el.innerHTML = '<p style="color:#e74c3c">TLE计算出错：' + escHtml(e.message) + '</p>';
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
/**
 * 多卫星位置更新（TLE/N2YO模式）
 */
async function updateMultiPosition(el, source, obsLat, obsLon, obsGrid) {
    el.innerHTML = '<p style="color:#888">正在获取多卫星位置数据...</p>';
    // TLE模式：并行计算所有跟踪卫星的位置
    if (source === 'tle') {
        if (typeof window.satellite === 'undefined') {
            el.innerHTML = '<p style="color:#666">正在加载 satellite.js 轨道计算库...</p>';
            try {
                await SatService.loadSatelliteJs();
            } catch (_e) {
                el.innerHTML = '<p style="color:#e74c3c">satellite.js库加载失败</p>';
                return;
            }
        }
        const results = [];
        const now = new Date();
        for (const [noradId, sat] of trackedSats) {
            try {
                const tle = await SatService.getTleForSatellite(noradId);
                if (!tle) {
                    results.push({ name: sat.name, noradId, error: '无TLE数据' });
                    continue;
                }
                const pos = await SatService.calcSgp4Position(tle.line1, tle.line2, now);
                if (!pos) {
                    results.push({ name: sat.name, noradId, error: 'SGP4计算失败' });
                    continue;
                }
                const look = SatService.calcLookAngle(pos, obsLat, obsLon);
                results.push({ name: sat.name, noradId, pos, look, tle });
            }
            catch (e) {
                results.push({ name: sat.name, noradId, error: e.message });
            }
        }
        renderMultiPosition(el, results, obsGrid, source);
        return;
    }
    // N2YO模式：逐个获取（API限制）
    if (source === 'n2yo') {
        if (!SatService.hasApiKey()) {
            el.innerHTML = '<p style="color:#e74c3c">请先配置N2YO API Key</p>';
            return;
        }
        const results = [];
        for (const [noradId, sat] of trackedSats) {
            try {
                const n2yoData = await SatService.fetchSatPosition(noradId, obsLat, obsLon, 0, 0);
                if (n2yoData && !n2yoData._error) {
                    const pos = SatService.parseN2yoPosition(n2yoData);
                    if (pos) {
                        results.push({ name: sat.name, noradId, pos, look: { elevation: pos.elevation, azimuth: pos.azimuth, distance: pos.distance } });
                        continue;
                    }
                }
                results.push({ name: sat.name, noradId, error: 'API请求失败' });
            }
            catch (e) {
                results.push({ name: sat.name, noradId, error: e.message });
            }
        }
        renderMultiPosition(el, results, obsGrid, source);
        return;
    }
}
/**
 * 渲染多卫星位置面板
 */
function renderMultiPosition(el, results, obsGrid, source) {
    const sourceLabel = source === 'tle' ? 'TLE本地计算' : 'N2YO高级API';
    let html = `<h5 style="margin:0 0 6px">多卫星跟踪 (${results.length}颗) <span style="font-size:11px;color:#2196F3">✓ ${sourceLabel}</span></h5>`;
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">';
    for (const r of results) {
        if (r.error) {
            html += `<div style="border:1px solid #e0e0e0;border-radius:4px;padding:8px;background:#fff3f3">
                <b style="color:#1a237e">${escHtml(r.name)}</b> <span style="color:#888;font-size:11px">(NORAD: ${r.noradId})</span>
                <p style="color:#e74c3c;font-size:12px;margin:4px 0 0">${escHtml(r.error)}</p>
            </div>`;
            continue;
        }
        const elevColor = r.look.elevation > 0 ? '#27ae60' : '#e74c3c';
        const elevLabel = r.look.elevation > 0 ? '可见' : '地平线下';
        html += `<div style="border:1px solid #e0e0e0;border-radius:4px;padding:8px;background:#f8fff8">
            <b style="color:#1a237e">${escHtml(r.name)}</b> <span style="color:#888;font-size:11px">(NORAD: ${r.noradId})</span>
            <div style="font-size:12px;margin-top:4px">
                <span>纬度: ${r.pos.lat.toFixed(4)}°</span> <span style="margin-left:8px">经度: ${r.pos.lon.toFixed(4)}°</span>
                <br><span>高度: ${r.pos.alt.toFixed(1)} km</span>
                <br><span style="color:${elevColor}">仰角: ${r.look.elevation.toFixed(1)}° (${elevLabel})</span>
                <span style="margin-left:8px">方位: ${r.look.azimuth.toFixed(1)}° (${dirLabel(r.look.azimuth)})</span>
                <br><span>距离: ${r.look.distance.toFixed(0)} km</span>
            </div>
        </div>`;
    }
    html += '</div>';
    html += `<p style="font-size:11px;color:#888;margin-top:6px">更新时间: ${new Date().toLocaleTimeString()} | 观测者: ${obsGrid || '北京'}</p>`;
    el.innerHTML = html;
}
// ============================================================
// 过境预测
// ============================================================
/**
 * 预测过境
 */
export async function predictPasses() {
    if (!currentSat) {
        showToast('请先选择卫星（点击卫星列表中的卫星名称添加跟踪）', 'warning');
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
            const passes = await SatService.predictPassesLocal(currentSat.noradId, obsLat, obsLon, 0, 24, minElev, 30);
            if (passes.length === 0) {
                el.innerHTML = '<p style="color:#888">未来24小时内无可见过境（仰角 ≥ ' + minElev + '°）</p>';
            }
            else {
                renderPasses(el, passes, minElev, 'tle');
            }
        }
        catch (e) {
            console.warn('[HAM] TLE本地过境预测失败:', e.message);
            el.innerHTML = '<p style="color:#e74c3c">TLE过境预测计算失败：' + escHtml(e.message) + '</p>';
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
// ============================================================
// 地面轨迹
// ============================================================
/**
 * 显示卫星地面轨迹（24小时轨道）
 */
export async function showGroundTrack() {
    if (!currentSat) {
        showToast('请先选择卫星（点击卫星列表中的卫星名称添加跟踪）', 'warning');
        return;
    }
    const mapContainer = $('satGroundTrackMap');
    const statusEl = $('satGroundTrackStatus');
    if (!mapContainer)
        return;
    // 读取用户选择的轨道时长
    const durationEl = $('satGtDuration');
    const durationHours = durationEl ? parseInt(durationEl.value, 10) : 24;
    // 仅TLE数据源支持地面轨迹计算
    const source = SatService.getApiSource();
    if (source !== 'tle') {
        if (statusEl)
            statusEl.textContent = '地面轨迹仅支持TLE本地计算模式，请切换数据源';
        showToast('地面轨迹仅支持TLE本地计算模式', 'warning');
        return;
    }
    // 显示加载状态
    if (statusEl)
        statusEl.textContent = '正在计算地面轨迹...';
    // 加载satellite.js
    if (typeof window.satellite === 'undefined') {
        try {
            await SatService.loadSatelliteJs();
        }
        catch (_e) {
            if (statusEl)
                statusEl.textContent = 'satellite.js库加载失败';
            showToast('satellite.js库加载失败', 'error');
            return;
        }
    }
    // 获取TLE数据
    const tle = await SatService.getTleForSatellite(currentSat.noradId);
    if (!tle || !tle.line1 || !tle.line2) {
        if (statusEl)
            statusEl.textContent = '无法获取TLE数据';
        showToast('无法获取TLE数据', 'error');
        return;
    }
    // 计算地面轨迹
    const points = SatService.calcGroundTrack(tle.line1, tle.line2, durationHours, 1);
    if (points.length === 0) {
        if (statusEl)
            statusEl.textContent = '地面轨迹计算失败';
        showToast('地面轨迹计算失败', 'error');
        return;
    }
    // 获取当前卫星位置
    const now = new Date();
    const pos = await SatService.calcSgp4Position(tle.line1, tle.line2, now);
    const currentPos = pos ? { lat: pos.lat, lon: pos.lon } : null;
    // 获取观测者位置
    const obsGrid = $('satObsGrid')?.value?.trim() || '';
    let observer = null;
    if (obsGrid) {
        const coord = GeoService.gridToLatLon(obsGrid);
        if (coord)
            observer = { lat: coord.lat, lon: coord.lon };
    }
    // 渲染地面轨迹（async，等待地图加载完成）
    await renderGroundTrack(mapContainer, points, currentPos, observer, currentSat.name);
    if (statusEl)
        statusEl.textContent = `地面轨迹已绘制（${points.length}个轨道点，${durationHours}小时）`;
}
// ============================================================
// 清空
// ============================================================
/**
 * 清空卫星数据
 */
export function clearSatellite() {
    currentSat = null;
    trackedSats.clear();
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
    // 清除列表高亮和选中标记
    updateSatListSelection();
    // 清除地面轨迹
    clearGroundTrackMap();
    const gtStatus = $('satGroundTrackStatus');
    if (gtStatus)
        gtStatus.textContent = '';
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
    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const grid = latLonToGrid(lat, lon);
        if (grid) {
            const input = $('satObsGrid');
            if (input)
                input.value = grid.substring(0, 6);
            showToast('定位成功: ' + grid.substring(0, 6) + ' (' + lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°)', 'success');
            // 定位成功后自动刷新计算
            if (currentSat) {
                updatePosition();
            }
        }
        else {
            showToast('定位成功但无法转换为网格坐标', 'warning');
        }
    }, (err) => {
        const msgs = {
            1: '定位权限被拒绝，请在浏览器设置中允许定位权限',
            2: '无法获取位置信息，请检查设备定位服务',
            3: '定位请求超时，请重试'
        };
        showToast(msgs[err.code] || ('定位失败: ' + err.message), 'error');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}