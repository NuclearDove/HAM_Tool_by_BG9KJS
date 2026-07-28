/**
 * HAM Radio Toolbox - 参考数据 Tab 模块 (ES Module)
 * 包含Q简语、英文缩略语、数字缩略语查询
 * @module ham-ref
 */
'use strict';

import type { QCodeEntry, AbbrevEntry } from './types.js';
import { Q_CODES, ENG_ABBREV, NUM_ABBREV, renderTable } from './core.js';

function initRefTables(): void {
  renderTable('qcodeTable', Q_CODES, (q: QCodeEntry) => '<tr><td>' + q[0] + '</td><td>' + q[1] + '</td><td>' + q[2] + '</td></tr>');
  renderTable('engabbrTable', ENG_ABBREV, (a: AbbrevEntry) => '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td>' + a[2] + '</td></tr>');
  renderTable('numabbrTable', NUM_ABBREV, (a: AbbrevEntry) => '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td>' + a[2] + '</td></tr>');
}

/**
 * 缩略语查询
 * @param type - 查询类型: 'qcode'|'engabbr'|'numabbr'
 */
function abbrevLookup(type: 'qcode' | 'engabbr' | 'numabbr'): void {
  let search: string;
  let data: QCodeEntry[] | AbbrevEntry[];
  let resultId: string;
  if (type === 'qcode') {
    search = (document.getElementById('qcodeSearch') as HTMLInputElement).value.trim().toUpperCase();
    data = Q_CODES; resultId = 'qcodeResult';
  } else if (type === 'engabbr') {
    search = (document.getElementById('engabbrSearch') as HTMLInputElement).value.trim().toUpperCase();
    data = ENG_ABBREV; resultId = 'engabbrResult';
  } else {
    search = (document.getElementById('numabbrSearch') as HTMLInputElement).value.trim();
    data = NUM_ABBREV; resultId = 'numabbrResult';
  }
  if (!search) { (document.getElementById(resultId) as HTMLElement).textContent = '请输入查询内容。'; return; }
  const found = data.filter((d: QCodeEntry | AbbrevEntry) => d[0].toUpperCase().includes(search));
  if (found.length === 0) {
    (document.getElementById(resultId) as HTMLElement).textContent = '未找到匹配项。';
  } else {
    (document.getElementById(resultId) as HTMLElement).textContent = found.map((d: QCodeEntry | AbbrevEntry) =>
      d[0] + ': ' + d[1] + '\n' + (d[2] ? '  (' + d[2] + ')' : '')
    ).join('\n\n');
  }
}

function init(): void { initRefTables(); }

export { abbrevLookup, init };