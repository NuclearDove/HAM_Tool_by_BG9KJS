/**
 * HAM Radio Toolbox - 网格坐标 Tab 模块 (ES Module)
 * @module ham-grid
 */
'use strict';
import { gridToLatLon, latLonToGrid, distanceBearing } from './core.js';
import { EventBus } from './event-bus.js';

// DOM辅助：安全获取元素
const $ = (id) => document.getElementById(id);
const getMode = () => {
  const el = $('latLonMode');
  return el ? el.value : 'decimal';
};

// 度分秒 (DMS) 工具函数
function decimalToDms(decimal) {
  const sign = decimal >= 0 ? 1 : -1;
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = parseFloat(((minFloat - min) * 60).toFixed(2));
  return { deg, min, sec, sign };
}

function dmsToDecimal(deg, min, sec, sign) {
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

function formatDms(decimal, isLat) {
  const dms = decimalToDms(decimal);
  const dir = isLat ? (dms.sign >= 0 ? "N" : "S") : dms.sign >= 0 ? "E" : "W";
  return dms.deg + "°" + dms.min + "'" + dms.sec + '"' + " " + dir;
}

// 将十进制填入DMS输入框
function fillDmsFromDecimal(prefix, decimal) {
  const d = decimalToDms(decimal);
  const degEl = $(prefix + "Deg"),
    minEl = $(prefix + "Min"),
    secEl = $(prefix + "Sec");
  if (degEl) degEl.value = d.deg * d.sign;
  if (minEl) minEl.value = d.min;
  if (secEl) secEl.value = d.sec;
}

function switchLatLonMode() {
  const modeEl = $("latLonMode"),
    decimalRow = $("decimalRow"),
    dmsRow = $("dmsRow");
  if (!modeEl || !decimalRow || !dmsRow) return;
  const mode = modeEl.value;
  if (mode === "dms") {
    const latIn = $("latIn"),
      lonIn = $("lonIn");
    if (latIn && lonIn) {
      const latVal = parseFloat(latIn.value),
        lonVal = parseFloat(lonIn.value);
      if (!isNaN(latVal)) fillDmsFromDecimal("lat", latVal);
      if (!isNaN(lonVal)) fillDmsFromDecimal("lon", lonVal);
    }
    decimalRow.style.display = "none";
    dmsRow.style.display = "";
  } else {
    const lat = parseDmsInputs("lat"),
      lon = parseDmsInputs("lon");
    const latIn = $("latIn"),
      lonIn = $("lonIn");
    if (lat !== null && latIn) latIn.value = lat.toFixed(6);
    if (lon !== null && lonIn) lonIn.value = lon.toFixed(6);
    decimalRow.style.display = "";
    dmsRow.style.display = "none";
  }
}

function parseDmsInputs(prefix) {
  const degEl = $(prefix + "Deg"),
    minEl = $(prefix + "Min"),
    secEl = $(prefix + "Sec");
  if (!degEl) return null;
  const deg = parseFloat(degEl.value);
  const min = minEl ? parseFloat(minEl.value) : NaN;
  const sec = secEl ? parseFloat(secEl.value) : NaN;
  if (isNaN(deg)) return null;
  const sign = deg >= 0 ? 1 : -1;
  return dmsToDecimal(
    Math.abs(deg),
    isNaN(min) ? 0 : min,
    isNaN(sec) ? 0 : sec,
    sign,
  );
}

function llToGrid() {
  const mode = getMode();
  let lat, lon;
  if (mode === "dms") {
    lat = parseDmsInputs("lat");
    lon = parseDmsInputs("lon");
    if (lat === null || lon === null) {
      const el = $("gridResult");
      if (el) el.textContent = "请输入有效的度分秒经纬度。";
      return;
    }
  } else {
    const latEl = $("latIn"),
      lonEl = $("lonIn");
    lat = latEl ? parseFloat(latEl.value) : NaN;
    lon = lonEl ? parseFloat(lonEl.value) : NaN;
  }
  if (
    isNaN(lat) ||
    isNaN(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    const el = $("gridResult");
    if (el) el.textContent = "请输入有效经纬度 (纬度 -90~90, 经度 -180~180)。";
    return;
  }
  const grid = latLonToGrid(lat, lon);
  if (!grid) {
    const el = $("gridResult");
    if (el) el.textContent = "网格坐标转换失败";
    return;
  }
  const latStr = mode === "dms" ? formatDms(lat, true) : lat + "°";
  const lonStr = mode === "dms" ? formatDms(lon, false) : lon + "°";
  const lines = [
    "经纬度: " + latStr + ", " + lonStr,
    "网格坐标: " + grid,
    "4位: " + grid.substring(0, 4),
    grid.length >= 6 ? "6位: " + grid.substring(0, 6) : "",
  ];
  const el = $("gridResult");
  if (el) el.textContent = lines.filter(Boolean).join("\n");
  EventBus.emit("status", "经纬度→网格转换完成");
}

function gridToLl() {
  const gridEl = $("gridIn");
  const grid = gridEl ? gridEl.value.trim().toUpperCase() : "";
  const c = gridToLatLon(grid);
  if (!c) {
    const el = $("gridResult");
    if (el) el.textContent = "无效网格格式 (如 OM89 或 OM89MM)。";
    return;
  }
  const mode = getMode();
  const latStr =
    mode === "dms" ? formatDms(c.lat, true) : c.lat.toFixed(6) + "°";
  const lonStr =
    mode === "dms" ? formatDms(c.lon, false) : c.lon.toFixed(6) + "°";
  const lines = [
    "网格: " + grid,
    "纬度: " + latStr,
    "经度: " + lonStr,
    "",
    "Google Maps: https://maps.google.com/?q=" + c.lat + "," + c.lon,
  ];
  const el = $("gridResult");
  if (el) el.textContent = lines.join("\n");
  EventBus.emit("status", "网格→经纬度转换完成");
}

function gridDistance() {
  const g1El = $("distG1"),
    g2El = $("distG2");
  const g1 = g1El ? g1El.value.trim().toUpperCase() : "";
  const g2 = g2El ? g2El.value.trim().toUpperCase() : "";
  const c1 = gridToLatLon(g1),
    c2 = gridToLatLon(g2);
  if (!c1 || !c2) {
    const el = $("gridResult");
    if (el) el.textContent = "无效网格格式。";
    return;
  }
  const d = distanceBearing(c1.lat, c1.lon, c2.lat, c2.lon);
  const lines = [
    "网格1: " +
      g1 +
      " → " +
      c1.lat.toFixed(4) +
      "°, " +
      c1.lon.toFixed(4) +
      "°",
    "网格2: " +
      g2 +
      " → " +
      c2.lat.toFixed(4) +
      "°, " +
      c2.lon.toFixed(4) +
      "°",
    "",
    "距离: " + d.distance.toFixed(1) + " km",
    "方位角: " + d.bearing.toFixed(1) + "°",
  ];
  const el = $("gridResult");
  if (el) el.textContent = lines.join("\n");
  EventBus.emit("status", "网格距离计算完成");
}

function getMyLocation() {
  const resultEl = $("gridResult");
  if (!navigator.geolocation) {
    if (resultEl) resultEl.textContent = "此浏览器不支持定位功能。";
    return;
  }
  if (resultEl) resultEl.textContent = "正在获取位置...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude,
        lon = pos.coords.longitude,
        acc = pos.coords.accuracy;
      const latIn = $("latIn"),
        lonIn = $("lonIn");
      if (latIn) latIn.value = lat.toFixed(6);
      if (lonIn) lonIn.value = lon.toFixed(6);
      if (getMode() === "dms") {
        fillDmsFromDecimal("lat", lat);
        fillDmsFromDecimal("lon", lon);
      }
      const grid = latLonToGrid(lat, lon);
      const lines = [
        "已获取当前位置",
        "纬度: " + lat.toFixed(6) + "°",
        "经度: " + lon.toFixed(6) + "°",
        "精度: ±" + Math.round(acc) + " m",
        grid ? "网格坐标: " + grid : "",
      ];
      if (resultEl) resultEl.textContent = lines.filter(Boolean).join("\n");
      EventBus.emit(
        "status",
        "定位成功: " + lat.toFixed(4) + "°, " + lon.toFixed(4) + "°",
      );
    },
    (err) => {
      const msgs = {
        1: "定位权限被拒绝，请在浏览器设置中允许定位权限。",
        2: "无法获取位置信息，请检查设备定位服务是否开启。",
        3: "定位请求超时，请重试。",
      };
      if (resultEl) resultEl.textContent = msgs[err.code] || ('定位失败: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

function init() {}

export {
  llToGrid,
  gridToLl,
  gridDistance,
  getMyLocation,
  init,
  switchLatLonMode
};
