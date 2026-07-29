/**
 * HAM Radio Toolbox - 太阳通量实时曲线模块
 * 从NOAA/SWPC获取太阳活动数据，Canvas绘制趋势曲线
 * @module ham-solar
 */
'use strict';

import { escHtml } from './core.js';
import type { SolarData, SolarHistoryPoint } from './types.js';

// ============================================================
// 常量
// ============================================================
const SOLAR_CHART_W = 700;
const SOLAR_CHART_H = 300;
const SOLAR_PADDING = { top: 30, right: 20, bottom: 40, left: 55 };

// 数据源：使用 NOAA SWPC 的 JSON API
const NOAA_APIS = {
  sfi: 'https://services.swpc.noaa.gov/json/f107_cm_flux.json',
  sn: 'https://services.swpc.noaa.gov/json/sunspot_report.json',
  kIndex: 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  regions: 'https://services.swpc.noaa.gov/json/solar_regions.json'
};

// 加载状态
let solarLoading = false;

// Canvas引用
let solarCanvas: HTMLCanvasElement | null = null;
let solarCtx: CanvasRenderingContext2D | null = null;

// ============================================================
// 数据获取
// ============================================================

/**
 * 获取太阳活动数据
 * 从NOAA SWPC获取实时数据，失败则使用localStorage缓存，无缓存时返回null
 */
async function fetchSolarData(): Promise<SolarData | null> {
  const statusEl = document.getElementById('solarStatus');
  if (statusEl) statusEl.textContent = '正在获取数据...';

  // 请求超时控制（15秒）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // 请求辅助函数：fetch + JSON解析 + 超时/HTTP错误处理
    const fetchJson = (url: string) => fetch(url, { cache: 'no-cache', signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(e => { if (e.name === 'AbortError') throw new Error('请求超时'); throw e; });
    // 并行请求4个NOAA SWPC API
    const [sfiRes, snRes, kRes, regRes] = await Promise.allSettled([
      fetchJson(NOAA_APIS.sfi),
      fetchJson(NOAA_APIS.sn),
      fetchJson(NOAA_APIS.kIndex),
      fetchJson(NOAA_APIS.regions)
    ]);

    // 提取SFI (F10.7cm太阳射电流量)
    let sfi = 0;
    let sfiHistory: SolarHistoryPoint[] = [];
    if (sfiRes.status === 'fulfilled' && Array.isArray(sfiRes.value) && sfiRes.value.length > 0) {
      sfi = Math.round(parseFloat(sfiRes.value[0].flux));
      // 构建SFI历史数据（NOAA返回按时间倒序，需反转为正序）
      sfiHistory = (sfiRes.value as any[])
        .filter((d: any) => d.flux && !isNaN(parseFloat(d.flux)))
        .map((d: any) => ({
          sfi: Math.round(parseFloat(d.flux)),
          sn: 0, // NOAA SFI接口不含SN数据
          time: new Date(d.time_tag).getTime()
        }))
        .reverse();
    }

    // 提取SN (太阳黑子数) - 从sunspot_report计算每日Wolf数
    // sunspot_report.json是逐区域报告，需按天聚合计算Wolf公式: SN = 10×群数 + 个数
    let sn = 0;
    let snHistory: Array<{ sn: number; time: number }> = [];
    if (snRes.status === 'fulfilled' && Array.isArray(snRes.value) && snRes.value.length > 0) {
      const reports = snRes.value as any[];
      // 按观测日期(Obsdate)分组
      const byDay = new Map<string, any[]>();
      reports.forEach((d: any) => {
        const dayKey = (d.Obsdate || '').slice(0, 10);
        if (!dayKey) return;
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey)!.push(d);
      });
      // 每天选最佳台站观测数据计算Wolf数
      const dailySn: Array<{ sn: number; time: number }> = [];
      byDay.forEach((dayReports: any[], dayKey: string) => {
        // 按台站分组，选报告最多的台站（最完整观测）
        const byStation = new Map<number | string, any[]>();
        dayReports.forEach((r: any) => {
          const station = r.Station || r.Observatory || 0;
          if (!byStation.has(station)) byStation.set(station, []);
          byStation.get(station)!.push(r);
        });
        let bestStation: number | string = 0;
        let bestCount = 0;
        byStation.forEach((sReports: any[], station: number | string) => {
          if (sReports.length > bestCount) { bestCount = sReports.length; bestStation = station; }
        });
        const stationReports = byStation.get(bestStation) || [];
        // 统计群数(g)和个数(s): Region非null为已编号群，null各自独立
        const regions = new Set<number>();
        let nullCount = 0;
        let totalSpots = 0;
        stationReports.forEach((r: any) => {
          if (r.Region === null || r.Region === undefined) { nullCount++; }
          else { regions.add(r.Region); }
          totalSpots += (parseInt(r.Numspot) || 0);
        });
        const groups = regions.size + nullCount;
        const wolfNumber = 10 * groups + totalSpots;
        dailySn.push({ sn: wolfNumber, time: new Date(dayKey + 'T00:00:00Z').getTime() });
      });
      // 按时间正序排列
      dailySn.sort((a, b) => a.time - b.time);
      // 当前SN取最新一天
      if (dailySn.length > 0) { sn = dailySn[dailySn.length - 1].sn; }
      snHistory = dailySn;
    }

    // 提取K指数和估算A指数
    let kIndex = 0;
    let aIndex = 0;
    if (kRes.status === 'fulfilled' && Array.isArray(kRes.value) && kRes.value.length > 0) {
      const kpVal = parseFloat((kRes.value as any[])[0].estimated_kp);
      if (!isNaN(kpVal)) {
        kIndex = Math.round(kpVal);
        // A指数估算：Ap ≈ Kp × 4（简化公式）
        aIndex = Math.round(kpVal * 4);
      }
    }

    // 提取SN (太阳黑子数) - 优先使用SN API，regions API作为备选
    // sn 已在上面从 SN API 提取，若API不可用则从活跃区域估算
    if (sn === 0 && regRes.status === 'fulfilled' && Array.isArray(regRes.value)) {
      const today = new Date().toISOString().slice(0, 10);
      // 筛选今日活跃区域（排除已消失的'd'状态）
      const activeRegions = (regRes.value as any[]).filter((r: any) =>
        r.observed_date === today && r.status !== 'd'
      );
      const groups = activeRegions.length;
      const spots = activeRegions.reduce((sum: number, r: any) => sum + (parseInt(r.number_spots) || 0), 0);
      // Wolf公式: SN = 10 × 群数 + 个数
      sn = 10 * groups + spots;
    }

    // 至少需要SFI数据才算成功
    if (sfi === 0 && sfiRes.status !== 'fulfilled') {
      throw new Error('SFI数据不可用');
    }

    const result: SolarData = {
      sfi: sfi,
      sn: sn,
      aIndex: aIndex,
      kIndex: kIndex,
      xClass: '',
      timestamp: new Date().toISOString()
    };

    if (statusEl) statusEl.textContent = '数据更新于 ' + new Date().toLocaleTimeString() + ' (NOAA/SWPC)';

    // 保存当前数据点
    saveSolarData(result);
    // 将NOAA历史数据合并到localStorage
    if (sfiHistory.length > 0 || snHistory.length > 0) {
      mergeSfiHistory(sfiHistory, snHistory);
    }

    clearTimeout(timeoutId);
    return result;

  } catch(err: any) {
    clearTimeout(timeoutId);
    console.warn('[HAM] Solar API fetch failed:', err.message);
    if (statusEl) statusEl.textContent = 'API不可用，尝试本地缓存...';

    // 尝试使用缓存
    const cached = loadSolarHistory();
    if (cached && cached.length > 0) {
      if (statusEl) statusEl.textContent = 'API不可用，使用本地缓存 (' + new Date(cached[cached.length - 1].time).toLocaleString() + ')';
      // 从历史数据构造SolarData
      const last = cached[cached.length - 1];
      return { sfi: last.sfi, sn: last.sn, aIndex: 0, kIndex: 0, xClass: '', timestamp: new Date(last.time).toISOString() };
    }

    // 无缓存，返回null表示无真实数据可用
    if (statusEl) statusEl.textContent = 'API不可用且无本地缓存，请检查网络后重试';
    return null;
  }
}

/**
 * 保存太阳数据到localStorage历史记录
 */
function saveSolarData(data: SolarData): void {
  let history = loadSolarHistory();
  if (!history) history = [];

  // 防止重复：若最近1小时内已有数据点则更新而非追加
  const now = Date.now();
  const oneHour = 3600000;
  const recentIdx = history.findIndex(d => (now - d.time) < oneHour);
  if (recentIdx >= 0) {
    // 更新最近的数据点
    history[recentIdx].sfi = data.sfi;
    history[recentIdx].sn = data.sn;
    history[recentIdx].time = now;
  } else {
    // 添加新数据点
    history.push({
      sfi: data.sfi,
      sn: data.sn,
      time: now
    });
  }

  // 只保留最近30天的数据（每15分钟一个点，最多2880个）
  if (history.length > 2880) {
    history = history.slice(history.length - 2880);
  }

  try {
    localStorage.setItem('ham_solar_history', JSON.stringify(history));
  } catch(_e) {
    // localStorage满，清理旧数据
    history = history.slice(history.length - 500);
    try { localStorage.setItem('ham_solar_history', JSON.stringify(history)); } catch(_e2) {}
  }
}

/**
 * 从localStorage加载历史数据
 */
function loadSolarHistory(): SolarHistoryPoint[] | null {
  try {
    const raw = localStorage.getItem('ham_solar_history');
    if (!raw) return null;
    return JSON.parse(raw) as SolarHistoryPoint[];
  } catch(_e) {
    return null;
  }
}

/**
 * 将NOAA SFI和SN历史数据合并到localStorage
 * 避免重复数据点，保留本地已有的额外字段
 */
function mergeSfiHistory(noaaHistory: SolarHistoryPoint[], noaaSnHistory?: Array<{ sn: number; time: number }>): void {
  let local = loadSolarHistory() || [];

  // 建立本地时间索引（精确到小时）
  const localTimes = new Set(local.map(d => Math.floor(d.time / 3600000)));

  // 合并NOAA SFI数据中本地不存在的数据点
  let added = 0;
  noaaHistory.forEach(d => {
    const hourKey = Math.floor(d.time / 3600000);
    if (!localTimes.has(hourKey)) {
      local.push(d);
      localTimes.add(hourKey);
      added++;
    }
  });

  // 合并NOAA SN历史数据到对应时间点的本地记录
  if (noaaSnHistory && noaaSnHistory.length > 0) {
    // 建立SN时间索引（精确到天）
    const snByDay = new Map<number, number>();
    noaaSnHistory.forEach(d => {
      const dayKey = Math.floor(d.time / 86400000);
      snByDay.set(dayKey, d.sn);
    });
    // 将SN数据填充到本地历史中同一天的数据点
    local.forEach(d => {
      if (d.sn === 0 || d.sn === undefined) {
        const dayKey = Math.floor(d.time / 86400000);
        if (snByDay.has(dayKey)) {
          d.sn = snByDay.get(dayKey)!;
        }
      }
    });
  }

  if (added > 0) {
    // 按时间排序
    local.sort((a, b) => a.time - b.time);
    // 限制最大数量
    if (local.length > 2880) {
      local = local.slice(local.length - 2880);
    }
    try {
      localStorage.setItem('ham_solar_history', JSON.stringify(local));
    } catch(_e) {
      // 忽略存储错误
    }
  }
}

// ============================================================
// 绘图
// ============================================================

/**
 * 绘制太阳通量趋势曲线
 */
function drawSolarChart(history: SolarHistoryPoint[] | null): void {
  if (!solarCtx) return;

  const dpr = window.devicePixelRatio || 1;
  solarCtx.save();
  solarCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = SOLAR_CHART_W;
  const H = SOLAR_CHART_H;
  const p = SOLAR_PADDING;
  const plotW = W - p.left - p.right;
  const plotH = H - p.top - p.bottom;

  // 清空
  solarCtx.fillStyle = '#fff';
  solarCtx.fillRect(0, 0, W, H);

  if (!history || history.length < 2) {
    solarCtx.fillStyle = '#888';
    solarCtx.font = '14px "Segoe UI", sans-serif';
    solarCtx.textAlign = 'center';
    if (history && history.length === 1) {
      solarCtx.fillText('已有1个数据点，需持续使用积累更多数据', W / 2, H / 2);
    } else {
      solarCtx.fillText('暂无历史数据，请持续使用以积累真实数据', W / 2, H / 2);
    }
    solarCtx.restore();
    return;
  }

  // 数据范围
  const sfiVals = history.map(d => d.sfi).filter(v => !isNaN(v) && v > 0);
  const snVals = history.map(d => d.sn).filter(v => !isNaN(v) && v >= 0);

  if (sfiVals.length < 2 && snVals.length < 2) {
    solarCtx.fillStyle = '#888';
    solarCtx.font = '14px "Segoe UI", sans-serif';
    solarCtx.textAlign = 'center';
    solarCtx.fillText('数据不足', W / 2, H / 2);
    solarCtx.restore();
    return;
  }

  const sfiMin = Math.min(...sfiVals) * 0.9;
  const sfiMax = Math.max(...sfiVals) * 1.1;
  const snMin = 0;
  const snRawMax = snVals.length > 0 ? Math.max(...snVals) : 0;
  const snMax = snRawMax > 0 ? snRawMax * 1.2 : 100;
  const hasSnData = snVals.length >= 2 && snRawMax > 0;

  // 绘图区域边框
  solarCtx.strokeStyle = '#ddd';
  solarCtx.lineWidth = 1;
  solarCtx.strokeRect(p.left, p.top, plotW, plotH);

  // Y轴 - SFI (左)
  solarCtx.fillStyle = '#1a237e';
  solarCtx.font = '11px Consolas, monospace';
  solarCtx.textAlign = 'right';
  const sfiSteps = 5;
  for (let i = 0; i <= sfiSteps; i++) {
    const val = sfiMin + (sfiMax - sfiMin) * i / sfiSteps;
    const y = p.top + plotH - (plotH * i / sfiSteps);
    solarCtx.fillText(Math.round(val).toString(), p.left - 5, y + 4);
    // 网格线
    solarCtx.beginPath();
    solarCtx.moveTo(p.left, y);
    solarCtx.lineTo(p.left + plotW, y);
    solarCtx.strokeStyle = '#f0f0f0';
    solarCtx.stroke();
  }

  // Y轴标签
  solarCtx.save();
  solarCtx.translate(12, p.top + plotH / 2);
  solarCtx.rotate(-Math.PI / 2);
  solarCtx.fillStyle = '#1a237e';
  solarCtx.font = 'bold 11px "Segoe UI", sans-serif';
  solarCtx.textAlign = 'center';
  solarCtx.fillText('SFI', 0, 0);
  solarCtx.restore();

  // Y轴 - SN (右)，仅在有有效SN数据时显示
  if (hasSnData) {
    solarCtx.fillStyle = '#c62828';
    solarCtx.font = '11px Consolas, monospace';
    solarCtx.textAlign = 'left';
    for (let i = 0; i <= sfiSteps; i++) {
      const val = snMin + (snMax - snMin) * i / sfiSteps;
      const y = p.top + plotH - (plotH * i / sfiSteps);
      solarCtx.fillText(Math.round(val).toString(), p.left + plotW + 5, y + 4);
    }

    solarCtx.save();
    solarCtx.translate(W - 8, p.top + plotH / 2);
    solarCtx.rotate(Math.PI / 2);
    solarCtx.fillStyle = '#c62828';
    solarCtx.font = 'bold 11px "Segoe UI", sans-serif';
    solarCtx.textAlign = 'center';
    solarCtx.fillText('SN', 0, 0);
    solarCtx.restore();
  }

  // X轴 - 日期
  solarCtx.fillStyle = '#555';
  solarCtx.font = '10px Consolas, monospace';
  solarCtx.textAlign = 'center';
  const n = history.length;
  const labelStep = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < n; i += labelStep) {
    const x = p.left + (plotW * i / (n - 1));
    const d = new Date(history[i].time);
    const label = (d.getMonth() + 1) + '/' + d.getDate();
    solarCtx.fillText(label, x, p.top + plotH + 18);
  }

  // 绘制SFI曲线
  if (sfiVals.length >= 2) {
    solarCtx.beginPath();
    solarCtx.strokeStyle = '#1a237e';
    solarCtx.lineWidth = 2;
    let started = false;
    let firstX = 0, lastX = 0;
    for (let i = 0; i < n; i++) {
      const v = history[i].sfi;
      if (isNaN(v) || v <= 0) continue;
      const x = p.left + (plotW * i / (n - 1));
      const y = p.top + plotH - plotH * (v - sfiMin) / (sfiMax - sfiMin);
      if (!started) { solarCtx.moveTo(x, y); firstX = x; started = true; }
      else solarCtx.lineTo(x, y);
      lastX = x;
    }
    solarCtx.stroke();

    // 填充区域：从最后绘制点垂直到基线，沿基线回到首点下方，闭合
    if (started) {
      solarCtx.lineTo(lastX, p.top + plotH);
      solarCtx.lineTo(firstX, p.top + plotH);
      solarCtx.closePath();
      solarCtx.fillStyle = 'rgba(26, 35, 126, 0.08)';
      solarCtx.fill();
    }
  }

  // 绘制SN曲线（仅在有有效SN数据时绘制）
  if (hasSnData) {
    solarCtx.beginPath();
    solarCtx.strokeStyle = '#c62828';
    solarCtx.lineWidth = 2;
    solarCtx.setLineDash([5, 3]);
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = history[i].sn;
      if (isNaN(v) || v < 0) continue;
      const x = p.left + (plotW * i / (n - 1));
      const y = p.top + plotH - plotH * (v - snMin) / (snMax - snMin);
      if (!started) { solarCtx.moveTo(x, y); started = true; }
      else solarCtx.lineTo(x, y);
    }
    solarCtx.stroke();
    solarCtx.setLineDash([]);
  }

  // 图例
  solarCtx.fillStyle = '#1a237e';
  solarCtx.font = 'bold 11px "Segoe UI", sans-serif';
  solarCtx.textAlign = 'left';
  solarCtx.fillRect(p.left + 10, p.top + 8, 20, 3);
  solarCtx.fillText('SFI (太阳通量指数)', p.left + 35, p.top + 14);

  // SN图例，仅在有有效SN数据时显示
  if (hasSnData) {
    solarCtx.fillStyle = '#c62828';
    solarCtx.setLineDash([5, 3]);
    solarCtx.beginPath();
    solarCtx.moveTo(p.left + 10, p.top + 26);
    solarCtx.lineTo(p.left + 30, p.top + 26);
    solarCtx.stroke();
    solarCtx.setLineDash([]);
    solarCtx.fillText('SN (太阳黑子数)', p.left + 35, p.top + 30);
  }

  solarCtx.restore();
}

/**
 * 更新太阳数据面板
 */
function updateSolarPanel(data: SolarData | null): void {
  const el = document.getElementById('solarValues');
  if (!el) return;

  if (!data) {
    el.innerHTML = '<div style="color:#888;font-size:13px;padding:8px">暂无太阳活动数据，请检查网络连接后重试</div>';
    return;
  }

  let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px">';
  html += '<div style="text-align:center;min-width:80px"><div style="font-size:11px;color:#888">SFI<br><span style="font-size:9px">Solar Flux Index</span></div><div id="solarSfi" style="font-size:22px;font-weight:700;color:#1a237e">' + escHtml(String(data.sfi)) + '</div></div>';
  html += '<div style="text-align:center;min-width:80px"><div style="font-size:11px;color:#888">Sn<br><span style="font-size:9px">Sunspot Number</span></div><div style="font-size:22px;font-weight:700;color:#c62828">' + escHtml(String(data.sn)) + '</div></div>';
  html += '<div style="text-align:center;min-width:80px"><div style="font-size:11px;color:#888">A<br><span style="font-size:9px">A-index</span></div><div style="font-size:22px;font-weight:700;color:#e65100">' + escHtml(String(data.aIndex)) + '</div></div>';
  html += '<div style="text-align:center;min-width:80px"><div style="font-size:11px;color:#888">K<br><span style="font-size:9px">K-index (Kp)</span></div><div style="font-size:22px;font-weight:700;color:#2e7d32">' + escHtml(String(data.kIndex)) + '</div></div>';
  if (data.xClass) {
    html += '<div style="text-align:center;min-width:80px"><div style="font-size:11px;color:#888">X<br><span style="font-size:9px">X-Ray Class</span></div><div style="font-size:16px;font-weight:700;color:#c62828">' + escHtml(data.xClass) + '</div></div>';
  }
  html += '</div>';

  // 传播条件评估
  let cond = '良好';
  let condColor = '#2e7d32';
  if (data.sfi < 70) { cond = '差'; condColor = '#c62828'; }
  else if (data.sfi < 100) { cond = '一般'; condColor = '#e65100'; }
  else if (data.sfi > 150) { cond = '优秀'; condColor = '#1a237e'; }

  html += '<div style="font-size:12px;padding:6px;background:' + condColor + '15;border:1px solid ' + condColor + '40;border-radius:4px;color:' + condColor + '">';
  html += '<b>HF传播条件: ' + cond + '</b>';
  if (data.sfi >= 100) html += ' — 高频段(20m-10m)开通概率高';
  else if (data.sfi >= 70) html += ' — 中低频段(40m-20m)可用';
  else html += ' — 仅低频段(80m-40m)可靠';
  html += '</div>';

  el.innerHTML = html;
}

// ============================================================
// 公共接口
// ============================================================

/**
 * 刷新太阳数据
 */
async function solarRefresh(): Promise<void> {
  if (solarLoading) return;
  solarLoading = true;

  try {
    const data = await fetchSolarData();
    
    if (data) {
      updateSolarPanel(data);
    } else {
      // 无真实数据可用
      const vel = document.getElementById('solarValues');
      if (vel) vel.innerHTML = '<div style="color:#888;font-size:13px;padding:8px">暂无太阳活动数据，请检查网络连接后重试</div>';
    }

    // 绘制曲线：仅使用localStorage中的真实历史数据
    let history = loadSolarHistory();
    if (history && history.length >= 2) {
      drawSolarChart(history);
    } else {
      // 无足够历史数据，显示积累提示
      drawSolarChart(null);
      const el = document.getElementById('solarStatus');
      if (el && data) {
        el.textContent = '数据已更新，历史曲线需持续使用积累（当前 ' + (history ? history.length : 0) + ' 个数据点）';
      }
    }
  } catch(err: any) {
    console.error('[HAM] Solar refresh error:', err);
    const el = document.getElementById('solarStatus');
    if (el) el.textContent = '获取失败: ' + err.message;
  } finally {
    solarLoading = false;
  }
}

/**
 * 清除太阳数据缓存
 */
function solarClearCache(): void {
  localStorage.removeItem('ham_solar_history');
  const el = document.getElementById('solarStatus');
  if (el) el.textContent = '缓存已清除';
  if (solarCtx) {
    const dpr = window.devicePixelRatio || 1;
    solarCtx.save();
    solarCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    solarCtx.fillStyle = '#fff';
    solarCtx.fillRect(0, 0, SOLAR_CHART_W, SOLAR_CHART_H);
    solarCtx.restore();
  }
  const vel = document.getElementById('solarValues');
  if (vel) vel.innerHTML = '';
}

// ============================================================
// 初始化
// ============================================================

/** 自动刷新间隔（30分钟） */
const SOLAR_REFRESH_INTERVAL = 30 * 60 * 1000;

function init(): void {
  solarCanvas = document.getElementById('solarCanvas') as HTMLCanvasElement | null;
  if (!solarCanvas) return;

  const dpr = window.devicePixelRatio || 1;
  solarCanvas.width = SOLAR_CHART_W * dpr;
  solarCanvas.height = SOLAR_CHART_H * dpr;
  solarCanvas.style.width = SOLAR_CHART_W + 'px';
  solarCanvas.style.height = SOLAR_CHART_H + 'px';

  solarCtx = solarCanvas.getContext('2d');

  // 绘制空图表
  drawSolarChart(null);

  // 自动加载一次
  solarRefresh();

  // 定时自动刷新
  setInterval(() => {
    // 仅在voacap tab可见时刷新
    const voacapTab = document.getElementById('tab-voacap');
    if (voacapTab && voacapTab.classList.contains('active')) {
      solarRefresh();
    }
  }, SOLAR_REFRESH_INTERVAL);

  console.log('[HAM] Solar Chart initialized');
}

// ============================================================
// 导出
// ============================================================

export {
  init,
  solarRefresh,
  solarClearCache
};