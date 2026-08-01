/**
 * HAM Radio Toolbox - 核心常量与数据模块 (ES Module)
 * 包含频段数据、馈线数据、Q简语、缩略语、摩尔斯码等基础数据
 * 以及核心计算函数（频率转换、波长、网格坐标、功率、SWR等）
 * 静态数据优先从JSON文件加载，内联数据作为fallback
 * @module core
 */
import * as Data from './data/index.js';
import * as RfService from './services/rf-service.js';
import * as GeoService from './services/geo-service.js';
import * as MorseService from './services/morse-service.js';
import * as LogService from './services/log-service.js';
import * as VoacapService from './services/voacap-service.js';
import * as SatelliteService from './services/satellite-service.js';
import { showToast } from './ham-toast.js';
// ============================================================
// 集中配置 - 外部URL和常量集中管理
// ============================================================
const CONFIG = {
    /** 传播条件图表URL */
    PROP_IMG_URL: 'https://hamqsl.com/solar101vhfpic.php',
    /** MapLibre地图样式 - 高德地图栅格瓦片（国内源，中文标注） */
    MAP_STYLE: {
        version: 8,
        name: 'amap-light',
        sources: {
            'amap-tiles': {
                type: 'raster',
                tiles: [
                    'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                    'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                    'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                    'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
                ],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 18
            }
        },
        layers: [{
                id: 'amap-layer',
                type: 'raster',
                source: 'amap-tiles',
                minzoom: 1,
                maxzoom: 18
            }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
    },
    /** 日志localStorage键名 */
    LOG_KEY: 'ham_qso_log',
    /** 自定义时钟localStorage键名 */
    CLOCK_KEY: 'ham_custom_clocks'
};
// ============================================================
// 物理常量
// ============================================================
/** 光速 (m/s) */
const C = 299792458;
// ============================================================
// 频段分类中文映射
// ============================================================
const CAT_CN = {
    "VLF": "甚低频", "LF": "低频", "MF": "中频", "HF": "高频",
    "VHF": "甚高频", "UHF": "特高频", "SHF": "超高频", "EHF": "极高频"
};
// ============================================================
// 业余频段数据（依据《中华人民共和国无线电频率划分规定》）
// ============================================================
let BANDS = [
    { name: "2200m", f_low: 0.1357, f_high: 0.1378, cat: "LF", license: "B(≤15W)/C(≤1000W)", svc: "次要业务" },
    { name: "630m", f_low: 0.472, f_high: 0.479, cat: "MF", license: "B(≤15W)/C(≤1000W)", svc: "次要业务" },
    { name: "160m", f_low: 1.8, f_high: 2.0, cat: "MF", license: "B(≤15W)/C(≤1000W)", svc: "共同主要业务" },
    { name: "80m", f_low: 3.5, f_high: 3.9, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "共同主要业务" },
    { name: "60m", f_low: 5.3515, f_high: 5.3665, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "次要业务",
        note: "频道化操作，共15个信道(5.3515-5.3665MHz，每信道3kHz)", channels: [
            { freq: 5.3515, ch: 1 }, { freq: 5.3545, ch: 2 }, { freq: 5.3575, ch: 3 }, { freq: 5.3605, ch: 4 }, { freq: 5.3635, ch: 5 }
        ] },
    { name: "40m", f_low: 7.0, f_high: 7.2, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "主要业务、共同主要业务",
        subs: [
            { label: "专用段", f_low: 7.0, f_high: 7.1, svc: "主要业务" },
            { label: "共用段", f_low: 7.1, f_high: 7.2, svc: "共同主要业务" }
        ] },
    { name: "30m", f_low: 10.1, f_high: 10.15, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "次要业务" },
    { name: "20m", f_low: 14.0, f_high: 14.35, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "主要业务、共同主要业务",
        subs: [
            { label: "专用段", f_low: 14.0, f_high: 14.25, svc: "主要业务" },
            { label: "共用段", f_low: 14.25, f_high: 14.35, svc: "共同主要业务" }
        ] },
    { name: "17m", f_low: 18.068, f_high: 18.168, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "共同主要业务" },
    { name: "15m", f_low: 21.0, f_high: 21.45, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "主要业务" },
    { name: "12m", f_low: 24.89, f_high: 24.99, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "共同主要业务" },
    { name: "10m", f_low: 28.0, f_high: 29.7, cat: "HF", license: "B(≤15W)/C(≤1000W)", svc: "主要业务" },
    { name: "6m", f_low: 50.0, f_high: 54.0, cat: "VHF", license: "A/B/C(≤25W)", svc: "共同主要业务" },
    { name: "2m", f_low: 144.0, f_high: 148.0, cat: "VHF", license: "A/B/C(≤25W)", svc: "主要业务、共同主要业务",
        subs: [
            { label: "专用段", f_low: 144.0, f_high: 146.0, svc: "主要业务" },
            { label: "共用段", f_low: 146.0, f_high: 148.0, svc: "共同主要业务" }
        ] },
    { name: "70cm", f_low: 430.0, f_high: 440.0, cat: "UHF", license: "A/B/C(≤25W)", svc: "次要业务" },
    { name: "23cm", f_low: 1240.0, f_high: 1300.0, cat: "UHF", license: "A/B/C(≤25W)", svc: "次要业务" },
    { name: "6cm", f_low: 5650.0, f_high: 5850.0, cat: "SHF", license: "B/C(≤25W)", svc: "次要业务" },
    { name: "3cm", f_low: 10000.0, f_high: 10500.0, cat: "SHF", license: "B/C(≤25W)", svc: "次要业务" },
    { name: "1.2cm", f_low: 24000.0, f_high: 24250.0, cat: "SHF", license: "B/C(≤25W)", svc: "次要业务" },
    { name: "6mm", f_low: 47000.0, f_high: 47200.0, cat: "EHF", license: "B/C(≤25W)", svc: "主要业务" }
];
/** B类30MHz以下功率限制说明（2024年3月1日新规） */
const B_CLASS_NOTE = "B类30MHz以下≤15W（2024年3月1日后新规，此前≤100W）";
// ============================================================
// 频段分类
// ============================================================
const SPECTRUM_CATS = [
    [0.003, 0.03, "VLF"], [0.03, 0.3, "LF"], [0.3, 3, "MF"], [3, 30, "HF"],
    [30, 300, "VHF"], [300, 3000, "UHF"], [3000, 30000, "SHF"], [30000, 300000, "EHF"]
];
// ============================================================
// 馈线类型
// ============================================================
let COAX_TYPES = {
    "RG174": { 100: 6.6, 200: 9.5, 400: 14.0, 1000: 23.0, 2400: 40.0 },
    "RG58": { 100: 4.6, 200: 6.8, 400: 11.0, 1000: 20.0, 2400: 34.0 },
    "RG213": { 100: 1.8, 200: 2.7, 400: 4.2, 1000: 7.5, 2400: 13.5 },
    "RG8X": { 100: 2.9, 200: 4.2, 400: 6.5, 1000: 12.0, 2400: 22.0 },
    "LMR240": { 100: 2.1, 200: 3.0, 400: 4.6, 1000: 8.0, 2400: 14.2 },
    "LMR400": { 100: 1.2, 200: 1.7, 400: 2.7, 1000: 4.9, 2400: 8.9 },
    "LMR600": { 100: 0.8, 200: 1.1, 400: 1.8, 1000: 3.3, 2400: 6.0 }
};
// ============================================================
// 通信模式
// ============================================================
let MODES = ["SSB", "CW", "FM", "AM", "DMR", "C4FM", "D-STAR", "FT8", "FT4", "RTTY", "PSK31", "JT65", "JT9", "WSPR", "SSTV", "ATV", "其他"];
// ============================================================
// Q简语（ITU Appendix 14）
// ============================================================
let Q_CODES = [
    ["QRA", "你台名称是什么？", "我台名称是___。"],
    ["QRB", "你离我多远？", "我离你约___km。"],
    ["QRC", "你的真方位角是多少？", "我的真方位角是___度。"],
    ["QRD", "你要到哪里去？", "我要到___去。"],
    ["QRE", "你何时到达？", "我将于___时到达。"],
    ["QRF", "你要返回吗？", "我要返回___。"],
    ["QRG", "我的确切频率是多少？", "你的确切频率是___kHz。"],
    ["QRH", "我的频率变动吗？", "你的频率在变动。"],
    ["QRI", "我的音调如何？", "你的音调___(1-3)。"],
    ["QRK", "我的信号可辨度如何？", "你的信号可辨度___(1-5)。"],
    ["QRL", "你忙吗？", "我忙(或___忙)。"],
    ["QRM", "你受到干扰吗？", "我受到___级干扰。"],
    ["QRN", "你受到天电干扰吗？", "我受到___级天电干扰。"],
    ["QRO", "要我增加功率吗？", "增加功率。"],
    ["QRP", "要我降低功率吗？", "降低功率。"],
    ["QRQ", "要我发快些吗？", "发快些(___WPM)。"],
    ["QRS", "要我发慢些吗？", "发慢些(___WPM)。"],
    ["QRT", "要我停止发送吗？", "停止发送。"],
    ["QRU", "你有什么给我吗？", "我没有什么给你。"],
    ["QRV", "你准备好了吗？", "我准备好了。"],
    ["QRW", "要我通知___你在呼叫吗？", "请通知___我在呼叫。"],
    ["QRX", "你什么时候再呼叫我？", "我将在___时再呼叫你。"],
    ["QRY", "我应轮到第几？", "你应轮到第___号。"],
    ["QRZ", "谁在呼叫我？", "你在被___呼叫。"],
    ["QSA", "我的信号强度如何？", "你的信号强度___(1-5)。"],
    ["QSB", "我的信号衰落吗？", "你的信号在衰落。"],
    ["QSD", "我的按键有毛病吗？", "你的按键有毛病。"],
    ["QSK", "你能在我发射间隙收听吗？", "我能在我发射间隙收听(插入操作)。"],
    ["QSL", "你能确认收妥吗？", "我确认收妥。"],
    ["QSN", "你在___kHz上听到我了吗？", "我在___kHz上听到了你。"],
    ["QSO", "你能与___直接联络吗？", "我能与___直接联络。"],
    ["QSP", "你能转发给___吗？", "我可以转发给___。"],
    ["QST", "普遍呼叫(面向全体业余电台的通告)", ""],
    ["QSU", "我应在___频率上发送吗？", "在___频率上发送。"],
    ["QSV", "要我在此频率上发送V信号吗？", "在此频率上发送___个V信号。"],
    ["QSX", "你能在___频率上收听吗？", "我可以在___频率上收听。"],
    ["QSY", "要我改到另一频率吗？", "改到___频率。"],
    ["QSZ", "要我每组发送两次吗？", "每组发送两次。"],
    ["QTA", "要我取消第___号电报吗？", "取消第___号电报。"],
    ["QTB", "你同意我的字数计算吗？", "我不同意，我将重复每个字的第一字符以供核对。"],
    ["QTC", "你有几份电报要发？", "我有___份电报要发。"],
    ["QTE", "我的真方位角是多少(相对于你)？", "你的真方位角是___度。"],
    ["QTH", "你的位置在哪里？", "我的位置是___(经纬度/网格)。"],
    ["QTR", "现在的准确时间是多少？", "现在的准确时间是___。"],
    ["QTU", "你的电台何时开放？", "我的电台从___到___开放。"]
];
// ============================================================
// 英文缩略语（不含Q码，Q码见Q_CODES；不含数字缩略语，见NUM_ABBREV）
// ============================================================
let ENG_ABBREV = [
    ["ABT", "大约", "About"], ["AGN", "再次", "Again"], ["ANT", "天线", "Antenna"],
    ["BK", "打断/回复", "Break"], ["CQ", "普遍呼叫", "Calling Any Station"],
    ["CL", "关台", "Closing Station"], ["COND", "传播条件", "Conditions"],
    ["CS", "呼号", "Call Sign"], ["CW", "等幅电报", "Continuous Wave"],
    ["DE", "来自", "From"], ["DR", "亲爱的", "Dear"], ["DX", "远距离通信", "DX/Distance"],
    ["ES", "和", "And"], ["FB", "好/优秀", "Fine Business"],
    ["GA", "下午好", "Good Afternoon"], ["GB", "再见", "Good Bye"],
    ["GE", "晚上好", "Good Evening"], ["GM", "早上好", "Good Morning"],
    ["GN", "晚安", "Good Night"], ["HI", "笑声", "Laughter"],
    ["HPE", "希望", "Hope"], ["HR", "这里", "Here"],
    ["HRD", "收到/听见了", "Heard"], ["HV", "有", "Have"],
    ["HW", "抄收如何", "How Copy"], ["K", "请回答", "Go Ahead"],
    ["LID", "不熟练的操作者", "Poor Operator"], ["M", "米(波长)", "Meters"],
    ["MSG", "电报/消息", "Message"], ["N", "北", "North"],
    ["NIL", "无/未通联", "Nothing"], ["NW", "现在", "Now"],
    ["OB", "老兄", "Old Boy"], ["OK", "确认", "Okay"],
    ["OM", "老伙计", "Old Man"], ["OP", "操作员", "Operator"],
    ["PSE", "请", "Please"], ["PWR", "功率", "Power"],
    ["R", "收到/确认", "Roger"], ["RCVR", "接收机", "Receiver"],
    ["REF", "参考", "Reference"], ["RIG", "电台设备", "Radio Equipment"],
    ["RX", "接收", "Receive"], ["SIG", "信号", "Signal"],
    ["SK", "结束通信", "End of Contact"], ["STN", "电台/站点", "Station"],
    ["TNX", "谢谢", "Thanks"], ["TU", "谢谢你", "Thank You"],
    ["TX", "发射", "Transmit"], ["U", "你", "You"],
    ["UR", "你的", "Your"], ["VFO", "可变频率振荡器", "Variable Frequency Oscillator"],
    ["VY", "非常", "Very"], ["W", "瓦特", "Watts"],
    ["WID", "与/和", "With"], ["WKD", "已通联", "Worked"],
    ["WX", "天气", "Weather"], ["XYL", "妻子", "Wife"],
    ["YL", "女士", "Young Lady"], ["Z", "Zulu时间/UTC", "Zulu Time/UTC"],
    ["BCNU", "希望能见到你", "Be Seeing You"], ["B4", "之前", "Before"],
    ["CU", "再见", "See You"], ["CUL", "回头见", "See You Later"],
    ["FER", "为了", "For"]
];
// ============================================================
// 数字缩略语
// ============================================================
let NUM_ABBREV = [
    ["73", "最美好的祝愿", "Best Regards"],
    ["88", "爱与亲吻", "Love and Kisses"],
    ["33", "姐妹般的问候", "Sisterly Regards (YL)"]
];
// ============================================================
// 摩尔斯码
// ============================================================
const MORSE_CODE = {
    "A": "·-", "B": "-···", "C": "-·-·", "D": "-··", "E": "·", "F": "··-·", "G": "--·",
    "H": "····", "I": "··", "J": "·---", "K": "-·-", "L": "·-··", "M": "--", "N": "-·",
    "O": "---", "P": "·--·", "Q": "--·-", "R": "·-·", "S": "···", "T": "-", "U": "··-",
    "V": "···-", "W": "·--", "X": "-··-", "Y": "-·--", "Z": "--··",
    "1": "·----", "2": "··---", "3": "···--", "4": "····-", "5": "·····",
    "6": "-····", "7": "--···", "8": "---··", "9": "----·", "0": "-----",
    ".": "·-·-·-", ",": "--··--", "?": "··--··", "'": "·----·", "!": "-·-·--",
    "/": "-··-·", "(": "-·--·", ")": "-·--·-", "&": "·-···", ":": "---···",
    ";": "-·-·-·", "=": "-···-", "+": "·-·-", "-": "-····-", "_": "··--·-",
    "\"": "·-··-·", "$": "···-··-", "@": "·--·-·"
};
const MORSE_REVERSE = {};
Object.entries(MORSE_CODE).forEach(([k, v]) => { MORSE_REVERSE[v] = k; });
// ============================================================
// 城市坐标
// ============================================================
let CITY_COORDS = {
    "北京": [39.9042, 116.4074], "上海": [31.2304, 121.4737], "广州": [23.1291, 113.2644],
    "深圳": [22.5431, 114.0579], "成都": [30.5728, 104.0668], "杭州": [30.2741, 120.1551],
    "武汉": [30.5928, 114.3055], "南京": [32.0603, 118.7969], "重庆": [29.5630, 106.5516],
    "西安": [34.3416, 108.9398], "天津": [39.3434, 117.3616], "苏州": [31.2990, 120.5853],
    "长沙": [28.2282, 112.9388], "沈阳": [41.8057, 123.4315], "哈尔滨": [45.8038, 126.5350],
    "大连": [38.9140, 121.6147], "济南": [36.6512, 117.1201], "青岛": [36.0671, 120.3826],
    "郑州": [34.7466, 113.6254], "昆明": [25.0389, 102.7183], "福州": [26.0745, 119.2965],
    "厦门": [24.4798, 118.0894], "合肥": [31.8206, 117.2272], "南昌": [28.6820, 115.8579],
    "太原": [37.8706, 112.5489], "贵阳": [26.6470, 106.6302], "兰州": [36.0611, 103.8343],
    "乌鲁木齐": [43.8256, 87.6168], "拉萨": [29.6520, 91.1720], "呼和浩特": [40.8424, 111.7490],
    "南宁": [22.8170, 108.3665], "海口": [20.0440, 110.1999], "银川": [38.4872, 106.2309],
    "西宁": [36.6171, 101.7782], "石家庄": [38.0428, 114.5149], "长春": [43.8171, 125.3235],
    "台北": [25.0330, 121.5654], "香港": [22.3193, 114.1694], "澳门": [22.1987, 113.5439],
    "东京": [35.6762, 139.6503], "大阪": [34.6937, 135.5023], "首尔": [37.5665, 126.9780],
    "釜山": [35.1796, 129.0756], "新加坡": [1.3521, 103.8198], "曼谷": [13.7563, 100.5018],
    "河内": [21.0278, 105.8342], "雅加达": [-6.2088, 106.8456], "马尼拉": [14.5995, 120.9842],
    "吉隆坡": [3.1390, 101.6869], "新德里": [28.6139, 77.2090], "孟买": [19.0760, 72.8777],
    "莫斯科": [55.7558, 37.6173], "圣彼得堡": [59.9343, 30.3351], "伦敦": [51.5074, -0.1278],
    "巴黎": [48.8566, 2.3522], "柏林": [52.5200, 13.4050], "罗马": [41.9028, 12.4964],
    "马德里": [40.4168, -3.7038], "阿姆斯特丹": [52.3676, 4.9041], "布鲁塞尔": [50.8503, 4.3517],
    "维也纳": [48.2082, 16.3738], "苏黎世": [47.3769, 8.5417], "斯德哥尔摩": [59.3293, 18.0686],
    "赫尔辛基": [60.1699, 24.9384], "华沙": [52.2297, 21.0122], "布拉格": [50.0755, 14.4378],
    "布达佩斯": [47.4979, 19.0402], "雅典": [37.9838, 23.7275], "伊斯坦布尔": [41.0082, 28.9784],
    "开罗": [30.0444, 31.2357], "约翰内斯堡": [-26.2041, 28.0473], "内罗毕": [-1.2921, 36.8219],
    "纽约": [40.7128, -74.0060], "洛杉矶": [34.0522, -118.2437], "旧金山": [37.7749, -122.4194],
    "芝加哥": [41.8781, -87.6298], "华盛顿": [38.9072, -77.0369], "西雅图": [47.6062, -122.3321],
    "休斯顿": [29.7604, -95.3698], "迈阿密": [25.7617, -80.1918], "波士顿": [42.3601, -71.0589],
    "丹佛": [39.7392, -104.9903], "多伦多": [43.6532, -79.3832], "温哥华": [49.2827, -123.1207],
    "蒙特利尔": [45.5017, -73.5673], "墨西哥城": [19.4326, -99.1332], "圣保罗": [-23.5505, -46.6333],
    "布宜诺斯艾利斯": [-34.6037, -58.3816], "里约热内卢": [-22.9068, -43.1729],
    "利马": [-12.0464, -77.0428], "波哥大": [4.7110, -74.0721], "圣地亚哥": [-33.4489, -70.6693],
    "悉尼": [-33.8688, 151.2093], "墨尔本": [-37.8136, 144.9631], "奥克兰": [-36.8485, 174.7633],
    "惠灵顿": [-41.2865, 174.7762], "珀斯": [-31.9505, 115.8605], "夏威夷": [21.3069, -157.8583],
    "安克雷奇": [61.2181, -149.9003], "费尔班克斯": [64.8378, -147.7164],
    "关岛": [13.4443, 144.7937], "斐济": [-17.7134, 178.0650]
};
// ============================================================
// 通信模式参考
// ============================================================
let MODES_REF = [
    { cat: "模拟语音", modes: [
            { a: "SSB", n: "单边带", d: "最常用的HF语音模式，10MHz以下用LSB，10MHz及以上用USB" },
            { a: "AM", n: "调幅", d: "传统调幅模式，带宽6kHz，载波与双边带占用较多功率" },
            { a: "FM", n: "调频", d: "VHF/UHF最常用模式，窄带12.5kHz/宽带25kHz，音质优良" }
        ] },
    { cat: "电报模式", modes: [
            { a: "CW", n: "等幅电报", d: "最经典的通信模式，效率极高，带宽仅约150Hz，国际通识" }
        ] },
    { cat: "数字模式", modes: [
            { a: "RTTY", n: "无线电传", d: "FSK模式，170Hz频移，45.45波特，历史悠久的数字模式" },
            { a: "PSK31", n: "PSK31", d: "窄带BPSK数字模式，31.25波特，适合低功率QRP通信" },
            { a: "FT8", n: "FT8", d: "WSJT-X弱信号数字模式，8秒周期，当前最流行的HF数字模式" },
            { a: "FT4", n: "FT4", d: "WSJT-X快速数字模式，4秒周期，专为竞赛设计" },
            { a: "JT65", n: "JT65", d: "弱信号模式，60秒周期，广泛用于EME和HF DX" },
            { a: "JT9", n: "JT9", d: "极弱信号HF模式，60秒周期，带宽仅15.6Hz" },
            { a: "WSPR", n: "WSPR", d: "弱信号传播信标，120秒周期，用于传播路径研究" }
        ] },
    { cat: "数字语音", modes: [
            { a: "DMR", n: "DMR", d: "双时隙TDMA，12.5kHz带宽，兼容商用标准，支持互联网互联" },
            { a: "C4FM", n: "C4FM", d: "Yaesu System Fusion数字语音模式，VHF/UHF频段" },
            { a: "D-STAR", n: "D-STAR", d: "JARL制定的数字标准，6.25kHz带宽，支持互联网网关" }
        ] },
    { cat: "图像传输", modes: [
            { a: "SSTV", n: "慢扫描电视", d: "静止图像传输模式，常见模式约36秒至2分钟传一幅" },
            { a: "ATV", n: "业余电视", d: "快扫描电视，传输实时视频信号，需较宽带宽" }
        ] }
];
// ============================================================
// 默认时钟
// ============================================================
let DEFAULT_CLOCKS = [
    { name: "UTC", tz: "UTC" }, { name: "北京", tz: "Asia/Shanghai" },
    { name: "东京", tz: "Asia/Tokyo" }, { name: "悉尼", tz: "Australia/Sydney" },
    { name: "伦敦", tz: "Europe/London" }, { name: "纽约", tz: "America/New_York" }
];
// ============================================================
// RST 信号报告
// ============================================================
let R_READABILITY = ['', '不可辨', '勉强可辨', '可辨但困难', '可辨，有困难', '完美可辨'];
let S_STRENGTH = ['', '极微弱', '很微弱', '微弱', '弱', '较好', '好', '相当强', '强', '很强', '极强'];
let T_TONE = ['', '粗糙直流', '非常粗糙', '粗糙低频交流', '粗糙交流', '带调制交流', '调制好，有杂音', '接近直流，轻微调制', '好的直流，有轻微调制', '极好的直流，低杂音', '完美直流'];
// ============================================================
// 工具函数
// ============================================================
/**
 * 填充下拉选择框
 * @param selectId - select元素ID
 * @param items - 选项数组
 * @param valueFn - 获取value的函数
 * @param textFn - 获取显示文本的函数
 */
function populateSelect(selectId, items, valueFn, textFn) {
    const sel = document.getElementById(selectId);
    if (!sel)
        return;
    items.forEach(item => {
        const o = document.createElement('option');
        o.value = valueFn(item);
        o.textContent = textFn(item);
        sel.appendChild(o);
    });
}
/**
 * HTML转义 - 防止XSS注入
 * @param s - 需要转义的字符串
 * @returns 转义后的安全HTML字符串
 */
function escHtml(s) {
    if (s == null)
        return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * 验证URL是否为安全的http/https协议
 * @param url - 需要验证的URL字符串
 * @returns 安全的URL或空字符串
 */
function safeUrl(url) {
    if (!url || typeof url !== 'string')
        return '';
    try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? url : '';
    }
    catch (_e) {
        return '';
    }
}
/**
 * 渲染数据表格
 * @param tableId - table元素ID（不含#）
 * @param data - 数据数组
 * @param rowFn - 行渲染函数，返回HTML字符串
 */
function renderTable(tableId, data, rowFn) {
    const tbody = document.querySelector('#' + tableId + ' tbody');
    if (!tbody)
        return;
    tbody.innerHTML = data.map(rowFn).join('');
}
// ============================================================
// 核心计算函数
// ============================================================
/**
 * 频率单位转换为MHz
 * @param val - 频率值
 * @param unit - 单位 (kHz/MHz/GHz)
 * @returns MHz值
 */
function freqToMHz(val, unit) {
    val = parseFloat(String(val));
    if (isNaN(val))
        return NaN;
    if (unit === 'kHz')
        return val / 1000;
    if (unit === 'GHz')
        return val * 1000;
    return val;
}
/**
 * 根据频率查找所属业余频段
 * @param freqMHz - 频率(MHz)
 * @returns 频段对象或null
 */
function freqToBand(freqMHz) {
    for (let i = 0; i < BANDS.length; i++) {
        if (freqMHz >= BANDS[i].f_low && freqMHz <= BANDS[i].f_high) {
            const band = BANDS[i];
            if (band.subs) {
                for (let j = 0; j < band.subs.length; j++) {
                    if (freqMHz >= band.subs[j].f_low && freqMHz <= band.subs[j].f_high) {
                        return Object.assign({}, band, { sub: band.subs[j] });
                    }
                }
            }
            return band;
        }
    }
    return null;
}
/**
 * 根据频率获取频谱分类
 * @param freqMHz - 频率(MHz)
 * @returns 频谱分类(VLF/LF/MF/HF/VHF/UHF/SHF/EHF)或null
 */
function getSpectrumCat(freqMHz) {
    for (let i = 0; i < SPECTRUM_CATS.length; i++) {
        if (freqMHz >= SPECTRUM_CATS[i][0] && freqMHz < SPECTRUM_CATS[i][1])
            return SPECTRUM_CATS[i][2];
    }
    return null;
}
// ============================================================
// 射频计算函数 — 委托给 RfService
// ============================================================
/**
 * 计算波长
 * @param freqMHz - 频率(MHz)
 * @returns 波长(米)
 */
function wavelength(freqMHz) { return RfService.calcWavelength(freqMHz); }
/**
 * 计算半波偶极天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 半波长度和每臂长度(米)
 */
function dipoleLength(freqMHz) { return RfService.calcDipoleLength(freqMHz); }
/**
 * 计算1/4波长天线长度
 * @param freqMHz - 频率(MHz)
 * @returns 1/4波长长度(米)，含0.95缩短系数
 */
function quarterWaveLength(freqMHz) { return RfService.calcQuarterWaveLength(freqMHz); }
// ============================================================
// 地理计算函数 — 委托给 GeoService
// ============================================================
/**
 * 网格坐标转经纬度
 * @param grid - 梅登黑德网格坐标(4或6字符，如OM89或OM89MM)
 * @returns 经纬度对象或null
 */
function gridToLatLon(grid) { return GeoService.gridToLatLon(grid); }
/**
 * 经纬度转网格坐标
 * @param lat - 纬度(-90~90)
 * @param lon - 经度(-180~180)
 * @returns 梅登黑德网格坐标(6字符)或null
 */
function latLonToGrid(lat, lon) { return GeoService.latLonToGrid(lat, lon); }
/**
 * 计算两点间距离和方位角
 * @param lat1 - 起点纬度
 * @param lon1 - 起点经度
 * @param lat2 - 终点纬度
 * @param lon2 - 终点经度
 * @returns 距离(km)和方位角(度)
 */
function distanceBearing(lat1, lon1, lat2, lon2) {
    const r = GeoService.calcDistanceBearing(lat1, lon1, lat2, lon2);
    return { distance: r.distance, bearing: r.bearing };
}
// ============================================================
// 功率转换函数 — 委托给 RfService
// ============================================================
/** @param dbm - dBm值 @returns 瓦特 */
function dbmToWatts(dbm) { return RfService.dbmToWatts(dbm); }
/** @param w - 瓦特 @returns dBm值 */
function wattsToDbm(w) { return RfService.wattsToDbm(w); }
/** @param w - 瓦特 @returns dBW值 */
function wattsToDbw(w) { return RfService.wattsToDbw(w); }
/** @param dbw - dBW值 @returns 瓦特 */
function dbwToWatts(dbw) { return RfService.dbwToWatts(dbw); }
/** @param dbm - dBm值 @returns dBW值 */
function dbmToDbw(dbm) { return RfService.dbmToDbw(dbm); }
/**
 * 由正向/反射功率计算SWR — 委托给 RfService
 * @param fw - 正向功率(W)
 * @param rw - 反射功率(W)
 * @returns SWR值或null(参数无效)
 */
function swrFromPower(fw, rw) { return RfService.calcSwrFromPower(fw, rw); }
/**
 * 由SWR计算反射功率 — 委托给 RfService
 * @param swr - 驻波比
 * @param fw - 正向功率(W)
 * @returns 反射功率(W)或null(参数无效)
 */
function swrToReflectPower(swr, fw) { return RfService.calcReflectPower(swr, fw); }
/**
 * 计算馈线衰减量 — 委托给 RfService
 * @param type - 馈线类型(如RG58/LMR400)
 * @param freqMHz - 频率(MHz)
 * @param lengthM - 长度(米)
 * @returns 衰减量(dB)或null(类型不存在)
 */
function coaxAttenuation(type, freqMHz, lengthM) {
    return RfService.calcCoaxAttenuation(COAX_TYPES[type], freqMHz, lengthM);
}
// ============================================================
// 莫尔斯电码函数 — 委托给 MorseService（保留全角转换兼容）
// ============================================================
/**
 * 文本转摩尔斯码
 * @param text - 输入文本（支持全角→半角转换）
 * @returns 摩尔斯码字符串（空格分隔，/表示词间空格）
 */
function morseEncode(text) {
    text = text.replace(/[\uff00-\uffef]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    return MorseService.morseEncode(text);
}
/**
 * 摩尔斯码转文本
 * @param morse - 摩尔斯码字符串（支持·和.两种点号）
 * @returns 解码文本
 */
function morseDecode(morse) {
    morse = morse.replace(/·/g, '.');
    return MorseService.morseDecode(morse);
}
/**
 * 解析QTH定位（支持网格坐标/经纬度/城市名）— 委托给 GeoService
 * @param qth - QTH字符串(如OM89MM或39.9,116.4或北京)
 * @returns 坐标对象或null
 */
function parseQth(qth) {
    if (!qth)
        return null;
    qth = qth.trim();
    const gridMatch = qth.match(/^([A-Za-z]{2}\d{2}[A-Za-z]{0,2})$/);
    if (gridMatch) {
        const c = GeoService.gridToLatLon(gridMatch[1]);
        if (c) {
            const result = { ...c, source: 'grid', grid: gridMatch[1].toUpperCase() };
            return result;
        }
        return null;
    }
    const llMatch = qth.match(/^(-?\d+\.?\d*)\s*[,，\s]\s*(-?\d+\.?\d*)$/);
    if (llMatch)
        return { lat: parseFloat(llMatch[1]), lon: parseFloat(llMatch[2]), source: 'coords' };
    const city = CITY_COORDS[qth] || CITY_COORDS[Object.keys(CITY_COORDS).find(k => k.toLowerCase() === qth.toLowerCase())];
    if (city)
        return { lat: city[0], lon: city[1], source: 'city', cityName: qth };
    return null;
}
// ============================================================
// 数据加载器：从JSON文件加载静态数据，覆盖内联fallback
// ============================================================
/**
 * 初始化静态数据（从JSON文件加载）
 * 加载成功后覆盖内联fallback数据
 * @returns Promise<void>
 */
async function initData() {
    try {
        await Data.loadAll();
        if (Data.get('bands') && Data.get('bands').length)
            BANDS = Data.get('bands');
        if (Data.get('modes') && Data.get('modes').length)
            MODES = Data.get('modes');
        if (Data.get('coaxTypes') && Object.keys(Data.get('coaxTypes')).length)
            COAX_TYPES = Data.get('coaxTypes');
        if (Data.get('qCodes') && Data.get('qCodes').length)
            Q_CODES = Data.get('qCodes');
        if (Data.get('engAbbrev') && Data.get('engAbbrev').length)
            ENG_ABBREV = Data.get('engAbbrev');
        if (Data.get('numAbbrev') && Data.get('numAbbrev').length)
            NUM_ABBREV = Data.get('numAbbrev');
        if (Data.get('cityCoords') && Object.keys(Data.get('cityCoords')).length)
            CITY_COORDS = Data.get('cityCoords');
        if (Data.get('modesRef') && Data.get('modesRef').length)
            MODES_REF = Data.get('modesRef');
        if (Data.get('defaultClocks') && Data.get('defaultClocks').length)
            DEFAULT_CLOCKS = Data.get('defaultClocks');
        if (Data.get('rstData')) {
            if (Data.get('rstData').readability)
                R_READABILITY = Data.get('rstData').readability;
            if (Data.get('rstData').strength)
                S_STRENGTH = Data.get('rstData').strength;
            if (Data.get('rstData').tone)
                T_TONE = Data.get('rstData').tone;
        }
        console.log('[HAM] Static data loaded from JSON files');
    }
    catch (e) {
        console.warn('[HAM] Failed to load JSON data, using inline fallback:', e);
        showToast('部分数据加载失败，使用内置备用数据', 'warning');
    }
}
// ============================================================
// 导出
// ============================================================
export { CONFIG, C, CAT_CN, B_CLASS_NOTE, SPECTRUM_CATS, MORSE_CODE, MORSE_REVERSE, populateSelect, renderTable, escHtml, safeUrl, freqToMHz, freqToBand, getSpectrumCat, wavelength, dipoleLength, quarterWaveLength, gridToLatLon, latLonToGrid, distanceBearing, dbmToWatts, wattsToDbm, wattsToDbw, dbwToWatts, dbmToDbw, swrFromPower, swrToReflectPower, coaxAttenuation, morseEncode, morseDecode, parseQth, initData, BANDS, COAX_TYPES, MODES, Q_CODES, ENG_ABBREV, NUM_ABBREV, CITY_COORDS, MODES_REF, DEFAULT_CLOCKS, R_READABILITY, S_STRENGTH, T_TONE, RfService, GeoService, MorseService, LogService, VoacapService, SatelliteService };