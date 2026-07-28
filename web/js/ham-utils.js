/**
 * HAM Radio Toolbox - 工具 Tab 模块 (ES Module)
 * 包含世界时钟、传播条件、RST信号报告
 * 改进：时钟DOM复用（仅更新时间文本）、CONFIG引用、EventBus解耦
 * @module ham-utils
 */
'use strict';
import { CONFIG, DEFAULT_CLOCKS, R_READABILITY, S_STRENGTH, T_TONE, escHtml } from './core.js';
import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';
let customClocks = [];
try {
    customClocks = JSON.parse(localStorage.getItem(CONFIG.CLOCK_KEY) || '[]') || [];
}
catch (_e) { }
// DOM复用：标记是否需要完整重建
let clockNeedsRebuild = true;
let lastClockCount = 0;
/**
 * 更新时钟显示
 * 优化：仅在时钟列表变化时重建DOM，每秒仅更新时间/日期文本
 */
function updateClocks() {
    const grid = document.getElementById('clockGrid');
    if (!grid)
        return;
    const all = DEFAULT_CLOCKS.concat(customClocks);
    // 检查是否需要重建DOM结构
    if (clockNeedsRebuild || all.length !== lastClockCount) {
        _buildClockDOM(grid, all);
        clockNeedsRebuild = false;
        lastClockCount = all.length;
    }
    // 更新时间显示（基于浏览器时区，无需网络请求）
    _updateClockText(grid, all);
}
/**
 * 完整重建时钟DOM结构（仅在时钟列表变化时调用）
 */
function _buildClockDOM(grid, all) {
    grid.innerHTML = all.map((c, i) => {
        const delBtn = i < DEFAULT_CLOCKS.length ? '' :
            '<span class="clock-del-btn" data-idx="' + i + '" title="删除此时钟">✕</span>';
        return '<div class="clock-card" data-tz="' + escHtml(c.tz) + '" data-idx="' + i + '" style="position:relative">' +
            '<div class="tz-name">' + escHtml(c.name) + '</div>' +
            '<div class="tz-time">--:--:--</div>' +
            '<div class="tz-date" style="font-size:10px;color:#999">--</div>' +
            delBtn + '</div>';
    }).join('');
    // 事件委托处理删除按钮
    grid.onclick = function (e) {
        const target = e.target;
        const delBtn = target.closest('.clock-del-btn');
        if (delBtn) {
            const idx = parseInt(delBtn.dataset.idx || '0');
            removeClock(idx);
        }
    };
}
/**
 * 仅更新时钟的时间/日期文本（每秒调用，不重建DOM）
 */
function _updateClockText(grid, all) {
    if (!grid)
        return;
    const cards = grid.querySelectorAll('.clock-card');
    const now = new Date();
    cards.forEach((card, i) => {
        if (i >= all.length)
            return;
        const c = all[i];
        const timeEl = card.querySelector('.tz-time');
        const dateEl = card.querySelector('.tz-date');
        if (!timeEl || !dateEl)
            return;
        try {
            const time = now.toLocaleTimeString('zh-CN', { timeZone: c.tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const date = now.toLocaleDateString('zh-CN', { timeZone: c.tz, month: '2-digit', day: '2-digit', weekday: 'short' });
            timeEl.textContent = time;
            dateEl.textContent = date;
        }
        catch (_e) {
            timeEl.textContent = '时区无效';
            dateEl.textContent = '';
        }
    });
}
// 浏览器内置 IANA 时区列表
const TZ_LIST = (() => {
    try {
        const list = Intl.supportedValuesOf('timeZone');
        if (list && list.length)
            return list;
    }
    catch (_e) { }
    return [];
})();
// 区域名称中文翻译
const REGION_ZH = {
    'Africa': '非洲', 'America': '美洲', 'Antarctica': '南极洲',
    'Asia': '亚洲', 'Atlantic': '大西洋', 'Australia': '澳洲',
    'Europe': '欧洲', 'Indian': '印度洋', 'Pacific': '太平洋',
    'US': '美国', 'Etc': '其他'
};
// 中文城市名→IANA 时区搜索辅助
const ZH_ALIAS = {
    '北京': 'Asia/Shanghai', '上海': 'Asia/Shanghai', '广州': 'Asia/Shanghai',
    '深圳': 'Asia/Shanghai', '成都': 'Asia/Shanghai', '杭州': 'Asia/Shanghai',
    '武汉': 'Asia/Shanghai', '南京': 'Asia/Shanghai', '重庆': 'Asia/Shanghai',
    '西安': 'Asia/Shanghai', '天津': 'Asia/Shanghai',
    '香港': 'Asia/Hong_Kong', '台北': 'Asia/Taipei', '澳门': 'Asia/Macau',
    '东京': 'Asia/Tokyo', '大阪': 'Asia/Tokyo', '首尔': 'Asia/Seoul',
    '新加坡': 'Asia/Singapore', '曼谷': 'Asia/Bangkok',
    '河内': 'Asia/Ho_Chi_Minh', '雅加达': 'Asia/Jakarta',
    '马尼拉': 'Asia/Manila', '吉隆坡': 'Asia/Kuala_Lumpur',
    '新德里': 'Asia/Kolkata', '孟买': 'Asia/Kolkata', '迪拜': 'Asia/Dubai',
    '伦敦': 'Europe/London', '巴黎': 'Europe/Paris', '柏林': 'Europe/Berlin',
    '罗马': 'Europe/Rome', '马德里': 'Europe/Madrid', '莫斯科': 'Europe/Moscow',
    '斯德哥尔摩': 'Europe/Stockholm', '赫尔辛基': 'Europe/Helsinki',
    '华沙': 'Europe/Warsaw', '雅典': 'Europe/Athens',
    '伊斯坦布尔': 'Europe/Istanbul', '阿姆斯特丹': 'Europe/Amsterdam',
    '纽约': 'America/New_York', '华盛顿': 'America/New_York',
    '洛杉矶': 'America/Los_Angeles', '旧金山': 'America/Los_Angeles',
    '芝加哥': 'America/Chicago', '西雅图': 'America/Los_Angeles',
    '多伦多': 'America/Toronto', '温哥华': 'America/Vancouver',
    '墨西哥城': 'America/Mexico_City', '圣保罗': 'America/Sao_Paulo',
    '布宜诺斯艾利斯': 'America/Argentina/Buenos_Aires',
    '悉尼': 'Australia/Sydney', '墨尔本': 'Australia/Melbourne',
    '奥克兰': 'Pacific/Auckland', '开罗': 'Africa/Cairo',
    '约翰内斯堡': 'Africa/Johannesburg', '内罗毕': 'Africa/Nairobi'
};
function _fmtTz(tz) {
    if (tz === 'UTC')
        return 'UTC';
    const p = tz.split('/');
    const region = REGION_ZH[p[0]] || p[0];
    const city = p[p.length - 1].replace(/_/g, ' ');
    return city + ' (' + region + ')';
}
function filterClockOptions() {
    const input = document.getElementById('customTzInput').value.trim();
    const dropdown = document.getElementById('tzDropdown');
    if (!dropdown)
        return;
    if (!TZ_LIST.length) {
        dropdown.innerHTML = '<div style="padding:10px;color:#888;font-size:13px">浏览器不支持时区列表，请直接输入 IANA 时区名后点击添加</div>';
        dropdown.style.display = 'block';
        return;
    }
    const lower = input.toLowerCase();
    const results = [];
    const seenTz = {};
    // 中文城市名匹配
    if (input) {
        for (const zh in ZH_ALIAS) {
            if (zh.indexOf(input) >= 0) {
                const tz = ZH_ALIAS[zh];
                if (!seenTz[tz + '|' + zh]) {
                    results.push({ iana: tz, display: zh + ' → ' + _fmtTz(tz), name: zh });
                    seenTz[tz + '|' + zh] = true;
                }
            }
        }
    }
    // IANA 名称匹配
    if (input) {
        TZ_LIST.forEach(tz => {
            if (results.some(r => r.iana === tz))
                return;
            const fmt = _fmtTz(tz).toLowerCase();
            if (fmt.indexOf(lower) >= 0 || tz.toLowerCase().indexOf(lower) >= 0) {
                const p = tz.split('/');
                const cityName = p[p.length - 1].replace(/_/g, ' ');
                results.push({ iana: tz, display: _fmtTz(tz), name: cityName });
            }
        });
    }
    if (!input) {
        dropdown.innerHTML = '<div style="padding:10px;color:#888;font-size:13px">输入城市名（中文/英文）或时区名搜索...</div>';
        dropdown.style.display = 'block';
        return;
    }
    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding:10px;color:#888;font-size:13px">未找到匹配，也可直接输入 IANA 时区名后点击添加</div>';
        dropdown.style.display = 'block';
        return;
    }
    // 标记已添加
    const all = DEFAULT_CLOCKS.concat(customClocks);
    const addedSet = {};
    all.forEach(c => { addedSet[c.name + '|' + c.tz] = true; });
    dropdown.innerHTML = results.slice(0, 30).map(r => {
        const added = addedSet[r.name + '|' + r.iana];
        const style = added ? 'opacity:0.4;' : '';
        const label = added ? ' (已添加)' : '';
        return '<div style="padding:6px 10px;cursor:pointer;font-size:13px;' + style + '" ' +
            'data-name="' + escHtml(r.name) + '" data-tz="' + escHtml(r.iana) + '" class="tz-option">' +
            escHtml(r.display) + label + '</div>';
    }).join('');
    dropdown.style.display = 'block';
}
function hideClockOptions() {
    setTimeout(() => {
        const dropdown = document.getElementById('tzDropdown');
        if (dropdown)
            dropdown.style.display = 'none';
    }, 200);
}
function selectClock(name, tz) {
    document.getElementById('customTzInput').value = '';
    document.getElementById('tzDropdown').style.display = 'none';
    _doAddClock(name, tz);
}
function _doAddClock(name, tz) {
    const all = DEFAULT_CLOCKS.concat(customClocks);
    for (let i = 0; i < all.length; i++) {
        if (all[i].tz === tz && all[i].name === name) {
            EventBus.emit('status', '该时钟已存在: ' + name);
            return;
        }
    }
    customClocks.push({ name, tz });
    localStorage.setItem(CONFIG.CLOCK_KEY, JSON.stringify(customClocks));
    clockNeedsRebuild = true;
    updateClocks();
    EventBus.emit('status', '时钟已添加: ' + name);
}
function addCustomClock() {
    const input = document.getElementById('customTzInput').value.trim();
    if (!input)
        return;
    // 中文城市名精确匹配
    if (ZH_ALIAS[input]) {
        _doAddClock(input, ZH_ALIAS[input]);
        document.getElementById('customTzInput').value = '';
        return;
    }
    // 中文城市名模糊匹配
    for (const zh in ZH_ALIAS) {
        if (zh.indexOf(input) >= 0) {
            _doAddClock(zh, ZH_ALIAS[zh]);
            document.getElementById('customTzInput').value = '';
            return;
        }
    }
    // IANA 时区名或缩写
    let tz = input;
    const tzMap = {
        'UTC': 'UTC', 'GMT': 'UTC', 'EST': 'America/New_York', 'CST': 'America/Chicago',
        'MST': 'America/Denver', 'PST': 'America/Los_Angeles', 'JST': 'Asia/Tokyo',
        'CET': 'Europe/Paris', 'EET': 'Europe/Helsinki', 'AEST': 'Australia/Sydney',
        'KST': 'Asia/Seoul', 'IST': 'Asia/Kolkata'
    };
    if (tzMap[input.toUpperCase()])
        tz = tzMap[input.toUpperCase()];
    // 通过浏览器Intl API验证时区有效性
    try {
        new Intl.DateTimeFormat('zh-CN', { timeZone: tz });
        _doAddClock(input, tz);
        document.getElementById('customTzInput').value = '';
    }
    catch (_e) {
        showToast('未找到匹配城市，请从下拉列表选择或输入有效的 IANA 时区名。', 'warning');
    }
}
function removeClock(idx) {
    const all = DEFAULT_CLOCKS.concat(customClocks);
    if (idx < DEFAULT_CLOCKS.length || idx >= all.length)
        return;
    const c = all[idx];
    if (!confirm('确定删除时钟 "' + c.name + '"？'))
        return;
    customClocks.splice(idx - DEFAULT_CLOCKS.length, 1);
    localStorage.setItem(CONFIG.CLOCK_KEY, JSON.stringify(customClocks));
    clockNeedsRebuild = true;
    updateClocks();
    EventBus.emit('status', '时钟已删除: ' + c.name);
}
function clearCustomClocks() {
    if (customClocks.length && !confirm('确定清除全部 ' + customClocks.length + ' 个自定义时钟？'))
        return;
    customClocks = [];
    localStorage.removeItem(CONFIG.CLOCK_KEY);
    clockNeedsRebuild = true;
    updateClocks();
    EventBus.emit('status', '自定义时钟已清除');
}
// 传播条件
function propFetch() {
    document.getElementById('propStatus').textContent = '正在刷新...';
    const ts = Date.now();
    // 左侧：传播条件图表
    const imgHtml = '<div style="flex:1;min-width:280px;position:sticky;top:8px;align-self:flex-start">' +
        '<p style="font-weight:600;margin-bottom:6px">太阳传播条件图表</p>' +
        '<img src="' + CONFIG.PROP_IMG_URL + '?' + ts + '" style="max-width:100%;border-radius:4px" alt="太阳传播条件实时图表：包含SFI太阳通量指数、太阳黑子数、A/Kp地磁指数、X射线耀斑等级、太阳风速、频段状况等参数" loading="lazy" onerror="this.outerHTML=\'<div style=padding:12px;background:#fff3e0;border-radius:4px;border:1px solid #ffcc80><p style=color:#e65100;font-weight:600>⚠️ 图表加载失败</p><p style=color:#666;font-size:12px;margin-top:4px>可能原因：网络连接中断或数据源(hamqsl.com)不可用</p><p style=color:#666;font-size:12px>建议：检查网络连接后点击"刷新实时数据"重试</p></div>\'">' +
        '</div>';
    // 右侧：参数含义解读对照表（纯静态）
    let h = '<div style="flex:1;min-width:280px;font-size:12px;line-height:1.7">';
    h += '<p style="font-weight:600;color:#1a237e;margin-bottom:4px">【图表参数解读】</p>';
    h += '<table style="width:100%;border-collapse:collapse;line-height:1.6">';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">SFI<br><span style="font-size:10px;color:#888;font-weight:400">Solar Flux Index</span></td><td style="padding:2px 6px">太阳通量指数，衡量太阳 10.7cm 射电辐射强度，直接决定 HF 传播质量</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Sn<br><span style="font-size:10px;color:#888;font-weight:400">Sunspot Number</span></td><td style="padding:2px 6px">太阳黑子数，与 SFI 正相关，反映太阳活动周期</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">A<br><span style="font-size:10px;color:#888;font-weight:400">A-index</span></td><td style="padding:2px 6px">24 小时地磁活动均值，反映全天地磁扰动程度</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">K<br><span style="font-size:10px;color:#888;font-weight:400">K-index (Kp)</span></td><td style="padding:2px 6px">3 小时行星地磁扰动指数，值越高地磁越活跃</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">X<br><span style="font-size:10px;color:#888;font-weight:400">X-Ray Flux</span></td><td style="padding:2px 6px">太阳耀斑 X 射线通量等级，影响电离层 D 层吸收</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">304A<br><span style="font-size:10px;color:#888;font-weight:400">He II Line 304Å</span></td><td style="padding:2px 6px">太阳极紫外 304Å 氦谱线辐射强度，反映 EUV 对 F 层电离的贡献</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Ptn Flx<br><span style="font-size:10px;color:#888;font-weight:400">Proton Flux (pfu)</span></td><td style="padding:2px 6px">太阳质子事件强度 (pfu)，高值导致极区吸收 (PCA)</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Elc Flx<br><span style="font-size:10px;color:#888;font-weight:400">Electron Flux (pfu)</span></td><td style="padding:2px 6px">辐射带电子浓度 (pfu)，高值影响卫星通信和极区传播</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Wind<br><span style="font-size:10px;color:#888;font-weight:400">Solar Wind (km/s)</span></td><td style="padding:2px 6px">太阳风粒子速度 (km/s)，高速太阳风可引发磁暴</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Aur<br><span style="font-size:10px;color:#888;font-weight:400">Aurora</span></td><td style="padding:2px 6px">极光椭圆带强度，强极光伴随地磁暴和 HF 吸收</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Geo<br><span style="font-size:10px;color:#888;font-weight:400">Geomagnetic Field</span></td><td style="padding:2px 6px">当前地磁场总体状况描述（如 Quiet/Unsettled/Storm）</td></tr>';
    h += '<tr><td style="padding:2px 6px;color:#1a237e;font-weight:600;white-space:nowrap">Sig Noise<br><span style="font-size:10px;color:#888;font-weight:400">Signal Noise Level</span></td><td style="padding:2px 6px">当前信号噪声水平等级，影响弱信号接收能力</td></tr>';
    h += '</table>';
    h += '<div style="border-top:1px solid #e0e0e0;margin-top:6px"></div>';
    h += '<p style="font-weight:600;color:#1a237e;margin-top:6px;margin-bottom:4px">【SFI 等级对照】</p>';
    h += '<table style="width:100%;border-collapse:collapse;line-height:1.6">';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">≥180</td><td style="padding:1px 6px">极高 — HF 全波段极佳，6m 可能开通跨洲</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">150–179</td><td style="padding:1px 6px">高 — 10–15m 波段开阔，全球通联良机</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#f9a825;font-weight:600">120–149</td><td style="padding:1px 6px">中高 — 14–28MHz 传播良好</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#f9a825;font-weight:600">90–119</td><td style="padding:1px 6px">中等 — 20m/17m 可用</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600">70–89</td><td style="padding:1px 6px">低 — 仅 40m/80m 可靠</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600"><70</td><td style="padding:1px 6px">极低 — 仅 80m/160m 可能通联</td></tr>';
    h += '</table>';
    h += '<div style="border-top:1px solid #e0e0e0;margin-top:6px"></div>';
    h += '<p style="font-weight:600;color:#1a237e;margin-top:6px;margin-bottom:4px">【Kp 指数对照】</p>';
    h += '<table style="width:100%;border-collapse:collapse;line-height:1.6">';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">0–1</td><td style="padding:1px 6px">宁静 — 地磁平静，传播稳定</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">2–3</td><td style="padding:1px 6px">正常 — 一般条件可用</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#f9a825;font-weight:600">4–5</td><td style="padding:1px 6px">不稳定 — 高纬度路径受影响</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600">6–7</td><td style="padding:1px 6px">磁暴 — 短波信号大幅衰减</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600">8–9</td><td style="padding:1px 6px">严重磁暴 — HF 传播极差</td></tr>';
    h += '</table>';
    h += '<div style="border-top:1px solid #e0e0e0;margin-top:6px"></div>';
    h += '<p style="font-weight:600;color:#1a237e;margin-top:6px;margin-bottom:4px">【X 射线等级】</p>';
    h += '<table style="width:100%;border-collapse:collapse;line-height:1.6">';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600">X 级</td><td style="padding:1px 6px">强烈耀斑，D 层吸收增强，LF/MF 可能增强</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#f9a825;font-weight:600">M 级</td><td style="padding:1px 6px">中等耀斑，短时 D 层吸收增加</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">C 级</td><td style="padding:1px 6px">小耀斑，对传播影响轻微</td></tr>';
    h += '</table>';
    h += '<div style="border-top:1px solid #e0e0e0;margin-top:6px"></div>';
    h += '<p style="font-weight:600;color:#1a237e;margin-top:6px;margin-bottom:4px">【频段状况图标】</p>';
    h += '<table style="width:100%;border-collapse:collapse;line-height:1.6">';
    h += '<tr><td style="padding:1px 6px;color:#2e7d32;font-weight:600">● Good</td><td style="padding:1px 6px">传播良好</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#f9a825;font-weight:600">◐ Fair</td><td style="padding:1px 6px">传播一般</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#c62828;font-weight:600">○ Poor</td><td style="padding:1px 6px">传播较差</td></tr>';
    h += '<tr><td style="padding:1px 6px;color:#999;font-weight:600">✕ Not Open</td><td style="padding:1px 6px">频段关闭</td></tr>';
    h += '</table>';
    h += '<p style="font-size:11px;color:#888;margin-top:8px">数据来源: <a href="https://hamqsl.com/solar.html" target="_blank">hamqsl.com (N0NBH)</a></p>';
    // 数据差异说明
    h += '<div style="margin-top:8px;padding:8px 10px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;font-size:11px;line-height:1.7;color:#5d4037">';
    h += '<b>💡 数据差异说明</b><br>';
    h += '本工具同时使用 <b>hamqsl.com</b> 图表和 <b>NOAA SWPC</b> API 两种数据源，部分参数数值可能略有不同，属正常现象：<br>';
    h += '• <b>SFI</b>：NOAA 提供观测值 (Observed)，hamqsl 使用调整值 (Adjusted，归一化到1AU)，差异可达 ±7%<br>';
    h += '• <b>Sn</b>：NOAA 基于 Wolf 公式推算，hamqsl 使用 SIDC 国际标准值，差异约 10-20%<br>';
    h += '• <b>Kp/A</b>：观测站与采样时间不同可导致 1-2 个单位差异<br>';
    h += '• <b>更新频率</b>：NOAA API 近实时，hamqsl 图表每 1-3 小时更新，同一时刻可能显示不同时间点数据<br>';
    h += '对通联判断的影响可忽略，建议以 NOAA SWPC 为权威参考。';
    h += '</div>';
    h += '</div>';
    document.getElementById('propResult').innerHTML =
        '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">' + imgHtml + h + '</div>';
    document.getElementById('propStatus').textContent = '已更新';
}
// RST 信号报告
function rstQuery() {
    const input = document.getElementById('rstInput').value.trim();
    if (!input) {
        document.getElementById('rstResult').textContent = '请输入RST值。';
        return;
    }
    const digits = input.replace(/[^0-9]/g, '');
    const lines = [];
    if (digits.length >= 2) {
        const r = parseInt(digits[0]), s = parseInt(digits[1]);
        lines.push('R (' + r + '): ' + (R_READABILITY[r] || '未知'));
        lines.push('S (' + s + '): ' + (S_STRENGTH[s] || '未知'));
        if (digits.length >= 3) {
            const t = parseInt(digits[2]);
            lines.push('T (' + t + '): ' + (T_TONE[t] || '未知'));
        }
    }
    else {
        lines.push('请输入2位(RS)或3位(RST)数字。');
    }
    document.getElementById('rstResult').textContent = lines.join('\n');
}
/** 时钟动画帧ID */
let clockRafId = null;
/** 上次时钟更新时间戳 */
let clockLastUpdate = 0;
/** 时钟更新间隔（ms） */
const CLOCK_UPDATE_INTERVAL = 1000;
/**
 * requestAnimationFrame驱动的时钟更新循环
 * 仅在每秒更新一次，比setInterval更节能且与屏幕刷新同步
 * @param timestamp - RAF时间戳
 */
function clockLoop(timestamp) {
    if (timestamp - clockLastUpdate >= CLOCK_UPDATE_INTERVAL) {
        updateClocks();
        clockLastUpdate = timestamp;
    }
    clockRafId = requestAnimationFrame(clockLoop);
}
function init() {
    updateClocks();
    clockLastUpdate = performance.now();
    clockRafId = requestAnimationFrame(clockLoop);
    // 下拉选项事件委托（替代内联onclick）
    const dropdown = document.getElementById('tzDropdown');
    if (dropdown) {
        dropdown.addEventListener('mousedown', (e) => {
            const target = e.target;
            const opt = target.closest('.tz-option');
            if (opt) {
                selectClock(opt.dataset.name || '', opt.dataset.tz || '');
            }
        });
    }
}
function destroy() {
    if (clockRafId) {
        cancelAnimationFrame(clockRafId);
        clockRafId = null;
    }
}
export { updateClocks, filterClockOptions, hideClockOptions, selectClock, addCustomClock, removeClock, clearCustomClocks, propFetch, rstQuery, init, destroy };
//# sourceMappingURL=ham-utils.js.map