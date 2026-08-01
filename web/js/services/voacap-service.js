/**
 * HAM Radio Toolbox - VOACAP传播预测服务层
 * 基于VOACAP模型简化计算，提供短波传播预测
 * 参考: IONCAP/VOACAP算法简化版
 * 支持在线API（voacap.com）+ 本地简化模型回退
 * @module services/voacap-service
 */
/** VOACAP在线API端点 */
const VOACAP_API_URL = 'https://www.voacap.com/api';
/**
 * 调用VOACAP在线API进行传播预测
 * @param {Object} params - 预测参数
 * @param {number} params.txLat - 发射方纬度
 * @param {number} params.txLon - 发射方经度
 * @param {number} params.rxLat - 接收方纬度
 * @param {number} params.rxLon - 接收方经度
 * @param {number} params.txPower - 发射功率(W)
 * @param {number} params.freqMHz - 频率(MHz)
 * @param {number} params.ssn - 太阳黑子数(SN)
 * @param {number} params.month - 月份(1-12)
 * @param {number} params.hourUTC - UTC时间(0-23)
 * @returns {Promise<Object|null>} 预测结果或null(失败时)
 */
export async function fetchVoacapOnline(params) {
    const { txLat, txLon, rxLat, rxLon, txPower, freqMHz, ssn, month, hourUTC } = params;
    try {
        const qs = new URLSearchParams({
            tx_lat: txLat.toFixed(2),
            tx_lon: txLon.toFixed(2),
            rx_lat: rxLat.toFixed(2),
            rx_lon: rxLon.toFixed(2),
            tx_power: String(txPower),
            freq: String(freqMHz),
            ssn: String(ssn || 50),
            month: String(month || new Date().getUTCMonth() + 1),
            hour: String(hourUTC),
            mode: 'SSB'
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(VOACAP_API_URL + '/predict?' + qs.toString(), {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok)
            return null;
        const data = await resp.json();
        return data;
    }
    catch (_e) {
        // API不可用（CORS/网络/超时），返回null
        return null;
    }
}
/**
 * 将VOACAP在线API结果转换为本地格式
 * @param {Object} apiData - API返回数据
 * @returns {Object} 标准格式预测结果
 */
export function convertVoacapResult(apiData) {
    if (!apiData || !apiData.prediction)
        return null;
    const p = apiData.prediction;
    return {
        muf: String(p.muf || p.MUF || '0'),
        fot: String(p.fot || p.FOT || '0'),
        luf: String(p.luf || p.LUF || '0'),
        signalDbm: String(p.signal_dbm || p.signalDbm || '0'),
        snr: String(p.snr || p.SNR || '0'),
        quality: p.quality || '一般',
        recommendation: p.recommendation || '在线API返回结果',
        source: 'online'
    };
}
/**
 * 计算最大可用频率(MUF) - 简化模型
 * 基于F2层临界频率和跳距的简化计算
 * @param foF2 - F2层临界频率(MHz)
 * @param distance - 通信距离(km)
 * @param hopHeight - 电离层反射高度(km)，默认300
 * @returns MUF(MHz)
 */
export function calcMuf(foF2, distance, hopHeight = 300) {
    const R = 6371;
    const halfAngle = (distance / (2 * R));
    const secTheta = 1 / Math.cos(Math.asin(R * Math.sin(halfAngle) / (R + hopHeight)));
    return foF2 * secTheta;
}
/**
 * 计算最佳工作频率(FOT)
 * FOT ≈ MUF × 0.85 (85%概率)
 * @param muf - 最大可用频率(MHz)
 * @returns FOT(MHz)
 */
export function calcFot(muf) {
    return muf * 0.85;
}
/**
 * 计算最低可用频率(LUF)
 * 基于D层吸收和噪声的简化估算
 * @param distance - 通信距离(km)
 * @param solarFlux - 太阳通量指数(SFI)
 * @param hourUTC - UTC时间(0-23)
 * @returns LUF(MHz)
 */
export function calcLuf(distance, solarFlux, hourUTC) {
    // 日间D层吸收增强，LUF升高
    const isDaytime = hourUTC >= 6 && hourUTC <= 18;
    const baseLuf = distance > 3000 ? 7 : distance > 1000 ? 5 : 3;
    const dayFactor = isDaytime ? 1.5 : 0.8;
    const sfiFactor = solarFlux > 150 ? 0.9 : solarFlux > 100 ? 1.0 : 1.2;
    return Math.max(2, baseLuf * dayFactor * sfiFactor);
}
/**
 * 估算信号强度 - 简化模型
 * @param txPower - 发射功率(W)
 * @param freqMHz - 频率(MHz)
 * @param distance - 通信距离(km)
 * @param gain_dBi - 天线增益(dBi)
 * @returns 接收信号强度(dBm)
 */
export function calcSignalStrength(txPower, freqMHz, distance, gain_dBi = 0) {
    const txPower_dBm = 10 * Math.log10(txPower * 1000);
    // 自由空间路径损耗
    const fspl_dB = 20 * Math.log10(distance) + 20 * Math.log10(freqMHz) + 32.44;
    // 电离层附加损耗（简化：1-2跳约10-20dB）
    const ionoLoss = distance > 3000 ? 20 : distance > 1000 ? 15 : 10;
    // 系统损耗（馈线等）
    const sysLoss = 3;
    return txPower_dBm + gain_dBi - fspl_dB - ionoLoss - sysLoss;
}
/**
 * 计算信噪比(SNR)
 * @param signalDbm - 信号强度(dBm)
 * @param noiseFloor - 噪声底(dBm)，默认-120
 * @param bandwidthHz - 接收带宽(Hz)，默认2400(SSB)
 * @returns SNR(dB)
 */
export function calcSnr(signalDbm, noiseFloor = -120, bandwidthHz = 2400) {
    const bwFactor = 10 * Math.log10(bandwidthHz);
    return signalDbm - noiseFloor - bwFactor + 174;
}
/**
 * 传播预测综合评估
 * @param params - 预测参数
 * @returns 传播预测结果
 */
export function predictPropagation(params) {
    const { foF2, distance, txPower, freqMHz, solarFlux, hourUTC, gain_dBi = 0, hopHeight = 300 } = params;
    const muf = calcMuf(foF2, distance, hopHeight);
    const fot = calcFot(muf);
    const luf = calcLuf(distance, solarFlux, hourUTC);
    const signalDbm = calcSignalStrength(txPower, freqMHz, distance, gain_dBi);
    const snr = calcSnr(signalDbm);
    // 传播质量评估
    let quality, recommendation;
    if (freqMHz > muf) {
        quality = '差';
        recommendation = '频率超过MUF，传播不可靠，建议降低频率';
    }
    else if (freqMHz > fot) {
        quality = '一般';
        recommendation = '频率接近MUF，传播可能不稳定，建议使用FOT附近频率';
    }
    else if (freqMHz < luf) {
        quality = '差';
        recommendation = '频率低于LUF，D层吸收严重，建议提高频率';
    }
    else if (snr > 20) {
        quality = '优';
        recommendation = '传播条件良好，信号强';
    }
    else if (snr > 10) {
        quality = '良';
        recommendation = '传播条件尚可，可进行通信';
    }
    else if (snr > 0) {
        quality = '一般';
        recommendation = '信号较弱，建议使用CW或数字模式';
    }
    else {
        quality = '差';
        recommendation = '信号极弱，不建议在此频率通信';
    }
    return { muf: muf.toFixed(1), fot: fot.toFixed(1), luf: luf.toFixed(1),
        signalDbm: signalDbm.toFixed(1), snr: snr.toFixed(1), quality, recommendation };
}
/**
 * 根据条件推荐最佳频段
 * @param muf - 最大可用频率(MHz)
 * @param luf - 最低可用频率(MHz)
 * @param bands - 可用频段列表
 * @returns 推荐频段列表（按评分排序）
 */
export function recommendBands(muf, luf, bands) {
    const fot = muf * 0.85;
    return bands
        .filter(b => b.f_high >= luf && b.f_low <= muf)
        .map(b => {
        const center = (b.f_low + b.f_high) / 2;
        const distFromFot = Math.abs(center - fot);
        const score = Math.max(0, 100 - distFromFot * 2);
        return { band: b.name, freq: center.toFixed(1), score: Math.round(score) };
    })
        .sort((a, b) => b.score - a.score);
}
/**
 * 估算foF2（基于太阳通量指数的简化模型）
 * 实际应用中应从IONCAP/VOACAP获取精确值
 * @param sfi - 太阳通量指数(70-300)
 * @param hourUTC - UTC时间(0-23)
 * @param lat - 纬度（用于区分高/低纬度）
 * @returns foF2估算值(MHz)
 */
export function estimateFoF2(sfi, hourUTC, lat = 40) {
    // 基于太阳通量的简化foF2估算
    const baseFoF2 = 3 + (sfi - 70) * 0.04;
    // 日间增强
    const isDaytime = hourUTC >= 6 && hourUTC <= 18;
    const dayFactor = isDaytime ? 1.8 : 0.6;
    // 纬度修正（高纬度foF2较低）
    const latFactor = Math.abs(lat) > 60 ? 0.7 : Math.abs(lat) > 45 ? 0.85 : 1.0;
    // 时间修正（午后峰值）
    const hourFactor = isDaytime ? 1 + 0.2 * Math.sin((hourUTC - 6) * Math.PI / 12) : 1;
    return Math.max(2, baseFoF2 * dayFactor * latFactor * hourFactor);
}
/**
 * 计算灰线（Gray-line）位置
 * 灰线是日出/日落时分太阳照射区域的过渡带，利于DX传播
 * @param {Date} [date=new Date()] - 计算日期时间
 * @returns {Object} 灰线信息 { subsolarLat, subsolarLon, terminatorPoints, isGrayLine }
 */
export function calcGrayLine(date = new Date()) {
    const dayOfYear = getDayOfYear(date);
    const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
    // 太阳赤纬（简化公式，精度约0.3°）
    const declination = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365);
    // 太阳时角（从正午算起的小时角）
    const hourAngle = (hourUTC - 12) * 15; // 度
    // 次太阳点（太阳直射点）
    const subsolarLat = declination;
    const subsolarLon = -hourAngle; // 经度向西为正
    // 计算晨昏线（terminator）上的点
    const terminatorPoints = [];
    for (let lon = -180; lon <= 180; lon += 5) {
        // 在给定经度上，太阳高度角为0°的纬度
        const lat = calcTerminatorLat(declination, lon - subsolarLon);
        if (lat !== null) {
            terminatorPoints.push({ lat, lon });
        }
    }
    // 判断某纬度是否处于灰线区域（太阳高度角在-6°到+6°之间）
    const grayLineInfo = {
        subsolarLat,
        subsolarLon,
        terminatorPoints,
        declination: declination.toFixed(2),
        hourUTC: hourUTC.toFixed(1)
    };
    return grayLineInfo;
}
/**
 * 计算某经度上晨昏线的纬度
 * @param {number} declination - 太阳赤纬(度)
 * @param {number} relLon - 相对次太阳点的经度差(度)
 * @returns {number|null} 纬度(度)，null表示无解
 */
function calcTerminatorLat(declination, relLon) {
    // 太阳高度角h=0时：sin(h) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(hourAngle)
    // cos(hourAngle) = -tan(lat)*tan(dec) (h=0)
    // 对于给定经度，hourAngle = relLon
    const decRad = declination * Math.PI / 180;
    const haRad = relLon * Math.PI / 180;
    const cosHA = Math.cos(haRad);
    // sin(h) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(ha)
    // 设sin(lat)=x, cos(lat)=sqrt(1-x^2)
    // 0 = x*sin(dec) + sqrt(1-x^2)*cos(dec)*cos(ha)
    // x*sin(dec) = -sqrt(1-x^2)*cos(dec)*cos(ha)
    // x^2*sin^2(dec) = (1-x^2)*cos^2(dec)*cos^2(ha)
    const sinDec = Math.sin(decRad);
    const cosDec = Math.cos(decRad);
    const cosHAsq = cosHA * cosHA;
    const denom = sinDec * sinDec + cosDec * cosDec * cosHAsq;
    if (denom < 1e-10)
        return null;
    // lat = atan(-cos(dec)*cos(ha) / sin(dec))
    const lat = Math.atan2(-cosDec * cosHA, sinDec) * 180 / Math.PI;
    // 纬度范围检查
    if (Math.abs(lat) > 90)
        return null;
    return lat;
}
/**
 * 判断给定位置是否处于灰线区域
 * @param {number} lat - 纬度(度)
 * @param {number} lon - 经度(度)
 * @param {Date} [date=new Date()] - 日期时间
 * @param {number} [threshold=6] - 灰线判定阈值(度)，太阳高度角在±threshold内
 * @returns {boolean} 是否处于灰线区域
 */
export function isGrayLineAt(lat, lon, date = new Date(), threshold = 6) {
    const solarElev = calcSolarElevation(lat, lon, date);
    return Math.abs(solarElev) <= threshold;
}
/**
 * 计算太阳高度角
 * @param {number} lat - 纬度(度)
 * @param {number} lon - 经度(度)
 * @param {Date} date - 日期时间
 * @returns {number} 太阳高度角(度)，负值表示在地平线以下
 */
export function calcSolarElevation(lat, lon, date = new Date()) {
    const dayOfYear = getDayOfYear(date);
    const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
    const decRad = (-23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365)) * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const hourAngle = ((hourUTC - 12) * 15 + lon) * Math.PI / 180;
    const sinElev = Math.sin(latRad) * Math.sin(decRad) +
        Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);
    return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}
/**
 * 获取一年中的第几天
 * @param {Date} date
 * @returns {number} 1-366
 */
function getDayOfYear(date) {
    const start = new Date(date.getUTCFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 86400000);
}
/**
 * SFI转太阳黑子数(SN)的近似公式
 * @param {number} sfi - 太阳通量指数
 * @returns {number} 太阳黑子数
 */
export function sfiToSsn(sfi) {
    return Math.max(0, Math.round(Math.pow((sfi - 64) / 2.9, 2)));
}