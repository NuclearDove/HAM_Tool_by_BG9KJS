/**
 * HAM Radio Toolbox - 射频工具 Tab 模块 (ES Module)
 * 包含天线计算、功率转换、SWR计算、馈线损耗
 * @module ham-rf
 */
'use strict';

import type { DipoleResult, CoaxTypes } from './types.js';
import { COAX_TYPES, freqToBand, wavelength, dipoleLength, quarterWaveLength, wattsToDbm, wattsToDbw, dbmToWatts, dbwToWatts, dbmToDbw, swrFromPower, swrToReflectPower, coaxAttenuation, populateSelect } from './core.js';
import { EventBus } from './event-bus.js';

function antennaCalc(): void {
  const f = parseFloat((document.getElementById('antFreq') as HTMLInputElement).value);
  if (isNaN(f) || f <= 0) { (document.getElementById('antResult') as HTMLElement).textContent = '请输入有效频率。'; return; }
  const wl = wavelength(f);
  const dip = dipoleLength(f) as DipoleResult;
  const qw = quarterWaveLength(f);
  const band = freqToBand(f);
  const lines: string[] = [];
  lines.push('频率: ' + f + ' MHz');
  lines.push('波长: ' + (wl*100).toFixed(2) + ' cm (' + wl.toFixed(4) + ' m)');
  if (band) lines.push('业余频段: ' + band.name + ' (' + band.f_low + '-' + band.f_high + ' MHz)');
  lines.push('\n--- 半波偶极天线 ---');
  lines.push('总长: ' + (dip.halfWave*100).toFixed(1) + ' cm (' + dip.halfWave.toFixed(4) + ' m)');
  lines.push('每臂: ' + (dip.eachLeg*100).toFixed(1) + ' cm (' + dip.eachLeg.toFixed(4) + ' m)');
  lines.push('(含0.95缩短因子)');
  lines.push('\n--- 四分之一波长垂直/天线 ---');
  lines.push('长度: ' + (qw*100).toFixed(1) + ' cm (' + qw.toFixed(4) + ' m)');
  lines.push('(含0.95缩短因子)');
  (document.getElementById('antResult') as HTMLElement).textContent = lines.join('\n');
  EventBus.emit('status', '天线计算完成');
}

function powerConvert(): void {
  const val = parseFloat((document.getElementById('powVal') as HTMLInputElement).value);
  const unit = (document.getElementById('powUnit') as HTMLSelectElement).value;
  if (isNaN(val)) { (document.getElementById('powResult') as HTMLElement).textContent = '请输入有效数值。'; return; }
  const lines: string[] = [];
  if (unit === 'W') {
    if (val <= 0) { (document.getElementById('powResult') as HTMLElement).textContent = '功率必须大于0。'; return; }
    lines.push(val + ' W = ' + wattsToDbm(val).toFixed(2) + ' dBm');
    lines.push(val + ' W = ' + wattsToDbw(val).toFixed(2) + ' dBW');
  } else if (unit === 'dBm') {
    const w = dbmToWatts(val);
    lines.push(val + ' dBm = ' + (w < 0.001 ? w.toExponential(4) : w < 1 ? w.toFixed(6) : w.toFixed(4)) + ' W');
    lines.push(val + ' dBm = ' + dbmToDbw(val).toFixed(2) + ' dBW');
  } else {
    const w2 = dbwToWatts(val);
    lines.push(val + ' dBW = ' + (w2 < 0.001 ? w2.toExponential(4) : w2 < 1 ? w2.toFixed(6) : w2.toFixed(4)) + ' W');
    lines.push(val + ' dBW = ' + (val + 30).toFixed(2) + ' dBm');
  }
  (document.getElementById('powResult') as HTMLElement).textContent = lines.join('\n');
  EventBus.emit('status', '功率转换完成');
}

function swrFromPowerUI(): void {
  const fw = parseFloat((document.getElementById('swrFw') as HTMLInputElement).value);
  const rw = parseFloat((document.getElementById('swrRw') as HTMLInputElement).value);
  if (isNaN(fw) || isNaN(rw) || fw <= 0) { (document.getElementById('swrResult') as HTMLElement).textContent = '请输入有效功率值。'; return; }
  const swr = swrFromPower(fw, rw);
  if (!swr) { (document.getElementById('swrResult') as HTMLElement).textContent = '反射功率必须 ≥ 0 且 < 正向功率。'; return; }
  const refl = Math.sqrt(rw / fw);
  const retLoss = -20 * Math.log10(refl);
  const lines = ['正向功率: ' + fw + ' W', '反射功率: ' + rw + ' W', '', 'SWR: ' + swr.toFixed(3) + ' : 1', '反射系数: ' + (refl*100).toFixed(2) + '%', '回波损耗: ' + (isFinite(retLoss) ? retLoss.toFixed(2) : '∞') + ' dB'];
  if (swr <= 1.5) lines.push('\n✅ SWR良好 (≤1.5)');
  else if (swr <= 3) lines.push('\n⚠️ SWR偏高 (1.5-3.0)，建议调整天线');
  else lines.push('\n❌ SWR过高 (>3.0)，可能损坏设备！');
  (document.getElementById('swrResult') as HTMLElement).textContent = lines.join('\n');
}

function swrToReflect(): void {
  const swr = parseFloat((document.getElementById('swrVal') as HTMLInputElement).value);
  const fw = parseFloat((document.getElementById('swrFw2') as HTMLInputElement).value);
  if (isNaN(swr) || isNaN(fw) || swr < 1 || fw <= 0) { (document.getElementById('swrResult') as HTMLElement).textContent = 'SWR必须≥1，正向功率必须>0。'; return; }
  const rw = swrToReflectPower(swr, fw);
  if (rw === null) { (document.getElementById('swrResult') as HTMLElement).textContent = '计算错误'; return; }
  const refl = (swr - 1) / (swr + 1);
  const retLoss = -20 * Math.log10(refl);
  const lines = ['SWR: ' + swr.toFixed(3) + ' : 1', '正向功率: ' + fw + ' W', '', '反射功率: ' + rw.toFixed(4) + ' W', '反射系数: ' + (refl*100).toFixed(2) + '%', '回波损耗: ' + (isFinite(retLoss) ? retLoss.toFixed(2) : '∞') + ' dB', '效率: ' + ((1-refl*refl)*100).toFixed(2) + '%'];
  (document.getElementById('swrResult') as HTMLElement).textContent = lines.join('\n');
}

function initCoaxSelect(): void {
  const sel = document.getElementById('coaxType') as HTMLSelectElement | null;
  if (!sel) return;
  Object.keys(COAX_TYPES as CoaxTypes).forEach((k: string) => {
    const o = document.createElement('option') as HTMLOptionElement;
    o.value = k; o.textContent = k;
    sel.appendChild(o);
  });
  const tbody = document.querySelector('#coaxRefTable tbody') as HTMLTableSectionElement | null;
  if (!tbody) return;
  tbody.innerHTML = Object.entries(COAX_TYPES as CoaxTypes).map(([name, d]) =>
    '<tr><td>' + name + '</td><td>' + (d[100]||'-') + '</td><td>' + (d[400]||'-') + '</td><td>' + (d[1000]||'-') + '</td></tr>'
  ).join('');
}

function coaxCalc(): void {
  const type = (document.getElementById('coaxType') as HTMLSelectElement).value;
  const freq = parseFloat((document.getElementById('coaxFreq') as HTMLInputElement).value);
  const len = parseFloat((document.getElementById('coaxLen') as HTMLInputElement).value);
  if (isNaN(freq) || isNaN(len) || freq <= 0 || len <= 0) { (document.getElementById('coaxResult') as HTMLElement).textContent = '请输入有效频率和长度。'; return; }
  const atten = coaxAttenuation(type, freq, len);
  if (atten === null) { (document.getElementById('coaxResult') as HTMLElement).textContent = '无法计算。'; return; }
  const pLoss = Math.pow(10, atten / 10);
  const lines = ['馈线: ' + type, '频率: ' + freq + ' MHz', '长度: ' + len + ' m', '', '衰减: ' + atten.toFixed(2) + ' dB', '功率损失: ' + ((1-1/pLoss)*100).toFixed(2) + '%', '剩余功率: ' + (1/pLoss*100).toFixed(2) + '%'];
  (document.getElementById('coaxResult') as HTMLElement).textContent = lines.join('\n');
  EventBus.emit('status', '馈线损耗计算完成');
}

function init(): void { initCoaxSelect(); }

export { antennaCalc, powerConvert, swrFromPowerUI as swrFromPower, swrToReflect, coaxCalc, init };