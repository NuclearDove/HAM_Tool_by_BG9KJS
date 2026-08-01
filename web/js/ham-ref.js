/**
 * HAM Radio Toolbox - 参考数据 Tab 模块 (ES Module)
 * 包含Q简语、英文缩略语、数字缩略语查询
 * @module ham-ref
 */
'use strict';
import { Q_CODES, ENG_ABBREV, NUM_ABBREV, renderTable } from './core.js';
function initRefTables() {
    renderTable('qcodeTable', Q_CODES, (q) => '<tr><td>' + q[0] + '</td><td>' + q[1] + '</td><td>' + q[2] + '</td></tr>');
    renderTable('engabbrTable', ENG_ABBREV, (a) => '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td>' + a[2] + '</td></tr>');
    renderTable('numabbrTable', NUM_ABBREV, (a) => '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td>' + a[2] + '</td></tr>');
}
/**
 * 缩略语查询
 * @param type - 查询类型: 'qcode'|'engabbr'|'numabbr'
 */
function abbrevLookup(type) {
    let search;
    let data;
    let resultId;
    if (type === 'qcode') {
        search = document.getElementById('qcodeSearch').value.trim().toUpperCase();
        data = Q_CODES;
        resultId = 'qcodeResult';
    }
    else if (type === 'engabbr') {
        search = document.getElementById('engabbrSearch').value.trim().toUpperCase();
        data = ENG_ABBREV;
        resultId = 'engabbrResult';
    }
    else {
        search = document.getElementById('numabbrSearch').value.trim();
        data = NUM_ABBREV;
        resultId = 'numabbrResult';
    }
    if (!search) {
        document.getElementById(resultId).textContent = '请输入查询内容。';
        return;
    }
    const found = data.filter((d) => d[0].toUpperCase().includes(search));
    if (found.length === 0) {
        document.getElementById(resultId).textContent = '未找到匹配项。';
    }
    else {
        document.getElementById(resultId).textContent = found.map((d) => d[0] + ': ' + d[1] + '\n' + (d[2] ? '  (' + d[2] + ')' : '')).join('\n\n');
    }
}
function init() { initRefTables(); }
export { abbrevLookup, init };