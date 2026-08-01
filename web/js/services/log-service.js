/**
 * HAM Radio Toolbox - 日志业务逻辑服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/log-service
 */
/**
 * 计算模式统计
 * @param qsos - QSO记录数组
 * @returns 排序后的[mode, count]数组
 */
export function calcModeStats(qsos) {
    const map = {};
    qsos.forEach(q => { map[q.mode] = (map[q.mode] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
/**
 * 计算频段统计
 * @param qsos - QSO记录数组
 * @returns 排序后的[band, count]数组
 */
export function calcBandStats(qsos) {
    const map = {};
    qsos.forEach(q => { map[q.band || ''] = (map[q.band || ''] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
/**
 * 计算月份统计（近12个月）
 * @param qsos - QSO记录数组
 * @returns {month: count}对象
 */
export function calcMonthStats(qsos) {
    const now = new Date();
    const result = {};
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        result[key] = 0;
    }
    qsos.forEach(q => {
        if (!q.date)
            return;
        const m = q.date.substring(0, 7);
        if (m in result)
            result[m]++;
    });
    return result;
}
/**
 * 渲染单个统计表格HTML
 * @param title - 表格标题
 * @param label - 数据标签
 * @param data - 数据数组
 * @param total - 总数
 * @returns HTML字符串
 */
export function renderStatsTable(title, label, data, total) {
    let html = `<div class="stats-section"><h4>${title}</h4><table><tr><th>${label}</th><th>数量</th><th>占比</th></tr>`;
    data.forEach(([key, count]) => {
        const pct = total > 0 ? (count / total * 100).toFixed(1) : '0';
        html += `<tr><td>${key}</td><td>${count}</td><td>${pct}%</td></tr>`;
    });
    html += '</table></div>';
    return html;
}
/**
 * 渲染完整统计HTML
 * @param total - 总QSO数
 * @param uniqueCalls - 唯一呼号数
 * @param modeStats - 模式统计
 * @param bandStats - 频段统计
 * @param monthStats - 月份统计
 * @returns 完整HTML字符串
 */
export function renderStatsHtml(total, uniqueCalls, modeStats, bandStats, monthStats) {
    let html = `<div class="stats-summary"><p>总QSO数: <strong>${total}</strong> | 唯一呼号: <strong>${uniqueCalls}</strong></p></div>`;
    html += renderStatsTable('模式统计', '模式', modeStats, total);
    html += renderStatsTable('频段统计', '频段', bandStats, total);
    html += '<div class="stats-section"><h4>月度统计（近12个月）</h4><table><tr><th>月份</th><th>数量</th></tr>';
    Object.entries(monthStats).forEach(([month, count]) => {
        html += `<tr><td>${month}</td><td>${count}</td></tr>`;
    });
    html += '</table></div>';
    return html;
}
/**
 * 验证QSO记录数据完整性
 * @param qso - QSO记录对象
 * @returns 验证结果
 */
export function validateQso(qso) {
    const errors = [];
    if (!qso.call)
        errors.push('呼号不能为空');
    if (!qso.freq || Number(qso.freq) <= 0)
        errors.push('频率必须大于0');
    if (!qso.mode)
        errors.push('模式不能为空');
    if (!qso.date)
        errors.push('日期不能为空');
    if (!qso.time)
        errors.push('时间不能为空');
    return { valid: errors.length === 0, errors };
}
/**
 * 计算唯一呼号数
 * @param qsos - QSO记录数组
 * @returns 唯一呼号数
 */
export function countUniqueCalls(qsos) {
    return new Set(qsos.map(q => q.call)).size;
}