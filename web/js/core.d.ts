/**
 * HAM Radio Toolbox - 核心常量与数据模块 (ES Module)
 * 包含频段数据、馈线数据、Q简语、缩略语、摩尔斯码等基础数据
 * 以及核心计算函数（频率转换、波长、网格坐标、功率、SWR等）
 * 静态数据优先从JSON文件加载，内联数据作为fallback
 * @module core
 */
import * as RfService from './services/rf-service.js';
import * as GeoService from './services/geo-service.js';
import * as MorseService from './services/morse-service.js';
import * as LogService from './services/log-service.js';
import * as VoacapService from './services/voacap-service.js';
import * as SatelliteService from './services/satellite-service.js';
import type { AppConfig, Band, CoaxTypes, ModeRefCategory, QCodeEntry, AbbrevEntry, ClockConfig, LatLon, QthLocation, DistanceBearingResult, DipoleResult, MorseCodeMap } from './types.js';
declare const CONFIG: AppConfig;
/** 光速 (m/s) */
declare const C = 299792458;
declare const CAT_CN: Record<string, string>;
declare let BANDS: Band[];
/** B类30MHz以下功率限制说明（2024年3月1日新规） */
declare const B_CLASS_NOTE = "B\u7C7B30MHz\u4EE5\u4E0B\u226415W\uFF082024\u5E743\u67081\u65E5\u540E\u65B0\u89C4\uFF0C\u6B64\u524D\u2264100W\uFF09";
declare const SPECTRUM_CATS: [number, number, string][];
declare let COAX_TYPES: CoaxTypes;
declare let MODES: string[];
declare let Q_CODES: QCodeEntry[];
declare let ENG_ABBREV: AbbrevEntry[];
declare let NUM_ABBREV: AbbrevEntry[];
declare const MORSE_CODE: MorseCodeMap;
declare const MORSE_REVERSE: MorseCodeMap;
declare let CITY_COORDS: Record<string, [number, number]>;
declare let MODES_REF: ModeRefCategory[];
declare let DEFAULT_CLOCKS: ClockConfig[];
declare let R_READABILITY: string[];
declare let S_STRENGTH: string[];
declare let T_TONE: string[];
/**
 * 填充下拉选择框
 * @param selectId - select元素ID
 * @param items - 选项数组
 * @param valueFn - 获取value的函数
 * @param textFn - 获取显示文本的函数
 */
declare function populateSelect<T>(selectId: string, items: T[], valueFn: (item: T) => string, textFn: (item: T) => string): void;
/**
 * HTML转义 - 防止XSS注入
 * @param s - 需要转义的字符串
 * @returns 转义后的安全HTML字符串
 */
declare function escHtml(s: string | null | undefined): string;
/**
 * 渲染数据表格
 * @param tableId - table元素ID（不含#）
 * @param data - 数据数组
 * @param rowFn - 行渲染函数，返回HTML字符串
 */
declare function renderTable<T>(tableId: string, data: T[], rowFn: (row: T) => string): void;
/**
 * 频率单位转换为MHz
 * @param val - 频率值
 * @param unit - 单位 (kHz/MHz/GHz)
 * @returns MHz值
 */
declare function freqToMHz(val: number | string, unit: string): number;
/**
 * 根据频率查找所属业余频段
 * @param freqMHz - 频率(MHz)
 * @returns 频段对象或null
 */
declare function freqToBand(freqMHz: number): Band | null;
/**
 * 根据频率获取频谱分类
 * @param freqMHz - 频率(MHz)
 * @returns 频谱分类(VLF/LF/MF/HF/VHF/UHF/SHF/EHF)或null
 */
declare function getSpectrumCat(freqMHz: number): string | null;
/**
 * 计算波长
 * @param freqMHz - 频率(MHz)
 * @returns 波长(米)
 */
declare function wavelength(freqMHz: number): number;
/**
 * 计算半波偶极天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 半波长度和每臂长度(米)
 */
declare function dipoleLength(freqMHz: number): DipoleResult;
/**
 * 计算1/4波长天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 1/4波长长度(米)，含0.95缩短系数
 */
declare function quarterWaveLength(freqMHz: number): number;
/**
 * 网格坐标转经纬度
 * @param grid - 梅登黑德网格坐标(4或6字符，如OM89或OM89MM)
 * @returns 经纬度对象或null
 */
declare function gridToLatLon(grid: string): LatLon | null;
/**
 * 经纬度转网格坐标
 * @param lat - 纬度(-90~90)
 * @param lon - 经度(-180~180)
 * @returns 梅登黑德网格坐标(6字符)或null
 */
declare function latLonToGrid(lat: number, lon: number): string | null;
/**
 * 计算两点间距离和方位角
 * @param lat1 - 起点纬度
 * @param lon1 - 起点经度
 * @param lat2 - 终点纬度
 * @param lon2 - 终点经度
 * @returns 距离(km)和方位角(度)
 */
declare function distanceBearing(lat1: number, lon1: number, lat2: number, lon2: number): DistanceBearingResult;
/** @param dbm - dBm值 @returns 瓦特 */
declare function dbmToWatts(dbm: number): number;
/** @param w - 瓦特 @returns dBm值 */
declare function wattsToDbm(w: number): number;
/** @param w - 瓦特 @returns dBW值 */
declare function wattsToDbw(w: number): number;
/** @param dbw - dBW值 @returns 瓦特 */
declare function dbwToWatts(dbw: number): number;
/** @param dbm - dBm值 @returns dBW值 */
declare function dbmToDbw(dbm: number): number;
/**
 * 由正向/反射功率计算SWR — 委托给 RfService
 * @param fw - 正向功率(W)
 * @param rw - 反射功率(W)
 * @returns SWR值或null(参数无效)
 */
declare function swrFromPower(fw: number, rw: number): number | null;
/**
 * 由SWR计算反射功率 — 委托给 RfService
 * @param swr - 驻波比
 * @param fw - 正向功率(W)
 * @returns 反射功率(W)或null(参数无效)
 */
declare function swrToReflectPower(swr: number, fw: number): number | null;
/**
 * 计算馈线衰减量 — 委托给 RfService
 * @param type - 馈线类型(如RG58/LMR400)
 * @param freqMHz - 频率(MHz)
 * @param lengthM - 长度(米)
 * @returns 衰减量(dB)或null(类型不存在)
 */
declare function coaxAttenuation(type: string, freqMHz: number, lengthM: number): number | null;
/**
 * 文本转摩尔斯码
 * @param text - 输入文本（支持全角→半角转换）
 * @returns 摩尔斯码字符串（空格分隔，/表示词间空格）
 */
declare function morseEncode(text: string): string;
/**
 * 摩尔斯码转文本
 * @param morse - 摩尔斯码字符串（支持·和.两种点号）
 * @returns 解码文本
 */
declare function morseDecode(morse: string): string;
/**
 * 解析QTH定位（支持网格坐标/经纬度/城市名）— 委托给 GeoService
 * @param qth - QTH字符串(如OM89MM或39.9,116.4或北京)
 * @returns 坐标对象或null
 */
declare function parseQth(qth: string): QthLocation | null;
/**
 * 初始化静态数据（从JSON文件加载）
 * 加载成功后覆盖内联fallback数据
 * @returns Promise<void>
 */
declare function initData(): Promise<void>;
export { CONFIG, C, CAT_CN, B_CLASS_NOTE, SPECTRUM_CATS, MORSE_CODE, MORSE_REVERSE, populateSelect, renderTable, escHtml, freqToMHz, freqToBand, getSpectrumCat, wavelength, dipoleLength, quarterWaveLength, gridToLatLon, latLonToGrid, distanceBearing, dbmToWatts, wattsToDbm, wattsToDbw, dbwToWatts, dbmToDbw, swrFromPower, swrToReflectPower, coaxAttenuation, morseEncode, morseDecode, parseQth, initData, BANDS, COAX_TYPES, MODES, Q_CODES, ENG_ABBREV, NUM_ABBREV, CITY_COORDS, MODES_REF, DEFAULT_CLOCKS, R_READABILITY, S_STRENGTH, T_TONE, RfService, GeoService, MorseService, LogService, VoacapService, SatelliteService };
