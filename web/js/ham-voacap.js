/**
 * HAM Radio Toolbox - VOACAP传播预测UI模块
 * 提供传播预测计算和频段推荐界面
 * 支持在线API（voacap.com）+ 本地简化模型回退
 * 支持灰线（Gray-line）指示
 * @module ham-voacap
 */
'use strict';
import { $ } from './dom-cache.js';
import { BANDS } from './core.js';
import * as Voacap from './services/voacap-service.js';
import * as GeoService from './services/geo-service.js';
import { showToast } from './ham-toast.js';
let initialized = false;
/**
 * 初始化VOACAP模块
 */
export function init() {
    if (initialized)
        return;
    initialized = true;
    // 初始化灰线指示器
    updateGrayLineIndicator();
    // 每5分钟更新灰线
    setInterval(updateGrayLineIndicator, 5 * 60 * 1000);
    console.log('[HAM] VOACAP module initialized');
}
/**
 * 运行传播预测（支持在线API + 本地模型回退）
 */
export async function runPrediction() {
    const txGrid = $('voacapTxGrid')?.value?.trim() || '';
    const rxGrid = $('voacapRxGrid')?.value?.trim() || '';
    const txPower = parseFloat($('voacapTxPower')?.value || '') || 100;
    const freqMHz = parseFloat($('voacapFreq')?.value || '') || 14;
    const sfi = parseFloat($('voacapSfi')?.value || '') || 100;
    const hourUTC = parseInt($('voacapHour')?.value || '') || new Date().getUTCHours();
    const gainDbi = parseFloat($('voacapGain')?.value || '') || 0;
    const mode = $('voacapMode')?.value || 'local';
    const useOnline = mode === 'online';
    if (!txGrid || !rxGrid) {
        showToast('请输入发射和接收方网格坐标', 'warning');
        return;
    }
    // 解析网格坐标
    const txCoord = GeoService.gridToLatLon(txGrid);
    const rxCoord = GeoService.gridToLatLon(rxGrid);
    if (!txCoord) {
        showToast('发射方网格坐标格式错误', 'error');
        return;
    }
    if (!rxCoord) {
        showToast('接收方网格坐标格式错误', 'error');
        return;
    }
    // 计算距离
    const { distance } = GeoService.calcDistanceBearing(txCoord.lat, txCoord.lon, rxCoord.lat, rxCoord.lon);
    let result = null;
    let source = 'local';
    // 尝试在线API
    if (useOnline) {
        showToast('正在调用VOACAP在线API...', 'info');
        const ssn = Voacap.sfiToSsn(sfi);
        const apiResult = await Voacap.fetchVoacapOnline({
            txLat: txCoord.lat, txLon: txCoord.lon,
            rxLat: rxCoord.lat, rxLon: rxCoord.lon,
            txPower, freqMHz, ssn,
            month: new Date().getUTCMonth() + 1,
            hourUTC
        });
        if (apiResult) {
            result = Voacap.convertVoacapResult(apiResult);
            if (result)
                source = 'online';
        }
        if (!result) {
            showToast('在线API不可用，回退到本地简化模型', 'warning');
        }
    }
    // 本地简化模型
    if (!result) {
        const foF2 = Voacap.estimateFoF2(sfi, hourUTC, (txCoord.lat + rxCoord.lat) / 2);
        result = Voacap.predictPropagation({
            foF2, distance, txPower, freqMHz, solarFlux: sfi, hourUTC, gain_dBi: gainDbi
        });
        source = 'local';
    }
    // 推荐频段
    const recommendations = Voacap.recommendBands(parseFloat(result.muf), parseFloat(result.luf), BANDS);
    // 渲染结果
    renderResult(result, distance, txCoord, rxCoord, recommendations, source);
}
/**
 * 渲染预测结果
 */
function renderResult(result, distance, txCoord, rxCoord, recommendations, source = 'local') {
    const el = $('voacapResult');
    if (!el)
        return;
    const qualityColor = { '优': '#27ae60', '良': '#2ecc71', '一般': '#f39c12', '差': '#e74c3c' };
    const color = qualityColor[result.quality] || '#333';
    const sourceLabel = source === 'online' ? '<span style="color:#2196F3;font-size:11px">（VOACAP在线API）</span>' : '<span style="color:#888;font-size:11px">（本地简化模型）</span>';
    el.innerHTML = `
    <div class="voacap-summary">
      <h4>传播预测结果 ${sourceLabel}</h4>
      <div class="voacap-route">
        <span>TX: ${txCoord.lat.toFixed(1)}°, ${txCoord.lon.toFixed(1)}°</span>
        <span>→</span>
        <span>RX: ${rxCoord.lat.toFixed(1)}°, ${rxCoord.lon.toFixed(1)}°</span>
        <span>距离: <strong>${distance.toFixed(0)} km</strong></span>
      </div>
    </div>
    <div class="voacap-params">
      <div class="voacap-param"><label>MUF</label><span>${result.muf} MHz</span></div>
      <div class="voacap-param"><label>FOT</label><span>${result.fot} MHz</span></div>
      <div class="voacap-param"><label>LUF</label><span>${result.luf} MHz</span></div>
      <div class="voacap-param"><label>信号</label><span>${result.signalDbm} dBm</span></div>
      <div class="voacap-param"><label>SNR</label><span>${result.snr} dB</span></div>
      <div class="voacap-param"><label>质量</label><span style="color:${color};font-weight:bold">${result.quality}</span></div>
    </div>
    <div class="voacap-recommendation">
      <p>${result.recommendation}</p>
    </div>
    ${recommendations.length > 0 ? `
    <div class="voacap-bands">
      <h5>推荐频段</h5>
      <table>
        <tr><th>频段</th><th>中心频率</th><th>评分</th></tr>
        ${recommendations.slice(0, 5).map((r) => `
          <tr><td>${r.band}</td><td>${r.freq} MHz</td><td>${r.score}/100</td></tr>
        `).join('')}
      </table>
    </div>` : '<p>当前条件下无合适频段</p>'}
  `;
}
/**
 * 清空预测结果
 */
export function clearPrediction() {
    const el = $('voacapResult');
    if (el)
        el.innerHTML = '';
    const inputs = ['voacapTxGrid', 'voacapRxGrid', 'voacapFreq', 'voacapTxPower', 'voacapSfi', 'voacapHour', 'voacapGain'];
    inputs.forEach((id) => {
        const inp = $(id);
        if (inp)
            inp.value = '';
    });
}
/**
 * 使用当前太阳数据填充SFI
 */
export function fillCurrentSfi() {
    // 尝试从太阳模块获取当前SFI
    const solarEl = $('solarSfi');
    if (solarEl && solarEl.textContent) {
        const sfiVal = parseFloat(solarEl.textContent);
        if (!isNaN(sfiVal)) {
            const sfiInput = $('voacapSfi');
            if (sfiInput)
                sfiInput.value = String(sfiVal);
            showToast(`已填充SFI: ${sfiVal}`, 'info');
            return;
        }
    }
    showToast('无法获取当前SFI，请手动输入', 'warning');
}
/**
 * 更新灰线指示器
 */
function updateGrayLineIndicator() {
    const el = $('grayLineResult');
    if (!el)
        return;
    const info = Voacap.calcGrayLine();
    // 次太阳点信息
    const subLat = info.subsolarLat.toFixed(1);
    const subLon = info.subsolarLon.toFixed(1);
    // 灰线区域：晨昏线附近的区域
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const timeStr = String(utcHour).padStart(2, '0') + ':' + String(utcMin).padStart(2, '0');
    // 计算日出日落区域描述
    const grayLineDesc = Math.abs(info.subsolarLat) < 23.5
        ? '太阳直射点在热带地区，灰线传播有利于跨赤道通信'
        : '太阳直射点在' + (info.subsolarLat > 0 ? '北' : '南') + '半球高纬度，灰线传播有利于极地路径';
    el.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      <div>
        <strong>灰线指示</strong>
        <span style="color:#888;font-size:12px">（UTC ${timeStr}）</span>
      </div>
      <div style="font-size:13px">
        <span>太阳直射: ${subLat}°${info.subsolarLat >= 0 ? 'N' : 'S'}, ${subLon}°${info.subsolarLon >= 0 ? 'E' : 'W'}</span>
        <span style="margin-left:12px">赤纬: ${info.declination}°</span>
      </div>
      <div style="font-size:12px;color:#666;max-width:400px">${grayLineDesc}</div>
    </div>`;
    // 绘制灰线MapLibre地图
    drawGrayLineMap(info);
}
import { getMap, clearLayers, addPolyline, addPolygon, addCircleMarker, addPopup, invalidateSize } from './shared-map.js?v=20260730';
/**
 * 绘制灰线MapLibre地图
 */
async function drawGrayLineMap(info) {
    const mapId = 'grayLineMap';
    const map = await getMap(mapId, { center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 6 });
    if (!map)
        return;
    // 清除旧图层
    clearLayers(mapId);
    // 构建白天区域：沿晨昏线一侧 + 极地填充
    // MapLibre GeoJSON坐标格式: [lng, lat]
    const dayPoints = [];
    // 南向北沿晨昏线
    for (let i = 0; i < info.terminatorPoints.length; i++) {
        const pt = info.terminatorPoints[i];
        dayPoints.push([pt.lon, pt.lat]);
    }
    // 在晨昏线末端连接到极地（白天侧）
    const northPoleDay = info.subsolarLat > 0;
    if (northPoleDay) {
        dayPoints.push([info.terminatorPoints[info.terminatorPoints.length - 1].lon, 90]);
        dayPoints.push([-180, 90]);
        dayPoints.push([180, 90]);
        dayPoints.push([info.terminatorPoints[0].lon, 90]);
    } else {
        dayPoints.push([info.terminatorPoints[info.terminatorPoints.length - 1].lon, -90]);
        dayPoints.push([-180, -90]);
        dayPoints.push([180, -90]);
        dayPoints.push([info.terminatorPoints[0].lon, -90]);
    }
    // 绘制白天区域多边形
    addPolygon(mapId, dayPoints, {
        fillColor: '#FFD700',
        fillOpacity: 0.15,
        idPrefix: 'fill'
    });
    // 绘制晨昏线（灰线）
    const terminatorCoords = info.terminatorPoints.map(pt => [pt.lon, pt.lat]);
    addPolyline(mapId, terminatorCoords, {
        color: '#ff6b35',
        width: 3,
        opacity: 0.9,
        idPrefix: 'line'
    });
    // 灰线区域带（晨昏线两侧±6°太阳高度角区域）
    const grayBandWidth = 6;
    const grayBandNorth = [];
    const grayBandSouth = [];
    for (const pt of info.terminatorPoints) {
        const northLat = Math.min(90, pt.lat + grayBandWidth);
        const southLat = Math.max(-90, pt.lat - grayBandWidth);
        grayBandNorth.push([pt.lon, northLat]);
        grayBandSouth.push([pt.lon, southLat]);
    }
    // 灰线带 = 北侧线 + 反转南侧线 构成多边形
    const grayBandPoints = [...grayBandNorth, ...grayBandSouth.reverse()];
    addPolygon(mapId, grayBandPoints, {
        fillColor: '#ff6b35',
        fillOpacity: 0.1,
        idPrefix: 'fill'
    });
    // 绘制太阳直射点
    addCircleMarker(mapId, [info.subsolarLon, info.subsolarLat], {
        color: '#FFD700',
        radius: 6,
        opacity: 1,
        idPrefix: 'circle'
    });
    addPopup(mapId, [info.subsolarLon, info.subsolarLat], '☀ 太阳直射点');
    // 刷新地图尺寸
    invalidateSize(mapId);
}