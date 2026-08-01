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
    const _clockData = JSON.parse(localStorage.getItem(CONFIG.CLOCK_KEY) || '[]');
    customClocks = Array.isArray(_clockData) ? _clockData : [];
}
catch (_e) { /* ignore */ }
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
    // 更新时间和日期文本
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
    catch (_e) { /* ignore */ }
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
export { updateClocks, filterClockOptions, hideClockOptions, addCustomClock, clearCustomClocks, rstQuery, init, destroy };