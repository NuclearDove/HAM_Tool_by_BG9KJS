/**
 * HAM Radio Toolbox - 共享类型定义
 * 包含所有模块共用的TypeScript类型和接口
 * @module types
 */
/** 应用全局配置常量 */
export interface AppConfig {
    /** 传播条件图表URL */
    PROP_IMG_URL: string;
    /** MapLibre地图样式对象（高德栅格瓦片） */
    MAP_STYLE: string | Record<string, unknown>;
    /** 日志localStorage键名 */
    LOG_KEY: string;
    /** 自定义时钟localStorage键名 */
    CLOCK_KEY: string;
}
/** 频段子段（如40m的专用段/共用段） */
export interface BandSub {
    /** 子段标签（如"专用段"、"共用段"） */
    label: string;
    /** 子段下限频率(MHz) */
    f_low: number;
    /** 子段上限频率(MHz) */
    f_high: number;
    /** 业务类型 */
    svc: string;
}
/** 频段信道（如60m的频道化操作） */
export interface BandChannel {
    /** 信道频率(MHz) */
    freq: number;
    /** 信道编号 */
    ch: number;
}
/** 业余频段数据 */
export interface Band {
    /** 频段名称（如"40m"、"2m"） */
    name: string;
    /** 下限频率(MHz) */
    f_low: number;
    /** 上限频率(MHz) */
    f_high: number;
    /** 频谱分类（VLF/LF/MF/HF/VHF/UHF/SHF/EHF） */
    cat: string;
    /** 执照等级与功率限制 */
    license: string;
    /** 业务类型 */
    svc: string;
    /** 备注 */
    note?: string;
    /** 子段列表 */
    subs?: BandSub[];
    /** 信道列表 */
    channels?: BandChannel[];
}
/** 馈线衰减数据：频率(MHz)→衰减值(dB/100m) */
export type CoaxAttenuationMap = Record<number, number>;
/** 馈线类型集合：型号→衰减数据 */
export type CoaxTypes = Record<string, CoaxAttenuationMap>;
/** 通信模式条目 */
export interface ModeRefItem {
    /** 模式缩写（如SSB、CW、FT8） */
    a: string;
    /** 模式中文名称 */
    n: string;
    /** 模式描述 */
    d: string;
}
/** 通信模式分类 */
export interface ModeRefCategory {
    /** 分类名称（如"模拟语音"、"电报模式"） */
    cat: string;
    /** 该分类下的模式列表 */
    modes: ModeRefItem[];
}
/** Q简语条目：[代码, 问句含义, 答句含义] */
export type QCodeEntry = [string, string, string];
/** 缩略语条目：[缩写, 中文含义, 英文含义] */
export type AbbrevEntry = [string, string, string];
/** 经纬度坐标 */
export interface LatLon {
    /** 纬度(-90~90) */
    lat: number;
    /** 经度(-180~180) */
    lon: number;
}
/** QTH定位结果 */
export interface QthLocation extends LatLon {
    /** 定位来源（grid/coords/city） */
    source: 'grid' | 'coords' | 'city';
    /** 网格坐标（来源为grid时） */
    grid?: string;
    /** 城市名称（来源为city时） */
    cityName?: string;
}
/** 距离和方位角计算结果 */
export interface DistanceBearingResult {
    /** 距离(km) */
    distance: number;
    /** 方位角(度, 0~360) */
    bearing: number;
}
/** 半波偶极天线计算结果 */
export interface DipoleResult {
    /** 半波长度(米) */
    halfWave: number;
    /** 每臂长度(米) */
    eachLeg: number;
}
/** 通联日志条目 */
export interface QsoEntry {
    /** 唯一标识 */
    id: string;
    /** 日期 (YYYY-MM-DD) */
    date: string;
    /** 时间 (HHMM, UTC) */
    time: string;
    /** 呼号 */
    call: string;
    /** 频率(MHz) */
    freq: number | string;
    /** 通信模式 */
    mode: string;
    /** 发送RST信号报告 */
    rst_s: string;
    /** 接收RST信号报告 */
    rst_r: string;
    /** 对方姓名 */
    name?: string;
    /** 对方QTH */
    qth?: string;
    /** 备注 */
    note?: string;
    /** 频段（如"40m"） */
    band?: string;
    /** 网格坐标 */
    grid?: string;
    /** QSL发送状态 */
    qsl_sent?: string;
    /** QSL接收状态 */
    qsl_rcvd?: string;
    /** LoTW发送状态 */
    lotw_qsl_sent?: string;
    /** LoTW接收状态 */
    lotw_qsl_rcvd?: string;
    /** eQSL发送状态 */
    eqsl_qsl_sent?: string;
    /** eQSL接收状态 */
    eqsl_qsl_rcvd?: string;
    /** 发射功率 */
    tx_pwr?: string;
    /** 传播模式 */
    prop_mode?: string;
    /** 卫星名称 */
    sat_name?: string;
    /** 卫星模式 */
    sat_mode?: string;
}
/** 日志校验结果 */
export interface QsoValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误消息列表 */
    errors: string[];
}
/** QSL确认统计 */
export interface QslStats {
    qslSent: number;
    qslRcvd: number;
    lotwSent: number;
    lotwRcvd: number;
    eqslSent: number;
    eqslRcvd: number;
}
/** 统计条目 */
export interface StatsEntry {
    /** 总通联数 */
    total: number;
    /** 不同呼号数 */
    uniqueCalls: number;
    /** 模式种类数 */
    modeCount: number;
    /** 频段数 */
    bandCount: number;
    /** QSL确认统计 */
    qslStats: QslStats;
}
/** 月度统计（月份→通联数） */
export type MonthStats = Record<string, number>;
/** 呼号查询结果 */
export interface CallInfo {
    /** 呼号 */
    call: string;
    /** 姓名 */
    name: string;
    /** 地址 */
    address?: string;
    /** 城市 */
    city?: string;
    /** 国家 */
    country: string;
    /** 网格坐标 */
    grid?: string;
    /** 纬度 */
    lat?: string | number;
    /** 经度 */
    lon?: string | number;
    /** QSL信息 */
    qsl?: string;
    /** 个人网址 */
    url?: string;
    /** 数据来源 */
    source: string;
}
/** 呼号前缀信息 */
export interface CallPrefix {
    /** 国家/地区 */
    country: string;
    /** ITU分区 */
    ituz: string;
    /** CQ分区 */
    cqz: string;
}
/** 卫星基本信息 */
export interface SatelliteInfo {
    /** 卫星名称 */
    name: string;
    /** NORAD编号 */
    noradId: number;
}
/** WTIA API位置数据 */
export interface WtiaPosition {
    /** 纬度 */
    lat: number;
    /** 经度 */
    lon: number;
    /** 高度(km) */
    alt: number;
    /** 速度(km/h) */
    vel: number;
    /** 可见性（daylight/eclipsed/unknown） */
    visibility: string;
    /** 覆盖范围(km) */
    footprint: number;
    /** 时间戳 */
    timestamp: number;
}
/** N2YO API位置数据 */
export interface N2yoPosition {
    /** 纬度 */
    lat: number;
    /** 经度 */
    lon: number;
    /** 高度(km) */
    alt: number;
    /** 速度(km/h) */
    vel: number;
    /** 仰角(度) */
    elevation: number;
    /** 方位角(度) */
    azimuth: number;
    /** 距离(km) */
    distance: number;
    /** 时间戳 */
    timestamp: number;
}
/** 观测角（仰角/方位角/距离） */
export interface LookAngle {
    /** 仰角(度) */
    elevation: number;
    /** 方位角(度, 0~360) */
    azimuth: number;
    /** 距离(km) */
    distance: number;
}
/** 卫星过境信息 */
export interface SatPass {
    /** 过境开始时间 */
    start: Date;
    /** 最大仰角时间 */
    peak: Date;
    /** 过境结束时间 */
    end: Date;
    /** 最大仰角(度) */
    maxElev: number;
    /** 最大仰角时的方位角(度) */
    azimuth: number;
    /** 开始方位角(度) */
    startAz: number;
    /** 结束方位角(度) */
    endAz: number;
}
/** 归一化阻抗 z = r + jx */
export interface NormalizedZ {
    /** 归一化电阻 */
    r: number;
    /** 归一化电抗 */
    x: number;
}
/** 反射系数 Γ = Γr + jΓi */
export interface Gamma {
    /** 反射系数实部 */
    re: number;
    /** 反射系数虚部 */
    im: number;
}
/** Canvas像素坐标 */
export interface PixelCoord {
    /** 像素X坐标 */
    px: number;
    /** 像素Y坐标 */
    py: number;
}
/** 太阳活动数据 */
export interface SolarData {
    /** 太阳射电流量(SFI/F10.7) */
    sfi: number;
    /** 太阳黑子数(SN) */
    sn: number;
    /** A指数 */
    aIndex: number;
    /** K指数 */
    kIndex: number;
    /** X级耀斑等级 */
    xClass: string;
    /** 数据时间戳(ISO) */
    timestamp: string;
}
/** 太阳活动历史数据点 */
export interface SolarHistoryPoint {
    /** 太阳射电流量 */
    sfi: number;
    /** 太阳黑子数 */
    sn: number;
    /** 时间戳(ms) */
    time: number;
}
/** 传播预测参数 */
export interface PropagationParams {
    /** F2层临界频率(MHz) */
    foF2: number;
    /** 通信距离(km) */
    distance: number;
    /** 发射功率(W) */
    txPower: number;
    /** 工作频率(MHz) */
    freqMHz: number;
    /** 太阳通量指数 */
    solarFlux: number;
    /** UTC时间(0-23) */
    hourUTC: number;
    /** 天线增益(dBi) */
    gain_dBi?: number;
    /** 电离层反射高度(km) */
    hopHeight?: number;
}
/** 传播预测结果 */
export interface PropagationResult {
    /** 最大可用频率(MHz) */
    muf: string;
    /** 最佳工作频率(MHz) */
    fot: string;
    /** 最低可用频率(MHz) */
    luf: string;
    /** 接收信号强度(dBm) */
    signalDbm: string;
    /** 信噪比(dB) */
    snr: string;
    /** 传播质量（优/良/一般/差） */
    quality: string;
    /** 推荐建议 */
    recommendation: string;
}
/** 频段推荐 */
export interface BandRecommendation {
    /** 频段名称 */
    band: string;
    /** 中心频率(MHz) */
    freq: string;
    /** 评分(0-100) */
    score: number;
}
/** 时钟配置 */
export interface ClockConfig {
    /** 显示名称 */
    name: string;
    /** 时区标识（如Asia/Shanghai） */
    tz: string;
}
/** DOM缓存统计 */
export interface CacheStats {
    /** 缓存命中次数 */
    hits: number;
    /** 缓存未命中次数 */
    misses: number;
    /** 缓存条目数 */
    size: number;
}
/** Tab定义 */
export interface TabDef {
    /** Tab唯一标识 */
    id: string;
    /** Tab显示文本 */
    label: string;
    /** Tab图标(emoji) */
    icon: string;
}
/** 应用全局状态 */
export interface AppState {
    /** 当前活动Tab ID */
    activeTab: string;
    /** 状态栏消息 */
    statusMessage: string;
    /** 状态栏颜色 */
    statusColor: string;
    /** 数据是否加载完成 */
    dataLoaded: boolean;
    /** 已加载的模块 */
    modules: Record<string, unknown>;
}
/** 摩尔斯码编码映射：字符→摩尔斯码符号 */
export type MorseCodeMap = Record<string, string>;
/** 摩尔斯码解码映射：摩尔斯码符号→字符 */
export type MorseDecodeMap = Record<string, string>;
/** 静态数据集合（从JSON文件加载） */
export interface StaticData {
    /** 频段数据 */
    bands: Band[];
    /** 通信模式列表 */
    modes: string[];
    /** 馈线类型数据 */
    coaxTypes: CoaxTypes;
    /** Q简语数据 */
    qCodes: QCodeEntry[];
    /** 英文缩略语 */
    engAbbrev: AbbrevEntry[];
    /** 数字缩略语 */
    numAbbrev: AbbrevEntry[];
    /** 城市坐标：城市名→[纬度, 经度] */
    cityCoords: Record<string, [number, number]>;
    /** 通信模式参考分类 */
    modesRef: ModeRefCategory[];
    /** 默认时钟配置 */
    defaultClocks: ClockConfig[];
    /** RST信号报告数据 */
    rstData: {
        readability: string[];
        strength: string[];
        tone: string[];
    };
}
/** Toast通知类型 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';
/** 卫星API数据源 */
export type SatApiSource = 'wtia' | 'n2yo';
