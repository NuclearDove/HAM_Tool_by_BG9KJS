/**
 * HAM Radio Toolbox - VOACAP传播预测服务层
 * 基于VOACAP模型简化计算，提供短波传播预测
 * 参考: IONCAP/VOACAP算法简化版
 * @module services/voacap-service
 */

import type { PropagationParams, PropagationResult, Band, BandRecommendation } from '../types.js';

/**
 * 计算最大可用频率(MUF) - 简化模型
 * 基于F2层临界频率和跳距的简化计算
 * @param foF2 - F2层临界频率(MHz)
 * @param distance - 通信距离(km)
 * @param hopHeight - 电离层反射高度(km)，默认300
 * @returns MUF(MHz)
 */
export function calcMuf(foF2: number, distance: number, hopHeight: number = 300): number {
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
export function calcFot(muf: number): number {
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
export function calcLuf(distance: number, solarFlux: number, hourUTC: number): number {
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
export function calcSignalStrength(txPower: number, freqMHz: number, distance: number, gain_dBi: number = 0): number {
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
export function calcSnr(signalDbm: number, noiseFloor: number = -120, bandwidthHz: number = 2400): number {
  const bwFactor = 10 * Math.log10(bandwidthHz);
  return signalDbm - noiseFloor - bwFactor + 174;
}

/**
 * 传播预测综合评估
 * @param params - 预测参数
 * @returns 传播预测结果
 */
export function predictPropagation(params: PropagationParams): PropagationResult {
  const { foF2, distance, txPower, freqMHz, solarFlux, hourUTC, gain_dBi = 0, hopHeight = 300 } = params;

  const muf = calcMuf(foF2, distance, hopHeight);
  const fot = calcFot(muf);
  const luf = calcLuf(distance, solarFlux, hourUTC);
  const signalDbm = calcSignalStrength(txPower, freqMHz, distance, gain_dBi);
  const snr = calcSnr(signalDbm);

  // 传播质量评估
  let quality: string, recommendation: string;
  if (freqMHz > muf) {
    quality = '差';
    recommendation = '频率超过MUF，传播不可靠，建议降低频率';
  } else if (freqMHz > fot) {
    quality = '一般';
    recommendation = '频率接近MUF，传播可能不稳定，建议使用FOT附近频率';
  } else if (freqMHz < luf) {
    quality = '差';
    recommendation = '频率低于LUF，D层吸收严重，建议提高频率';
  } else if (snr > 20) {
    quality = '优';
    recommendation = '传播条件良好，信号强';
  } else if (snr > 10) {
    quality = '良';
    recommendation = '传播条件尚可，可进行通信';
  } else if (snr > 0) {
    quality = '一般';
    recommendation = '信号较弱，建议使用CW或数字模式';
  } else {
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
export function recommendBands(muf: number, luf: number, bands: Band[]): BandRecommendation[] {
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
export function estimateFoF2(sfi: number, hourUTC: number, lat: number = 40): number {
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