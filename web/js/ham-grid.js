/**
 * HAM Radio Toolbox - 网格坐标 Tab 模块 (ES Module)
 * @module ham-grid
 */
'use strict';
import { gridToLatLon, latLonToGrid, distanceBearing } from './core.js';
import { EventBus } from './event-bus.js';
function llToGrid() {
    const lat = parseFloat(document.getElementById('latIn').value);
    const lon = parseFloat(document.getElementById('lonIn').value);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        document.getElementById('gridResult').textContent = '请输入有效经纬度 (纬度 -90~90, 经度 -180~180)。';
        return;
    }
    const grid = latLonToGrid(lat, lon);
    if (!grid) {
        document.getElementById('gridResult').textContent = '网格坐标转换失败';
        return;
    }
    const lines = ['经纬度: ' + lat + '°, ' + lon + '°', '网格坐标: ' + grid, '4位: ' + grid.substring(0, 4), grid.length >= 6 ? '6位: ' + grid.substring(0, 6) : ''];
    document.getElementById('gridResult').textContent = lines.filter(Boolean).join('\n');
    EventBus.emit('status', '经纬度→网格转换完成');
}
function gridToLl() {
    const grid = document.getElementById('gridIn').value.trim().toUpperCase();
    const c = gridToLatLon(grid);
    if (!c) {
        document.getElementById('gridResult').textContent = '无效网格格式 (如 OM89 或 OM89MM)。';
        return;
    }
    const lines = ['网格: ' + grid, '纬度: ' + c.lat.toFixed(6) + '°', '经度: ' + c.lon.toFixed(6) + '°', '', 'Google Maps: https://maps.google.com/?q=' + c.lat + ',' + c.lon];
    document.getElementById('gridResult').textContent = lines.join('\n');
    EventBus.emit('status', '网格→经纬度转换完成');
}
function gridDistance() {
    const g1 = document.getElementById('distG1').value.trim().toUpperCase();
    const g2 = document.getElementById('distG2').value.trim().toUpperCase();
    const c1 = gridToLatLon(g1), c2 = gridToLatLon(g2);
    if (!c1 || !c2) {
        document.getElementById('gridResult').textContent = '无效网格格式。';
        return;
    }
    const d = distanceBearing(c1.lat, c1.lon, c2.lat, c2.lon);
    const lines = ['网格1: ' + g1 + ' → ' + c1.lat.toFixed(4) + '°, ' + c1.lon.toFixed(4) + '°', '网格2: ' + g2 + ' → ' + c2.lat.toFixed(4) + '°, ' + c2.lon.toFixed(4) + '°', '', '距离: ' + d.distance.toFixed(1) + ' km', '方位角: ' + d.bearing.toFixed(1) + '°'];
    document.getElementById('gridResult').textContent = lines.join('\n');
    EventBus.emit('status', '网格距离计算完成');
}

/**
 * 使用浏览器 Geolocation API 获取当前位置，填入经纬度输入框
 */
function getMyLocation() {
    if (!navigator.geolocation) {
        document.getElementById('gridResult').textContent = '此浏览器不支持定位功能。';
        return;
    }
    document.getElementById('gridResult').textContent = '正在获取位置...';
    navigator.geolocation.getCurrentPosition(
        function (pos) {
            var lat = pos.coords.latitude;
            var lon = pos.coords.longitude;
            var acc = pos.coords.accuracy;
            document.getElementById('latIn').value = lat.toFixed(6);
            document.getElementById('lonIn').value = lon.toFixed(6);
            var grid = latLonToGrid(lat, lon);
            var lines = [
                '已获取当前位置',
                '纬度: ' + lat.toFixed(6) + '°',
                '经度: ' + lon.toFixed(6) + '°',
                '精度: ±' + Math.round(acc) + ' m',
                grid ? '网格坐标: ' + grid : ''
            ];
            document.getElementById('gridResult').textContent = lines.filter(Boolean).join('\n');
            EventBus.emit('status', '定位成功: ' + lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°');
        },
        function (err) {
            var msgs = {
                1: '定位权限被拒绝，请在浏览器设置中允许定位权限。',
                2: '无法获取位置信息，请检查设备定位服务是否开启。',
                3: '定位请求超时，请重试。'
            };
            document.getElementById('gridResult').textContent = msgs[err.code] || ('定位失败: ' + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function init() { }
export { llToGrid, gridToLl, gridDistance, getMyLocation, init };
//# sourceMappingURL=ham-grid.js.map