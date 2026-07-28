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
export declare function calcWavelength(freqMHz: number): number;
/**
 * 计算半波偶极天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 半波长度和每臂长度(米)
 */
export declare function calcDipoleLength(freqMHz: number): DipoleResult;
/**
 * 计算1/4波长天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 1/4波长长度(米)
 */
export declare function calcQuarterWaveLength(freqMHz: number): number;
/**
 * dBm转瓦特
 * @param dbm - dBm值
 * @returns 瓦特
 */
export declare function dbmToWatts(dbm: number): number;
/**
 * 瓦特转dBm
 * @param w - 瓦特
 * @returns dBm值
 */
export declare function wattsToDbm(w: number): number;
/**
 * 瓦特转dBW
 * @param w - 瓦特
 * @returns dBW值
 */
export declare function wattsToDbw(w: number): number;
/**
 * dBW转瓦特
 * @param dbw - dBW值
 * @returns 瓦特
 */
export declare function dbwToWatts(dbw: number): number;
/**
 * dBm转dBW
 * @param dbm - dBm值
 * @returns dBW值
 */
export declare function dbmToDbw(dbm: number): number;
/**
 * 由正向/反射功率计算SWR
 * @param fw - 正向功率(W)
 * @param rw - 反射功率(W)
 * @returns SWR值或null
 */
export declare function calcSwrFromPower(fw: number, rw: number): number | null;
/**
 * 由SWR计算反射功率
 * @param swr - 驻波比
 * @param fw - 正向功率(W)
 * @returns 反射功率(W)或null
 */
export declare function calcReflectPower(swr: number, fw: number): number | null;
/**
 * 计算馈线衰减量
 * @param coaxData - 馈线衰减数据对象
 * @param freqMHz - 频率(MHz)
 * @param lengthM - 长度(米)
 * @returns 衰减量(dB)或null
 */
export declare function calcCoaxAttenuation(coaxData: CoaxAttenuationMap | null | undefined, freqMHz: number, lengthM: number): number | null;
