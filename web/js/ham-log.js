/**
 * HAM Radio Toolbox - 通联日志 Tab 模块 (ES Module)
 * 包含日志CRUD、导入导出(ADI/Cabrillo/CSV)、备份恢复
 * @module ham-log
 */
'use strict';
import { MODES, CONFIG, freqToBand, escHtml } from './core.js';
import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';
import { $ } from './dom-cache.js';
/** ADI导入允许的字段白名单（ADIF 3.1扩展 + LoTW/eQSL/QSL） */
const ADI_FIELDS = [
    // 核心字段
    'CALL', 'QSO_DATE', 'TIME_ON', 'FREQ', 'MODE', 'RST_SENT', 'RST_RCVD',
    'NAME', 'QTH', 'NOTES', 'BAND',
    // 地理/区域
    'DXCC', 'CQZ', 'ITUZ', 'STATE', 'CNTY', 'GRID', 'MY_GRIDSQUARE',
    'COUNTRY', 'CONT', 'ADDRESS', 'POSTAL_CODE',
    // 电台/操作员
    'OPERATOR', 'STATION_CALLSIGN', 'MY_QTH', 'MY_RIG', 'MY_ANTENNA',
    'MY_CITY', 'MY_STATE', 'MY_COUNTRY', 'MY_CQZ', 'MY_ITUZ',
    // QSL确认 - 传统
    'QSL_RCVD', 'QSL_SENT', 'QSL_VIA', 'QSL_MSG', 'QSL_RCVD_VIA', 'QSL_SENT_VIA',
    // QSL确认 - LoTW
    'LOTW_QSL_RCVD', 'LOTW_QSL_SENT', 'LOTW_QSLRDATE', 'LOTW_QSLSDATE',
    // QSL确认 - eQSL
    'EQSL_QSL_RCVD', 'EQSL_QSL_SENT', 'EQSL_QSLRDATE', 'EQSL_QSLSDATE',
    // QSL确认 - ClubLog
    'CLUBLOG_QSO_UPLOAD_STATUS', 'CLUBLOG_QSO_UPLOAD_DATE',
    // 传播/卫星
    'PROP_MODE', 'SAT_NAME', 'SAT_MODE', 'FREQ_RX', 'TX_PWR',
    'ANT_AZ', 'ANT_EL', 'ANT_PATH',
    // 竞赛
    'CONTEST_ID', 'SRX', 'STX', 'SRX_STRING', 'STX_STRING',
    'CONTEST_NR', 'CONTEST_NAME',
    // 其他
    'COMMENT', 'NOTES', 'DISTANCE', 'GRIDSQUARE', 'OWNER_CALLSIGN',
    'PFX', 'CREDIT_GRANTED', 'CREDIT_SUBMITTED',
    // QRZ/HamQTH
    'QRZCOM_QSO_UPLOAD_STATUS', 'QRZCOM_QSO_UPLOAD_DATE'
];
let editingId = null;
/** 分页状态 */
const PAGE_SIZE = 50;
/** 日志条目上限（防止localStorage溢出） */
const MAX_QSO_COUNT = 5000;
function loadQsos() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG.LOG_KEY)) || [];
    }
    catch (_e) {
        return [];
    }
}
function saveQsos(qsos) {
    // 超过上限时截断最旧的记录
    if (qsos.length > MAX_QSO_COUNT) {
        qsos = qsos.slice(0, MAX_QSO_COUNT);
        EventBus.emit('status', '日志已达上限 ' + MAX_QSO_COUNT + ' 条，最旧记录已自动清理');
    }
    try {
        localStorage.setItem(CONFIG.LOG_KEY, JSON.stringify(qsos));
    }
    catch (e) {
        // localStorage满时尝试清理最旧的一半记录
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            qsos = qsos.slice(0, Math.floor(qsos.length / 2));
            try {
                localStorage.setItem(CONFIG.LOG_KEY, JSON.stringify(qsos));
                EventBus.emit('status', '存储空间不足，已自动清理旧记录');
            }
            catch (_e2) {
                EventBus.emit('status', '存储空间严重不足，请导出备份后清理日志');
            }
        }
    }
}
function logModeRstPreset() {
    const mode = $('logMode').value;
    const isCW = mode === 'CW';
    $('logRstS').value = isCW ? '599' : '59';
    $('logRstR').value = isCW ? '599' : '59';
}
function logAdd() {
    const date = $('logDate').value;
    const time = $('logTime').value.trim();
    const call = $('logCall').value.trim().toUpperCase();
    const freq = $('logFreq').value.trim();
    const mode = $('logMode').value;
    if (!date || !time || !call || !freq) {
        showToast('请填写日期、时间、呼号和频率（必填项）。', 'warning');
        return;
    }
    const qso = {
        id: editingId || (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
        date, time, call, freq: parseFloat(freq) || freq, mode,
        rst_s: $('logRstS').value.trim(),
        rst_r: $('logRstR').value.trim(),
        name: $('logName').value.trim(),
        qth: $('logQth').value.trim(),
        note: $('logNote').value.trim()
    };
    // 自动派生 ADIF 字段
    const bandObj = freqToBand(Number(qso.freq));
    if (bandObj)
        qso.band = bandObj.name + 'm';
    // 从QTH提取网格坐标
    const qthVal = $('logQth').value.trim();
    if (qthVal && /^[A-Za-z]{2}\d{2}[A-Za-z]{0,2}$/.test(qthVal)) {
        qso.grid = qthVal.toUpperCase();
    }
    // LoTW/eQSL/QSL状态字段
    const qslSent = $('logQslSent')?.value;
    if (qslSent)
        qso.qsl_sent = qslSent;
    const qslRcvd = $('logQslRcvd')?.value;
    if (qslRcvd)
        qso.qsl_rcvd = qslRcvd;
    const lotwSent = $('logLotwSent')?.value;
    if (lotwSent)
        qso.lotw_qsl_sent = lotwSent;
    const lotwRcvd = $('logLotwRcvd')?.value;
    if (lotwRcvd)
        qso.lotw_qsl_rcvd = lotwRcvd;
    const eqslSent = $('logEqslSent')?.value;
    if (eqslSent)
        qso.eqsl_qsl_sent = eqslSent;
    const eqslRcvd = $('logEqslRcvd')?.value;
    if (eqslRcvd)
        qso.eqsl_qsl_rcvd = eqslRcvd;
    // 扩展字段
    const txPwr = $('logTxPwr')?.value?.trim();
    if (txPwr)
        qso.tx_pwr = txPwr;
    const propMode = $('logPropMode')?.value;
    if (propMode)
        qso.prop_mode = propMode;
    const satName = $('logSatName')?.value?.trim();
    if (satName)
        qso.sat_name = satName;
    const satMode = $('logSatMode')?.value?.trim();
    if (satMode)
        qso.sat_mode = satMode;
    const qsos = loadQsos();
    if (editingId) {
        const idx = qsos.findIndex(q => q.id === editingId);
        if (idx >= 0)
            qsos[idx] = qso;
        editingId = null;
        _updateAddBtn();
        EventBus.emit('status', '通联记录已更新: ' + call);
    }
    else {
        qsos.unshift(qso);
        EventBus.emit('status', '通联记录已添加: ' + call);
    }
    saveQsos(qsos);
    logRefreshTable();
    logClearForm();
    EventBus.emit('log-updated');
}
function logEdit(id) {
    const qsos = loadQsos();
    const qso = qsos.find(q => q.id === id);
    if (!qso)
        return;
    editingId = id;
    $('logDate').value = qso.date;
    $('logTime').value = qso.time;
    $('logCall').value = qso.call;
    $('logFreq').value = String(qso.freq);
    $('logMode').value = qso.mode;
    $('logRstS').value = qso.rst_s || '';
    $('logRstR').value = qso.rst_r || '';
    $('logName').value = qso.name || '';
    $('logQth').value = qso.qth || '';
    $('logNote').value = qso.note || '';
    // 恢复扩展字段
    const setVal = (id, val) => { const el = $(id); if (el)
        el.value = val || ''; };
    setVal('logQslSent', qso.qsl_sent);
    setVal('logQslRcvd', qso.qsl_rcvd);
    setVal('logLotwSent', qso.lotw_qsl_sent);
    setVal('logLotwRcvd', qso.lotw_qsl_rcvd);
    setVal('logEqslSent', qso.eqsl_qsl_sent);
    setVal('logEqslRcvd', qso.eqsl_qsl_rcvd);
    setVal('logTxPwr', qso.tx_pwr);
    setVal('logPropMode', qso.prop_mode);
    setVal('logSatName', qso.sat_name);
    setVal('logSatMode', qso.sat_mode);
    _updateAddBtn();
    $('logDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function logCancelEdit() {
    editingId = null;
    logClearForm();
    _updateAddBtn();
}
function _updateAddBtn() {
    const btn = $('logAddBtn');
    const cancelBtn = $('logCancelEditBtn');
    if (!btn)
        return;
    if (editingId) {
        btn.textContent = '更新记录';
        btn.className = 'btn btn-warning';
        if (cancelBtn)
            cancelBtn.style.display = 'inline-block';
    }
    else {
        btn.textContent = '添加记录';
        btn.className = 'btn btn-success';
        if (cancelBtn)
            cancelBtn.style.display = 'none';
    }
}
function logDelete(id) {
    if (!confirm('确定删除此记录？'))
        return;
    const qsos = loadQsos().filter(q => q.id !== id);
    saveQsos(qsos);
    logRefreshTable();
    EventBus.emit('status', '记录已删除');
    EventBus.emit('log-updated');
}
function logClearForm() {
    ['logDate', 'logTime', 'logCall', 'logFreq', 'logRstS', 'logRstR', 'logName', 'logQth', 'logNote'].forEach(id => {
        ($(id)).value = '';
    });
    const now = new Date();
    $('logDate').value = now.toISOString().split('T')[0];
    $('logTime').value = now.getUTCHours().toString().padStart(2, '0') + now.getUTCMinutes().toString().padStart(2, '0');
}
function logRefreshTable() {
    const search = ($('logSearch').value || '').toLowerCase();
    let qsos = loadQsos();
    if (search)
        qsos = qsos.filter(q => (q.call + q.mode + q.date + q.name + q.qth + q.note).toLowerCase().includes(search));
    const totalCount = qsos.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (currentPage > totalPages)
        currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageQsos = qsos.slice(start, start + PAGE_SIZE);
    $('logCount').textContent = '(' + totalCount + ' 条' + (totalCount > PAGE_SIZE ? '，第' + currentPage + '/' + totalPages + '页' : '') + ')';
    const tbody = document.querySelector('#logTable tbody');
    if (!tbody)
        return;
    tbody.innerHTML = pageQsos.map(q => {
        const isEditing = editingId === q.id;
        const rowStyle = isEditing ? ' style="background:#fff8e1"' : '';
        return '<tr' + rowStyle + '>' +
            '<td>' + escHtml(q.date) + '</td><td>' + escHtml(q.time) + '</td><td style="font-weight:600">' + escHtml(q.call) + '</td>' +
            '<td>' + escHtml(String(q.freq)) + '</td><td>' + escHtml(q.mode) + '</td><td>' + escHtml(q.rst_s || '') + '</td><td>' + escHtml(q.rst_r || '') + '</td>' +
            '<td>' + escHtml(q.name || '') + '</td><td>' + escHtml(q.qth || '') + '</td><td>' + escHtml(q.note || '') + '</td>' +
            '<td style="white-space:nowrap">' +
            '<button class="btn btn-primary" style="padding:2px 8px;font-size:11px;margin-right:4px" data-action="logEdit" data-id="' + escHtml(q.id) + '">编辑</button>' +
            '<button class="btn btn-danger" style="padding:2px 8px;font-size:11px" data-action="logDelete" data-id="' + escHtml(q.id) + '">删除</button>' +
            '</td></tr>';
    }).join('');
    // 分页控件
    _renderPagination(totalCount, totalPages);
}
/** 当前页码 */
let currentPage = 1;
/**
 * 渲染分页控件
 */
function _renderPagination(totalCount, totalPages) {
    let pager = $('logPager');
    if (!pager) {
        // 创建分页容器
        const tableWrap = document.querySelector('.log-table-wrap');
        if (tableWrap) {
            pager = document.createElement('div');
            pager.id = 'logPager';
            pager.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:6px;padding:8px;font-size:12px;';
            tableWrap.parentNode.insertBefore(pager, tableWrap.nextSibling);
        }
        else {
            return;
        }
    }
    if (totalCount <= PAGE_SIZE) {
        pager.innerHTML = '';
        return;
    }
    let html = '<button class="btn btn-secondary" style="padding:2px 10px;font-size:11px" data-action="logGoPage" data-page="1"' + (currentPage === 1 ? ' disabled' : '') + '>首页</button>';
    html += '<button class="btn btn-secondary" style="padding:2px 10px;font-size:11px" data-action="logGoPage" data-page="' + (currentPage - 1) + '"' + (currentPage === 1 ? ' disabled' : '') + '>上一页</button>';
    // 页码按钮（最多显示5个）
    let startP = Math.max(1, currentPage - 2);
    let endP = Math.min(totalPages, startP + 4);
    if (endP - startP < 4)
        startP = Math.max(1, endP - 4);
    for (let p = startP; p <= endP; p++) {
        const cls = p === currentPage ? 'btn btn-primary' : 'btn btn-secondary';
        html += '<button class="' + cls + '" style="padding:2px 8px;font-size:11px" data-action="logGoPage" data-page="' + p + '">' + p + '</button>';
    }
    html += '<button class="btn btn-secondary" style="padding:2px 10px;font-size:11px" data-action="logGoPage" data-page="' + (currentPage + 1) + '"' + (currentPage === totalPages ? ' disabled' : '') + '>下一页</button>';
    html += '<button class="btn btn-secondary" style="padding:2px 10px;font-size:11px" data-action="logGoPage" data-page="' + totalPages + '"' + (currentPage === totalPages ? ' disabled' : '') + '>末页</button>';
    pager.innerHTML = html;
}
/** 搜索时重置页码 */
function resetPage() { currentPage = 1; }
/**
 * 跳转到指定页
 */
function logGoPage(page) {
    currentPage = page;
    logRefreshTable();
    document.querySelector('.log-table-wrap')?.scrollTo({ top: 0, behavior: 'smooth' });
}
function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}
function logExportAdi() {
    const qsos = loadQsos();
    if (!qsos.length) {
        showToast('无记录可导出。', 'warning');
        return;
    }
    let adi = '<ADIF_VER:5>3.1.0<EOH>\n';
    qsos.forEach(q => {
        adi += '<CALL:' + q.call.length + '>' + q.call +
            '<QSO_DATE:' + q.date.replace(/-/g, '').length + '>' + q.date.replace(/-/g, '') +
            '<TIME_ON:' + q.time.length + '>' + q.time +
            '<FREQ:' + String(q.freq).length + '>' + q.freq +
            '<MODE:' + q.mode.length + '>' + q.mode;
        if (q.rst_s)
            adi += '<RST_SENT:' + q.rst_s.length + '>' + q.rst_s;
        if (q.rst_r)
            adi += '<RST_RCVD:' + q.rst_r.length + '>' + q.rst_r;
        if (q.band)
            adi += '<BAND:' + q.band.length + '>' + q.band;
        if (q.grid)
            adi += '<GRID:' + q.grid.length + '>' + q.grid;
        if (q.name)
            adi += '<NAME:' + q.name.length + '>' + q.name;
        if (q.qth)
            adi += '<QTH:' + q.qth.length + '>' + q.qth;
        if (q.note)
            adi += '<NOTES:' + q.note.length + '>' + q.note;
        adi += '<EOR>\n';
    });
    downloadFile(qsos[0].call + '_' + new Date().toISOString().split('T')[0] + '.adi', adi, 'text/plain');
    EventBus.emit('status', 'ADI导出完成');
}
function logExportCabrillo() {
    const qsos = loadQsos();
    if (!qsos.length) {
        showToast('无记录可导出。', 'warning');
        return;
    }
    let cab = 'START-OF-LOG: 3.0\nCREATED-BY: HAM Radio Toolbox Web\n';
    cab += 'CONTEST: \nCALLSIGN: \n';
    qsos.forEach(q => {
        cab += 'QSO: ' + q.freq.toString().padStart(8) + ' ' + q.mode.padEnd(6) + ' ' +
            q.date.replace(/-/g, '') + ' ' + q.time.padStart(4, '0') + ' ' +
            q.call.padEnd(13) + ' ' + (q.rst_s || '59') + ' ' +
            q.call.padEnd(13) + ' ' + (q.rst_r || '59') + '\n';
    });
    cab += 'END-OF-LOG:\n';
    downloadFile('cabrillo_' + new Date().toISOString().split('T')[0] + '.log', cab, 'text/plain');
    EventBus.emit('status', 'Cabrillo导出完成');
}
function logExportCsv() {
    const qsos = loadQsos();
    if (!qsos.length) {
        showToast('无记录可导出。', 'warning');
        return;
    }
    let csv = '\uFEFF日期,时间,呼号,频率,模式,RST发送,RST接收,姓名,QTH,备注\n';
    qsos.forEach(q => {
        csv += [q.date, q.time, q.call, q.freq, q.mode, q.rst_s, q.rst_r, q.name, q.qth, q.note].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',') + '\n';
    });
    downloadFile('qso_' + new Date().toISOString().split('T')[0] + '.csv', csv, 'text/csv');
    EventBus.emit('status', 'CSV导出完成');
}
function logImportAdi() { $('adiFileInput').click(); }
/**
 * ADI文件导入（含白名单过滤防止原型污染 + 字段校验）
 */
function logImportAdiFile(e) {
    const target = e.target;
    const file = target.files[0];
    if (!file)
        return;
    // 文件大小限制：5MB
    if (file.size > 5 * 1024 * 1024) {
        showToast('文件过大（超过5MB），请选择较小的ADI文件。', 'warning');
        target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
        const text = ev.target.result;
        const qsos = loadQsos();
        let count = 0;
        let skipped = 0;
        const lines = text.split(/<eor>/i);
        for (let li = 0; li < lines.length; li++) {
            const current = {};
            const re = /<(\w+):(\d+)(?::\w)?>([^<]*)/gi;
            let match;
            while ((match = re.exec(lines[li])) !== null) {
                const fieldName = match[1].toUpperCase();
                // 白名单过滤：仅允许已知ADI字段
                if (ADI_FIELDS.includes(fieldName)) {
                    current[fieldName] = match[3].trim();
                }
            }
            if (current.CALL) {
                // 字段校验
                const callVal = current.CALL.toUpperCase();
                // 呼号格式基本校验
                if (!/^[A-Z0-9]{1,2}[0-9][A-Z0-9]{1,4}(\/[A-Z0-9]{1,3})?$/.test(callVal)) {
                    skipped++;
                    continue;
                }
                // 日期格式校验
                const dateVal = (current.QSO_DATE || '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                if (current.QSO_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                    skipped++;
                    continue;
                }
                // 频率范围校验
                const freqVal = parseFloat(current.FREQ);
                if (current.FREQ && (isNaN(freqVal) || freqVal <= 0 || freqVal > 100000)) {
                    skipped++;
                    continue;
                }
                qsos.unshift({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4) + count,
                    date: dateVal,
                    time: current.TIME_ON || '',
                    call: callVal,
                    freq: current.FREQ || '',
                    mode: current.MODE || '',
                    rst_s: current.RST_SENT || '',
                    rst_r: current.RST_RCVD || '',
                    name: current.NAME || '',
                    qth: current.QTH || '',
                    note: current.NOTES || '',
                    band: current.BAND || '',
                    grid: current.GRID || ''
                });
                count++;
            }
        }
        saveQsos(qsos);
        logRefreshTable();
        let msg = 'ADI导入完成，新增 ' + count + ' 条记录';
        if (skipped > 0)
            msg += '，跳过 ' + skipped + ' 条无效记录';
        EventBus.emit('status', msg);
        EventBus.emit('log-updated');
        target.value = '';
    };
    reader.readAsText(file);
}
function logBackup() {
    const qsos = loadQsos();
    if (!qsos.length) {
        showToast('无记录可备份。', 'warning');
        return;
    }
    downloadFile('qso_backup_' + new Date().toISOString().split('T')[0] + '.json', JSON.stringify(qsos, null, 2), 'application/json');
    EventBus.emit('status', '备份完成');
}
function logRestore() { $('restoreFileInput').click(); }
function logRestoreFile(e) {
    const target = e.target;
    const file = target.files[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!Array.isArray(data))
                throw new Error('格式错误');
            saveQsos(data);
            logRefreshTable();
            EventBus.emit('status', '恢复完成，共 ' + data.length + ' 条记录');
            EventBus.emit('log-updated');
        }
        catch (err) {
            showToast('恢复失败: ' + err.message, 'error');
        }
        target.value = '';
    };
    reader.readAsText(file);
}
function init() {
    const modeSelect = $('logMode');
    if (modeSelect) {
        MODES.forEach((m) => {
            const o = document.createElement('option');
            o.value = m;
            o.textContent = m;
            modeSelect.appendChild(o);
        });
    }
    logClearForm();
    logRefreshTable();
}
/**
 * 通联统计：模式分布、频段分布、月度趋势
 */
function logStats() {
    const el = $('logStatsResult');
    if (!el)
        return;
    // 切换显示/隐藏
    if (el.style.display !== 'none' && el.innerHTML) {
        el.style.display = 'none';
        return;
    }
    const qsos = loadQsos();
    if (!qsos.length) {
        el.style.display = 'block';
        el.innerHTML = '<p style="color:#888;font-size:13px">暂无通联记录，无法统计。</p>';
        return;
    }
    // 计算各项统计
    const modeStats = _calcModeStats(qsos);
    const bandStats = _calcBandStats(qsos);
    const monthStats = _calcMonthStats(qsos);
    const uniqueCalls = new Set(qsos.map(q => q.call)).size;
    // QSL确认统计
    const qslStats = _calcQslStats(qsos);
    // 渲染
    el.style.display = 'block';
    el.innerHTML = _renderStatsHtml(qsos.length, uniqueCalls, modeStats, bandStats, monthStats, qslStats);
}
/**
 * 计算模式分布统计
 * @param qsos - 通联记录数组
 * @returns 排序后的[mode, count]数组
 */
function _calcModeStats(qsos) {
    const count = {};
    qsos.forEach(q => { const m = q.mode || '未知'; count[m] = (count[m] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
}
/**
 * 计算频段分布统计
 * @param qsos - 通联记录数组
 * @returns 排序后的[band, count]数组
 */
function _calcBandStats(qsos) {
    const count = {};
    qsos.forEach(q => {
        const b = q.band || (q.freq ? _freqToBandLabel(q.freq) : '未知');
        count[b] = (count[b] || 0) + 1;
    });
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
}
/**
 * 计算月度趋势统计（近12个月）
 * @param qsos - 通联记录数组
 * @returns 月份→通联数映射
 */
function _calcMonthStats(qsos) {
    const monthCount = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthCount[key] = 0;
    }
    qsos.forEach(q => {
        if (q.date && monthCount.hasOwnProperty(q.date.substring(0, 7))) {
            monthCount[q.date.substring(0, 7)]++;
        }
    });
    return monthCount;
}
/**
 * 计算QSL确认统计（LoTW/eQSL/纸质QSL）
 * @param qsos - 通联记录数组
 */
function _calcQslStats(qsos) {
    const stats = { qslSent: 0, qslRcvd: 0, lotwSent: 0, lotwRcvd: 0, eqslSent: 0, eqslRcvd: 0 };
    qsos.forEach(q => {
        if (q.qsl_sent === 'Y' || q.qsl_sent === '1')
            stats.qslSent++;
        if (q.qsl_rcvd === 'Y' || q.qsl_rcvd === '1')
            stats.qslRcvd++;
        if (q.lotw_qsl_sent === 'Y' || q.lotw_qsl_sent === '1')
            stats.lotwSent++;
        if (q.lotw_qsl_rcvd === 'Y' || q.lotw_qsl_rcvd === '1')
            stats.lotwRcvd++;
        if (q.eqsl_qsl_sent === 'Y' || q.eqsl_qsl_sent === '1')
            stats.eqslSent++;
        if (q.eqsl_qsl_rcvd === 'Y' || q.eqsl_qsl_rcvd === '1')
            stats.eqslRcvd++;
    });
    return stats;
}
/**
 * 渲染统计HTML
 * @param total - 总通联数
 * @param uniqueCalls - 不同呼号数
 * @param modeStats - 模式统计
 * @param bandStats - 频段统计
 * @param monthStats - 月度统计
 * @param qslStats - QSL确认统计
 * @returns HTML字符串
 */
function _renderStatsHtml(total, uniqueCalls, modeStats, bandStats, monthStats, qslStats) {
    let html = '<div style="display:flex;flex-wrap:wrap;gap:12px">';
    // 总览
    html += '<div style="flex:1;min-width:200px"><h4 style="color:#1a237e;font-size:13px;margin-bottom:6px">总览</h4>';
    html += '<table class="data-table"><tr><th>指标</th><th>值</th></tr>';
    html += '<tr><td>总通联数</td><td>' + total + '</td></tr>';
    html += '<tr><td>不同呼号</td><td>' + uniqueCalls + '</td></tr>';
    html += '<tr><td>模式种类</td><td>' + modeStats.length + '</td></tr>';
    html += '<tr><td>频段数</td><td>' + bandStats.length + '</td></tr>';
    html += '</table></div>';
    // 模式分布
    html += _renderStatsTable('模式分布', '模式', modeStats, total);
    // 频段分布
    html += _renderStatsTable('频段分布', '频段', bandStats, total);
    // 月度趋势
    html += '<div style="flex:1;min-width:200px"><h4 style="color:#1a237e;font-size:13px;margin-bottom:6px">月度趋势（近12月）</h4>';
    html += '<table class="data-table"><tr><th>月份</th><th>通联数</th></tr>';
    Object.entries(monthStats).forEach(([month, cnt]) => {
        const bar = '█'.repeat(Math.min(cnt, 30));
        html += '<tr><td>' + month + '</td><td>' + cnt + ' ' + bar + '</td></tr>';
    });
    html += '</table></div>';
    // QSL确认统计
    if (qslStats) {
        html += '<div style="flex:1;min-width:200px"><h4 style="color:#1a237e;font-size:13px;margin-bottom:6px">QSL确认统计</h4>';
        html += '<table class="data-table"><tr><th>类型</th><th>已发送</th><th>已接收</th><th>确认率</th></tr>';
        html += '<tr><td>纸质QSL</td><td>' + qslStats.qslSent + '</td><td>' + qslStats.qslRcvd + '</td><td>' + (qslStats.qslSent > 0 ? (qslStats.qslRcvd / qslStats.qslSent * 100).toFixed(1) + '%' : '-') + '</td></tr>';
        html += '<tr><td>LoTW</td><td>' + qslStats.lotwSent + '</td><td>' + qslStats.lotwRcvd + '</td><td>' + (qslStats.lotwSent > 0 ? (qslStats.lotwRcvd / qslStats.lotwSent * 100).toFixed(1) + '%' : '-') + '</td></tr>';
        html += '<tr><td>eQSL</td><td>' + qslStats.eqslSent + '</td><td>' + qslStats.eqslRcvd + '</td><td>' + (qslStats.eqslSent > 0 ? (qslStats.eqslRcvd / qslStats.eqslSent * 100).toFixed(1) + '%' : '-') + '</td></tr>';
        html += '</table></div>';
    }
    html += '</div>';
    return html;
}
/**
 * 渲染统计表格（模式/频段分布）
 * @param title - 表格标题
 * @param label - 列标签
 * @param data - 排序后的[name, count]数组
 * @param total - 总数（用于计算占比）
 * @returns HTML字符串
 */
function _renderStatsTable(title, label, data, total) {
    let html = '<div style="flex:1;min-width:200px"><h4 style="color:#1a237e;font-size:13px;margin-bottom:6px">' + title + '</h4>';
    html += '<table class="data-table"><tr><th>' + label + '</th><th>次数</th><th>占比</th></tr>';
    data.slice(0, 10).forEach(([name, cnt]) => {
        const pct = (cnt / total * 100).toFixed(1);
        html += '<tr><td>' + escHtml(name) + '</td><td>' + cnt + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</table></div>';
    return html;
}
/**
 * 频率值转频段标签（辅助函数）
 */
function _freqToBandLabel(freq) {
    const f = parseFloat(String(freq));
    if (isNaN(f))
        return '未知';
    if (f >= 0.1357 && f <= 0.1378)
        return '2200m';
    if (f >= 0.472 && f <= 0.479)
        return '630m';
    if (f >= 1.8 && f <= 2.0)
        return '160m';
    if (f >= 3.5 && f <= 3.9)
        return '80m';
    if (f >= 5.3515 && f <= 5.3665)
        return '60m';
    if (f >= 7.0 && f <= 7.2)
        return '40m';
    if (f >= 10.1 && f <= 10.15)
        return '30m';
    if (f >= 14.0 && f <= 14.35)
        return '20m';
    if (f >= 18.068 && f <= 18.168)
        return '17m';
    if (f >= 21.0 && f <= 21.45)
        return '15m';
    if (f >= 24.89 && f <= 24.99)
        return '12m';
    if (f >= 28.0 && f <= 29.7)
        return '10m';
    if (f >= 50.0 && f <= 54.0)
        return '6m';
    if (f >= 144.0 && f <= 148.0)
        return '2m';
    if (f >= 430.0 && f <= 440.0)
        return '70cm';
    return f < 30 ? 'HF' : f < 300 ? 'VHF' : 'UHF+';
}
export { logModeRstPreset, logAdd, logClearForm, logRefreshTable, logEdit, logCancelEdit, logDelete, logExportAdi, logExportCabrillo, logExportCsv, logImportAdi, logImportAdiFile, logBackup, logRestore, logRestoreFile, loadQsos, init, logGoPage, logStats, resetPage };
//# sourceMappingURL=ham-log.js.map