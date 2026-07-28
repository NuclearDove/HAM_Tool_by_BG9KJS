/**
 * HAM Radio Toolbox - 卫星跟踪UI模块
 * 双API自选架构：WTIA免费API(仅ISS) / N2YO高级API(需Key)
 * 用户手动选择数据源，无本地轨道计算
 * @module ham-satellite
 */
'use strict';

import * as SatService from './services/satellite-service.js';
import * as GeoService from './services/geo-service.js';
import { showToast } from './ham-toast.js';
import { latLonToGrid } from './core.js';
import type { SatelliteInfo, WtiaPosition, N2yoPosition, LookAngle, SatPass, SatApiSource } from './types.js';

const $ = (id: string): HTMLElement | null => document.getElementById(id);

let initialized = false;
let currentSat: SatelliteInfo | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化卫星跟踪模块
 */
export function init(): void {
  if (initialized) return;
  populateSatSelect();
  loadApiKey();
  loadApiSource();
  initialized = true;
}

/**
 * 填充卫星下拉框
 */
function populateSatSelect(): void {
  const sel = $('satSelect') as HTMLSelectElement | null;
  if (!sel) return;
  const sats = SatService.getPopularSatellites();
  sats.forEach((sat, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = sat.name;
    sel.appendChild(opt);
  });
}

/**
 * 加载已保存的API Key
 */
function loadApiKey(): void {
  const input = $('satApiKey') as HTMLInputElement | null;
  if (input) input.value = SatService.getApiKey();
}

/**
 * 加载已保存的API数据源选择
 */
function loadApiSource(): void {
  const sel = $('satApiSource') as HTMLSelectElement | null;
  if (!sel) return;
  sel.value = SatService.getApiSource();
  updateApiSourceHint();
}

/**
 * 更新API数据源提示
 */
function updateApiSourceHint(): void {
  const hint = $('satApiHint');
  if (!hint) return;
  const source = SatService.getApiSource();
  if (source === 'wtia') {
    hint.textContent = 'WTIA免费API仅支持ISS，其他卫星请选择N2YO';
    hint.style.color = '#2196F3';
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
export function switchApiSource(): void {
  const sel = $('satApiSource') as HTMLSelectElement | null;
  if (!sel) return;
  const source = sel.value;
  SatService.setApiSource(source as SatApiSource);
  updateApiSourceHint();

  // 如果当前有选中的卫星，重新更新位置
  if (currentSat) {
    updatePosition();
  }
}

/**
 * 选择卫星
 */
export function selectSatellite(): void {
  const sel = $('satSelect') as HTMLSelectElement | null;
  if (!sel || !sel.value) {
    currentSat = null;
    stopTracking();
    return;
  }
  const sats = SatService.getPopularSatellites();
  const sat = sats[parseInt(sel.value)];
  if (!sat) return;

  currentSat = sat;

  // 检查API数据源是否支持当前卫星
  const source = SatService.getApiSource();
  if (source === 'wtia' && !SatService.isWtiaSupported(sat.noradId)) {
    showToast('WTIA仅支持ISS，请切换到N2YO数据源', 'warning');
  }

  const modeLabel = source === 'wtia' ? 'WTIA免费API' : 'N2YO高级API';
  showToast(`已选择: ${sat.name} (${modeLabel})`, 'info');
  updatePosition();
  startTracking();
}

/**
 * 保存API Key
 */
export function saveApiKey(): void {
  const input = $('satApiKey') as HTMLInputElement | null;
  if (!input) return;
  const key = input.value.trim();
  SatService.setApiKey(key);

  // 如果选择了N2YO但没Key，提示
  if (SatService.getApiSource() === 'n2yo' && !key) {
    showToast('N2YO需要API Key，请前往 https://www.n2yo.com/api/ 免费注册', 'warning');
  } else {
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
function startTracking(): void {
  stopTracking();
  updateInterval = setInterval(updatePosition, 5000);
}

/**
 * 停止实时跟踪
 */
function stopTracking(): void {
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
async function updatePosition(): Promise<void> {
  if (!currentSat) return;
  const el = $('satPosition');
  if (!el) return;

  const source = SatService.getApiSource();

  // 获取观测者位置
  const obsGrid = ($('satObsGrid') as HTMLInputElement | null)?.value?.trim() || '';
  let obsLat = 39.9, obsLon = 116.4;
  if (obsGrid) {
    const coord = GeoService.gridToLatLon(obsGrid);
    if (!coord) {
      el.innerHTML = '<p style="color:#e74c3c">网格坐标格式错误，请输入有效的Maidenhead坐标（如 OM89）</p>';
      return;
    }
    obsLat = coord.lat; obsLon = coord.lon;
  } else {
    el.innerHTML = '<p style="color:#888">请输入观测者网格坐标以计算仰角和方位角</p>';
  }

  // WTIA免费API
  if (source === 'wtia') {
    if (!SatService.isWtiaSupported(currentSat.noradId)) {
      el.innerHTML = '<p style="color:#e74c3c">WTIA仅支持ISS，请切换到N2YO数据源跟踪此卫星</p>';
      return;
    }
    try {
      const wtiaData = await SatService.fetchWtiaPosition(currentSat.noradId);
      if (wtiaData && (wtiaData as any)._error) {
        const errMsg = (wtiaData as any)._error === '请求超时' ? 'WTIA API请求超时，请稍后重试' : 'WTIA API请求失败，请检查网络连接';
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
    } catch (e: any) {
      console.warn('[HAM] WTIA API failed:', e.message);
    }
    el.innerHTML = '<p style="color:#e74c3c">WTIA API请求失败，请检查网络连接</p>';
    showToast('WTIA API请求失败，请检查网络连接', 'error');
    return;
  }

  // N2YO高级API
  if (source === 'n2yo') {
    if (!SatService.hasApiKey()) {
      el.innerHTML = '<p style="color:#e74c3c">请先配置N2YO API Key（<a href="https://www.n2yo.com/api/" target="_blank" style="color:#1a237e">免费注册</a>）</p>';
      return;
    }
    try {
      const n2yoData = await SatService.fetchSatPosition(currentSat.noradId, obsLat, obsLon, 0, 0);
      if (n2yoData && (n2yoData as any)._error) {
        const errMsg = (n2yoData as any)._error === '请求超时' ? 'N2YO API请求超时，请稍后重试' : 'N2YO API请求失败，请检查API Key和网络连接';
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
    } catch (e: any) {
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
function renderWtiaPosition(el: HTMLElement, pos: WtiaPosition, look: LookAngle, obsGrid: string): void {
  const dirLabel = (az: number): string => {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return dirs[Math.round(az / 45) % 8];
  };
  const elevColor = look.elevation > 0 ? '#27ae60' : '#e74c3c';
  const visLabel = ({ daylight: '日照区', eclipse: '阴影区', unknown: '未知' } as Record<string, string>)[pos.visibility] || pos.visibility;
  el.innerHTML = `
    <div class="sat-info">
      <div class="sat-row"><label>纬度:</label><span>${pos.lat.toFixed(4)}°</span></div>
      <div class="sat-row"><label>经度:</label><span>${pos.lon.toFixed(4)}°</span></div>
      <div class="sat-row"><label>高度:</label><span>${pos.alt.toFixed(1)} km</span></div>
      <div class="sat-row"><label>速度:</label><span>${pos.vel.toFixed(2)} km/s</span></div>
      <div class="sat-row"><label>可见性:</label><span>${visLabel}</span></div>
      <div class="sat-row"><label>足迹:</label><span>${pos.footprint.toFixed(0)} km</span></div>
    </div>
    <div class="sat-look">
      <h5>观测参数 (观测者: ${obsGrid || '北京'})</h5>
      <div class="sat-row"><label>仰角:</label><span style="color:${elevColor}">${look.elevation.toFixed(1)}°</span></div>
      <div class="sat-row"><label>方位角:</label><span>${look.azimuth.toFixed(1)}° (${dirLabel(look.azimuth)})</span></div>
      <div class="sat-row"><label>距离:</label><span>${look.distance.toFixed(0)} km</span></div>
    </div>
    <p style="font-size:11px;color:#2196F3;margin-top:6px">✓ WTIA免费API 实时数据（无需API Key）| 更新时间: ${new Date().toLocaleTimeString()}</p>
  `;
}

/**
 * 渲染N2YO高级API的位置数据
 */
function renderN2yoPosition(el: HTMLElement, pos: N2yoPosition, obsGrid: string): void {
  const dirLabel = (az: number): string => {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return dirs[Math.round(az / 45) % 8];
  };
  const elevColor = pos.elevation > 0 ? '#27ae60' : '#e74c3c';
  el.innerHTML = `
    <div class="sat-info">
      <div class="sat-row"><label>纬度:</label><span>${pos.lat.toFixed(4)}°</span></div>
      <div class="sat-row"><label>经度:</label><span>${pos.lon.toFixed(4)}°</span></div>
      <div class="sat-row"><label>高度:</label><span>${pos.alt.toFixed(1)} km</span></div>
      <div class="sat-row"><label>速度:</label><span>${pos.vel.toFixed(2)} km/s</span></div>
    </div>
    <div class="sat-look">
      <h5>观测参数 (观测者: ${obsGrid || '北京'})</h5>
      <div class="sat-row"><label>仰角:</label><span style="color:${elevColor}">${pos.elevation.toFixed(1)}°</span></div>
      <div class="sat-row"><label>方位角:</label><span>${pos.azimuth.toFixed(1)}° (${dirLabel(pos.azimuth)})</span></div>
      <div class="sat-row"><label>距离:</label><span>${pos.distance.toFixed(0)} km</span></div>
    </div>
    <p style="font-size:11px;color:#27ae60;margin-top:6px">✓ N2YO高级API 实时数据 | 更新时间: ${new Date().toLocaleTimeString()}</p>
  `;
}

// ============================================================
// 过境预测（仅N2YO支持）
// ============================================================

/**
 * 预测过境
 */
export async function predictPasses(): Promise<void> {
  if (!currentSat) {
    showToast('请先选择卫星', 'warning');
    return;
  }

  const source = SatService.getApiSource();
  const el = $('satPasses');
  if (!el) return;

  // WTIA不提供过境预测
  if (source === 'wtia') {
    el.innerHTML = '<p style="color:#e74c3c">WTIA不支持过境预测，请切换到N2YO数据源</p>';
    return;
  }

  // N2YO需要API Key
  if (!SatService.hasApiKey()) {
    el.innerHTML = '<p style="color:#e74c3c">过境预测需要N2YO API Key（<a href="https://www.n2yo.com/api/" target="_blank" style="color:#1a237e">免费注册</a>）</p>';
    return;
  }

  const obsGrid = ($('satObsGrid') as HTMLInputElement | null)?.value?.trim() || '';
  let obsLat = 39.9, obsLon = 116.4;
  if (obsGrid) {
    const coord = GeoService.gridToLatLon(obsGrid);
    if (!coord) {
      el.innerHTML = '<p style="color:#e74c3c">网格坐标格式错误，请输入有效的Maidenhead坐标（如 OM89）</p>';
      return;
    }
    obsLat = coord.lat; obsLon = coord.lon;
  }
  const minElev = parseFloat(($('satMinElev') as HTMLInputElement | null)?.value || '') || 10;

  el.innerHTML = '<p style="color:#888">正在计算过境预测...</p>';

  try {
    const n2yoData = await SatService.fetchSatPasses(currentSat.noradId, obsLat, obsLon, 0, 1, minElev);
    if (n2yoData && (n2yoData as any)._error) {
      const errMsg = (n2yoData as any)._error === '请求超时' ? '过境预测请求超时，请稍后重试' : '过境预测请求失败，请检查API Key和网络连接';
      el.innerHTML = '<p style="color:#e74c3c">' + errMsg + '</p>';
      showToast(errMsg, 'error');
      return;
    }
    if (n2yoData && (n2yoData as any).passes) {
      const passes = SatService.parseN2yoPasses(n2yoData);
      renderPasses(el, passes, minElev);
      return;
    }
  } catch (e: any) {
    console.warn('[HAM] N2YO passes API failed:', e.message);
  }

  el.innerHTML = '<p style="color:#e74c3c">过境预测请求失败，请检查API Key和网络连接</p>';
  showToast('过境预测请求失败，请检查API Key和网络连接', 'error');
}

/**
 * 渲染过境预测结果
 */
function renderPasses(el: HTMLElement, passes: SatPass[], minElev: number): void {
  if (!passes.length) {
    el.innerHTML = '<p style="color:#888">未来24小时内无可见过境（仰角 ≥ ' + minElev + '°）</p>';
    return;
  }
  const fmt = (d: Date): string => d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  let html = `<p>找到 ${passes.length} 次过境（仰角 ≥ ${minElev}°）<span style="color:#27ae60;font-size:11px"> ✓ N2YO高级API</span></p>`;
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
export function clearSatellite(): void {
  currentSat = null;
  stopTracking();
  const posEl = $('satPosition');
  if (posEl) posEl.innerHTML = '';
  const passEl = $('satPasses');
  if (passEl) passEl.innerHTML = '<p style="color:#888">选择卫星后点击"预测过境"查看未来24小时可见过境。</p>';
  const sel = $('satSelect') as HTMLSelectElement | null;
  if (sel) sel.value = '';
}

/**
 * 使用浏览器定位获取当前网格坐标，填入观测者网格输入框
 */
export function getMyLocation(): void {
  if (!navigator.geolocation) {
    showToast('此浏览器不支持定位功能', 'warning');
    return;
  }
  showToast('正在获取位置...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const grid = latLonToGrid(lat, lon);
      if (grid) {
        const input = $('satObsGrid') as HTMLInputElement | null;
        if (input) input.value = grid.substring(0, 6);
        showToast('定位成功: ' + grid.substring(0, 6) + ' (' + lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°)', 'success');
      } else {
        showToast('定位成功但无法转换为网格坐标', 'warning');
      }
    },
    (err: GeolocationPositionError) => {
      const msgs: Record<number, string> = {
        1: '定位权限被拒绝，请在浏览器设置中允许定位权限',
        2: '无法获取位置信息，请检查设备定位服务',
        3: '定位请求超时，请重试'
      };
      showToast(msgs[err.code] || ('定位失败: ' + err.message), 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// ============================================================
// Toast提示（简易实现，依赖app.js中的全局toast）
// ============================================================

function showToast(msg: string, type: string = 'info'): void {
  // 尝试使用全局toast函数
  if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}