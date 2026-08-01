/**
 * HAM Radio Toolbox - 地理计算服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/geo-service
 */
/**
 * Maidenhead网格坐标转经纬度
 * @param grid - 4/6/8位Maidenhead网格定位符
 * @returns 经纬度对象或null
 */
export function gridToLatLon(grid) {
    if (!grid || grid.length < 4)
        return null;
    const g = grid.toUpperCase();
    const lon = (g.charCodeAt(0) - 65) * 20 - 180;
    const lat = (g.charCodeAt(1) - 65) * 10 - 90;
    let rlon = lon, rlat = lat;
    if (g.length >= 4) {
        rlon += parseInt(g[2]) * 2 + 1;
        rlat += parseInt(g[3]) + 0.5;
    }
    if (g.length >= 6) {
        rlon += (g.charCodeAt(4) - 65) * (2 / 24) + 1 / 24;
        rlat += (g.charCodeAt(5) - 65) * (1 / 24) + 1 / 48;
    }
    if (g.length >= 8) {
        rlon += parseInt(g[6]) * (2 / 240) + 1 / 240;
        rlat += parseInt(g[7]) * (1 / 240) + 1 / 480;
    }
    return { lat: rlat, lon: rlon };
}
/**
 * 经纬度转Maidenhead网格定位符
 * @param lat - 纬度
 * @param lon - 经度
 * @param precision - 精度位数(4/6/8)，默认6
 * @returns Maidenhead网格定位符
 */
export function latLonToGrid(lat, lon, precision = 6) {
    let tmp = lon + 180;
    const c1 = Math.floor(tmp / 20);
    tmp = tmp - c1 * 20;
    const c3 = Math.floor(tmp / 2);
    tmp = tmp - c3 * 2;
    let t1 = lat + 90;
    const c2 = Math.floor(t1 / 10);
    t1 = t1 - c2 * 10;
    const c4 = Math.floor(t1);
    t1 = t1 - c4;
    let grid = String.fromCharCode(65 + c1) + String.fromCharCode(65 + c2) + c3 + c4;
    let c5 = 0, c6 = 0;
    if (precision >= 6) {
        c5 = Math.floor(tmp / (2 / 24));
        c6 = Math.floor(t1 / (1 / 24));
        grid += String.fromCharCode(97 + c5) + String.fromCharCode(97 + c6);
    }
    if (precision >= 8) {
        tmp = tmp - c5 * (2 / 24);
        t1 = t1 - c6 * (1 / 24);
        const c7 = Math.floor(tmp / (2 / 240));
        const c8 = Math.floor(t1 / (1 / 240));
        grid += c7 + c8;
    }
    return grid.toUpperCase();
}
/**
 * Haversine公式计算两点间距离和方位角
 * @param lat1 - 起点纬度
 * @param lon1 - 起点经度
 * @param lat2 - 终点纬度
 * @param lon2 - 终点经度
 * @returns 距离(km)和方位角(度)
 */
export function calcDistanceBearing(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    return { distance, bearing };
}
/**
 * 解析QTH定位符（支持多种格式）
 * @param qth - QTH定位符字符串
 * @returns 经纬度或null
 */
export function parseQth(qth) {
    if (!qth)
        return null;
    const trimmed = qth.trim().toUpperCase();
    if (/^[A-R]{2}[0-9]{2}/.test(trimmed)) {
        return gridToLatLon(trimmed);
    }
    const coordMatch = trimmed.match(/([NS])\s*(\d+\.?\d*)\s*[, ]\s*([EW])\s*(\d+\.?\d*)/);
    if (coordMatch) {
        let lat = parseFloat(coordMatch[2]);
        let lon = parseFloat(coordMatch[4]);
        if (coordMatch[1] === 'S')
            lat = -lat;
        if (coordMatch[3] === 'W')
            lon = -lon;
        return { lat, lon };
    }
    return null;
}