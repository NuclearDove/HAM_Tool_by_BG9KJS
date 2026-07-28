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
export declare function calcMuf(foF2: number, distance: number, hopHeight?: number): number;
/**
 * 计算最佳工作频率(FOT)
 * FOT ≈ MUF × 0.85 (85%概率)
 * @param muf - 最大可用频率(MHz)
 * @returns FOT(MHz)
 */
export declare function calcFot(muf: number): number;
/**
 * 计算最低可用频率(LUF)
 * 基于D层吸收和噪声的简化估算
 * @param distance - 通信距离(km)
 * @param solarFlux - 太阳通量指数(SFI)
 * @param hourUTC - UTC时间(0-23)
 * @returns LUF(MHz)
 */
export declare function calcLuf(distance: number, solarFlux: number, hourUTC: number): number;
/**
 * 估算信号强度 - 简化模型
 * @param txPower - 发射功率(W)
 * @param freqMHz - 频率(MHz)
 * @param distance - 通信距离(km)
 * @param gain_dBi - 天线增益(dBi)
 * @returns 接收信号强度(dBm)
 */
export declare function calcSignalStrength(txPower: number, freqMHz: number, distance: number, gain_dBi?: number): number;
/**
 * 计算信噪比(SNR)
 * @param signalDbm - 信号强度(dBm)
 * @param noiseFloor - 噪声底(dBm)，默认-120
 * @param bandwidthHz - 接收带宽(Hz)，默认2400(SSB)
 * @returns SNR(dB)
 */
export declare function calcSnr(signalDbm: number, noiseFloor?: number, bandwidthHz?: number): number;
/**
 * 传播预测综合评估
 * @param params - 预测参数
 * @returns 传播预测结果
 */
export declare function predictPropagation(params: PropagationParams): PropagationResult;
/**
 * 根据条件推荐最佳频段
 * @param muf - 最大可用频率(MHz)
 * @param luf - 最低可用频率(MHz)
 * @param bands - 可用频段列表
 * @returns 推荐频段列表（按评分排序）
 */
export declare function recommendBands(muf: number, luf: number, bands: Band[]): BandRecommendation[];
/**
 * 估算foF2（基于太阳通量指数的简化模型）
 * 实际应用中应从IONCAP/VOACAP获取精确值
 * @param sfi - 太阳通量指数(70-300)
 * @param hourUTC - UTC时间(0-23)
 * @param lat - 纬度（用于区分高/低纬度）
 * @returns foF2估算值(MHz)
 */
export declare function estimateFoF2(sfi: number, hourUTC: number, lat?: number): number;
