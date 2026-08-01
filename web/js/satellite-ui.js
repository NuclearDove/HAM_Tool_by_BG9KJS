/**
 * HAM Radio Toolbox - 卫星跟踪渲染模块
 * 纯UI渲染函数，不包含业务逻辑和状态管理
 * @module satellite-ui
 */
'use strict';
import { escHtml } from './core.js';
import * as SatService from './services/satellite-service.js?v=20260730';
// ============================================================
// 共享工具
// ============================================================
/**
 * 方位角转中文方向标签
 * @param {number} az - 方位角(度)
 * @returns {string} 方向标签
 */
export function dirLabel(az) {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return dirs[Math.round(az / 45) % 8];
}
// ============================================================
// 卫星列表渲染
// ============================================================
/**
 * 渲染卫星列表到面板
 * @param {HTMLElement} listEl - 列表容器
 * @param {Array} sats - 卫星数组 [{name, noradId}]
 * @param {function} onSelect - 选择回调 (name, noradId) => void
 */
export function renderSatList(listEl, sats, onSelect) {
    if (!listEl)
        return;
    if (sats.length === 0) {
        listEl.innerHTML = '<div style="color:#888;padding:8px;font-size:12px">无匹配卫星</div>';
        return;
    }
    listEl.innerHTML = sats.map(sat => `<div class="sat-item" data-norad="${sat.noradId}" data-name="${escHtml(sat.name)}" ` +
        `style="padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;` +
        `display:flex;justify-content:space-between;align-items:center" ` +
        `onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background=''">` +
        `<span><span class="sat-check" style="color:#2196F3;margin-right:4px;font-size:11px">☐</span>${escHtml(sat.name)}</span><span style="color:#888;font-size:11px">${sat.noradId}</span></div>`).join('');
    // 点击切换跟踪状态
    listEl.querySelectorAll('.sat-item').forEach(item => {
        item.addEventListener('click', () => {
            const noradId = parseInt(item.dataset.norad || '0');
            const name = item.dataset.name || '';
            if (onSelect)
                onSelect(name, noradId);
        });
    });
}
// ============================================================
// 位置数据渲染
// ============================================================
/**
 * 渲染WTIA免费API的位置数据
 * @param {HTMLElement} el - 容器元素
 * @param {object} pos - 位置数据 {lat, lon, alt, vel, visibility, footprint}
 * @param {object} look - 观测参数 {elevation, azimuth, distance}
 * @param {string} obsGrid - 观测者网格坐标
 */
export function renderWtiaPosition(el, pos, look, obsGrid) {
    const elevColor = look.elevation > 0 ? '#27ae60' : '#e74c3c';
    const visLabel = { daylight: '日照区', eclipse: '阴影区', unknown: '未知' }[pos.visibility] || pos.visibility;
    // 增量更新：已有结构时只更新数值
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
 * @param {HTMLElement} el - 容器元素
 * @param {object} pos - 位置数据 {lat, lon, alt, vel, elevation, azimuth, distance}
 * @param {string} obsGrid - 观测者网格坐标
 */
export function renderN2yoPosition(el, pos, obsGrid) {
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
 * @param {HTMLElement} el - 容器元素
 * @param {object} pos - 位置数据 {lat, lon, alt, vel}
 * @param {object} look - 观测参数 {elevation, azimuth, distance}
 * @param {string} obsGrid - 观测者网格坐标
 * @param {object} tle - TLE数据 {fromCache, fetchTime, epoch}
 */
export function renderTlePosition(el, pos, look, obsGrid, tle) {
    const elevColor = look.elevation > 0 ? '#27ae60' : '#e74c3c';
    // 构建TLE数据来源提示
    let tleInfo = '';
    if (tle.fromCache) {
        const fetchTimeStr = new Date(tle.fetchTime).toLocaleString('zh-CN');
        tleInfo = `<span style="color:#e67e22">⚠ 使用 ${fetchTimeStr} 获取的TLE数据计算，可能产生一定误差</span>`;
    }
    else if (tle.epoch) {
        const ageStr = SatService.formatTleAge(tle.epoch);
        const epochStr = tle.epoch.toLocaleString('zh-CN');
        const ageDays = (Date.now() - tle.epoch.getTime()) / 86400000;
        if (ageDays > 3) {
            tleInfo = `<span style="color:#e67e22">⚠ TLE历元: ${epochStr}（${ageStr}前），可能产生一定误差</span>`;
        }
        else {
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
// 过境预测渲染
// ============================================================
/**
 * 渲染过境预测结果
 * @param {HTMLElement} el - 容器元素
 * @param {Array} passes - 过境数组 [{start, peak, end, maxElev, azimuth}]
 * @param {number} minElev - 最低仰角
 * @param {string} source - 数据源 'tle' | 'n2yo'
 */
export function renderPasses(el, passes, minElev, source = 'n2yo') {
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
// 地面轨迹渲染（MapLibre GL JS地图 - 使用共享地图模块）
// ============================================================
import { getMap, clearLayers, addMultiPolyline, addCircleMarker, addPopup, invalidateSize } from './shared-map.js?v=20260730';
/**
 * 渲染卫星地面轨迹到MapLibre地图
 * @param {HTMLElement} container - 地图容器元素（未使用，保留兼容）
 * @param {Array} points - 轨道点数组 [{lat, lon, timestamp, discontinuity}]
 * @param {object} currentPos - 当前卫星位置 {lat, lon}
 * @param {object} observer - 观测者位置 {lat, lon} 或 null
 * @param {string} satName - 卫星名称
 */
export async function renderGroundTrack(container, points, currentPos, observer, satName) {
    const mapId = 'satGroundTrackMap';
    const map = await getMap(mapId, { center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 10 });
    if (!map)
        return;
    // 清除旧图层
    clearLayers(mapId);
    // 绘制地面轨迹（升段绿色，降段橙色，不连续处断开）
    // MapLibre GeoJSON坐标格式: [lng, lat]
    if (points && points.length > 1) {
        const ascendingSegments = [];
        const descendingSegments = [];
        let currentSegment = [];
        let currentAscending = null;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.discontinuity && currentSegment.length > 1) {
                if (currentAscending) {
                    ascendingSegments.push([...currentSegment]);
                } else {
                    descendingSegments.push([...currentSegment]);
                }
                currentSegment = [];
                currentAscending = null;
                continue;
            }
            if (currentSegment.length > 0) {
                const prevP = currentSegment[currentSegment.length - 1];
                const isAsc = p.lat > prevP[1];
                if (currentAscending !== null && isAsc !== currentAscending && currentSegment.length > 1) {
                    if (currentAscending) {
                        ascendingSegments.push([...currentSegment]);
                    } else {
                        descendingSegments.push([...currentSegment]);
                    }
                    currentSegment = [[prevP[0], prevP[1]]];
                }
                currentAscending = isAsc;
            }
            currentSegment.push([p.lon, p.lat]);
        }
        if (currentSegment.length > 1) {
            if (currentAscending) {
                ascendingSegments.push(currentSegment);
            } else {
                descendingSegments.push(currentSegment);
            }
        }
        // 绘制升段（绿色）
        addMultiPolyline(mapId, ascendingSegments, {
            color: '#2ecc71',
            width: 2,
            opacity: 0.8,
            idPrefix: 'line'
        });
        // 绘制降段（橙色）
        addMultiPolyline(mapId, descendingSegments, {
            color: '#e67e22',
            width: 2,
            opacity: 0.8,
            idPrefix: 'line'
        });
    }
    // 绘制观测者位置
    if (observer) {
        addCircleMarker(mapId, [observer.lon, observer.lat], {
            color: '#ffffff',
            radius: 6,
            opacity: 0.9,
            idPrefix: 'circle'
        });
        addPopup(mapId, [observer.lon, observer.lat], '📍 观测者');
    }
    // 绘制当前卫星位置
    if (currentPos) {
        addCircleMarker(mapId, [currentPos.lon, currentPos.lat], {
            color: '#e74c3c',
            radius: 7,
            opacity: 0.9,
            idPrefix: 'circle'
        });
        addPopup(mapId, [currentPos.lon, currentPos.lat], '🛰 ' + (satName || '卫星'));
    }
    // 刷新地图尺寸
    invalidateSize(mapId);
}
/**
 * 清除地面轨迹地图
 */
export function clearGroundTrackMap() {
    clearLayers('satGroundTrackMap');
}