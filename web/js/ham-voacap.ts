/**
 * HAM Radio Toolbox - VOACAP传播预测UI模块
 * 提供传播预测计算和频段推荐界面
 * @module ham-voacap
 */
'use strict';

import type { PropagationResult, BandRecommendation, Band, LatLon } from './types.js';
import { $, $s } from './dom-cache.js';
import { BANDS } from './core.js';
import * as Voacap from './services/voacap-service.js';
import * as GeoService from './services/geo-service.js';
import { showToast } from './ham-toast.js';

let initialized: boolean = false;

/**
 * 初始化VOACAP模块
 */
export function init(): void {
  if (initialized) return;
  initialized = true;
  console.log('[HAM] VOACAP module initialized');
}

/**
 * 运行传播预测
 */
export function runPrediction(): void {
  const txGrid = ($('voacapTxGrid') as HTMLInputElement | null)?.value?.trim() || '';
  const rxGrid = ($('voacapRxGrid') as HTMLInputElement | null)?.value?.trim() || '';
  const txPower = parseFloat(($('voacapTxPower') as HTMLInputElement | null)?.value || '') || 100;
  const freqMHz = parseFloat(($('voacapFreq') as HTMLInputElement | null)?.value || '') || 14;
  const sfi = parseFloat(($('voacapSfi') as HTMLInputElement | null)?.value || '') || 100;
  const hourUTC = parseInt(($('voacapHour') as HTMLInputElement | null)?.value || '') || new Date().getUTCHours();
  const gainDbi = parseFloat(($('voacapGain') as HTMLInputElement | null)?.value || '') || 0;

  if (!txGrid || !rxGrid) {
    showToast('请输入发射和接收方网格坐标', 'warning');
    return;
  }

  // 解析网格坐标
  const txCoord = GeoService.gridToLatLon(txGrid) as LatLon | null;
  const rxCoord = GeoService.gridToLatLon(rxGrid) as LatLon | null;
  if (!txCoord) { showToast('发射方网格坐标格式错误', 'error'); return; }
  if (!rxCoord) { showToast('接收方网格坐标格式错误', 'error'); return; }

  // 计算距离
  const { distance } = GeoService.calcDistanceBearing(txCoord.lat, txCoord.lon, rxCoord.lat, rxCoord.lon);

  // 估算foF2
  const foF2 = Voacap.estimateFoF2(sfi, hourUTC, (txCoord.lat + rxCoord.lat) / 2);

  // 运行预测
  const result = Voacap.predictPropagation({
    foF2, distance, txPower, freqMHz, solarFlux: sfi, hourUTC, gain_dBi: gainDbi
  }) as PropagationResult;

  // 推荐频段
  const recommendations = Voacap.recommendBands(parseFloat(result.muf), parseFloat(result.luf), BANDS as Band[]) as BandRecommendation[];

  // 渲染结果
  renderResult(result, distance, txCoord, rxCoord, recommendations);
}

/**
 * 渲染预测结果
 */
function renderResult(result: PropagationResult, distance: number, txCoord: LatLon, rxCoord: LatLon, recommendations: BandRecommendation[]): void {
  const el = $('voacapResult') as HTMLElement | null;
  if (!el) return;

  const qualityColor: Record<string, string> = { '优': '#27ae60', '良': '#2ecc71', '一般': '#f39c12', '差': '#e74c3c' };
  const color = qualityColor[result.quality] || '#333';

  el.innerHTML = `
    <div class="voacap-summary">
      <h4>传播预测结果</h4>
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
        ${recommendations.slice(0, 5).map((r: BandRecommendation) => `
          <tr><td>${r.band}</td><td>${r.freq} MHz</td><td>${r.score}/100</td></tr>
        `).join('')}
      </table>
    </div>` : '<p>当前条件下无合适频段</p>'}
  `;
}

/**
 * 清空预测结果
 */
export function clearPrediction(): void {
  const el = $('voacapResult') as HTMLElement | null;
  if (el) el.innerHTML = '';
  const inputs: string[] = ['voacapTxGrid', 'voacapRxGrid', 'voacapFreq', 'voacapTxPower', 'voacapSfi', 'voacapHour', 'voacapGain'];
  inputs.forEach((id: string) => {
    const inp = $(id) as HTMLInputElement | null;
    if (inp) inp.value = '';
  });
}

/**
 * 使用当前太阳数据填充SFI
 */
export function fillCurrentSfi(): void {
  // 尝试从太阳模块获取当前SFI
  const solarEl = $('solarSfi') as HTMLElement | null;
  if (solarEl && solarEl.textContent) {
    const sfiVal = parseFloat(solarEl.textContent);
    if (!isNaN(sfiVal)) {
      const sfiInput = $('voacapSfi') as HTMLInputElement | null;
      if (sfiInput) sfiInput.value = String(sfiVal);
      showToast(`已填充SFI: ${sfiVal}`, 'info');
      return;
    }
  }
  showToast('无法获取当前SFI，请手动输入', 'warning');
}