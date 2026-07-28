/**
 * HAM Radio Toolbox - 射频计算服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/rf-service
 */

import type { DipoleResult, CoaxAttenuationMap } from '../types.js';

/**
 * 计算波长
 * @param freqMHz - 频率(MHz)
 * @returns 波长(米)
 */
export function calcWavelength(freqMHz: number): number {
  const C = 299792458;
  return C / (freqMHz * 1e6);
}

/**
 * 计算半波偶极天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 半波长度和每臂长度(米)
 */
export function calcDipoleLength(freqMHz: number): DipoleResult {
  const wl = calcWavelength(freqMHz);
  return { halfWave: wl / 2, eachLeg: wl / 4 * 0.95 };
}

/**
 * 计算1/4波长天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 1/4波长长度(米)
 */
export function calcQuarterWaveLength(freqMHz: number): number {
  return calcWavelength(freqMHz) / 4 * 0.95;
}

/**
 * dBm转瓦特
 * @param dbm - dBm值
 * @returns 瓦特
 */
export function dbmToWatts(dbm: number): number { return Math.pow(10, dbm / 10) / 1000; }

/**
 * 瓦特转dBm
 * @param w - 瓦特
 * @returns dBm值
 */
export function wattsToDbm(w: number): number { return 10 * Math.log10(w * 1000); }

/**
 * 瓦特转dBW
 * @param w - 瓦特
 * @returns dBW值
 */
export function wattsToDbw(w: number): number { return 10 * Math.log10(w); }

/**
 * dBW转瓦特
 * @param dbw - dBW值
 * @returns 瓦特
 */
export function dbwToWatts(dbw: number): number { return Math.pow(10, dbw / 10); }

/**
 * dBm转dBW
 * @param dbm - dBm值
 * @returns dBW值
 */
export function dbmToDbw(dbm: number): number { return dbm - 30; }

/**
 * 由正向/反射功率计算SWR
 * @param fw - 正向功率(W)
 * @param rw - 反射功率(W)
 * @returns SWR值或null
 */
export function calcSwrFromPower(fw: number, rw: number): number | null {
  if (fw <= 0 || rw < 0 || rw > fw) return null;
  const refl = Math.sqrt(rw / fw);
  return (1 + refl) / (1 - refl);
}

/**
 * 由SWR计算反射功率
 * @param swr - 驻波比
 * @param fw - 正向功率(W)
 * @returns 反射功率(W)或null
 */
export function calcReflectPower(swr: number, fw: number): number | null {
  if (swr <= 1 || fw <= 0) return null;
  const refl = (swr - 1) / (swr + 1);
  return fw * refl * refl;
}

/**
 * 计算馈线衰减量
 * @param coaxData - 馈线衰减数据对象
 * @param freqMHz - 频率(MHz)
 * @param lengthM - 长度(米)
 * @returns 衰减量(dB)或null
 */
export function calcCoaxAttenuation(coaxData: CoaxAttenuationMap | null | undefined, freqMHz: number, lengthM: number): number | null {
  if (!coaxData) return null;
  const freqs = Object.keys(coaxData).map(Number).sort((a, b) => a - b);
  if (freqMHz <= freqs[0]) return coaxData[freqs[0]] / 100 * lengthM;
  if (freqMHz >= freqs[freqs.length - 1]) return coaxData[freqs[freqs.length - 1]] / 100 * lengthM;
  let lo = freqs[0], hi = freqs[freqs.length - 1];
  for (let i = 0; i < freqs.length - 1; i++) {
    if (freqMHz >= freqs[i] && freqMHz <= freqs[i + 1]) { lo = freqs[i]; hi = freqs[i + 1]; break; }
  }
  const ratio = (freqMHz - lo) / (hi - lo);
  const atten100 = coaxData[lo] + ratio * (coaxData[hi] - coaxData[lo]);
  return atten100 / 100 * lengthM;
}