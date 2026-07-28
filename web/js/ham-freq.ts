/**
 * HAM Radio Toolbox - 频率/频段 Tab 模块 (ES Module)
 * @module ham-freq
 */
'use strict';

import type { Band, BandSub } from './types.js';
import { BANDS, CAT_CN, MODES_REF, freqToMHz, freqToBand, getSpectrumCat, wavelength, dipoleLength, quarterWaveLength } from './core.js';
import { EventBus } from './event-bus.js';

/**
 * 搜索模式切换
 */
function onSearchModeChange(): void {
  const mode = (document.getElementById('freqSearchMode') as HTMLSelectElement).value;
  (document.getElementById('freqInput2') as HTMLInputElement).style.display = mode === 'range' ? '' : 'none';
  (document.getElementById('freqSep') as HTMLElement).style.display = mode === 'range' ? '' : 'none';
}

/**
 * 频率查询
 */
function freqQuery(): void {
  const mode = (document.getElementById('freqSearchMode') as HTMLSelectElement).value;
  const unit = (document.getElementById('freqUnit') as HTMLSelectElement).value;
  const f1 = freqToMHz((document.getElementById('freqInput') as HTMLInputElement).value, unit);
  if (isNaN(f1)) { (document.getElementById('freqResult') as HTMLElement).textContent = '请输入有效频率值。'; return; }
  const lines: string[] = [];
  if (mode === 'freq') {
    const band = freqToBand(f1) as Band | null;
    const cat = getSpectrumCat(f1);
    const wl = wavelength(f1);
    lines.push('频率: ' + f1.toFixed(4) + ' MHz');
    lines.push('波长: ' + (wl*100).toFixed(2) + ' cm / ' + wl.toFixed(4) + ' m');
    lines.push('频段: ' + (cat ? (CAT_CN[cat]||cat) : '未知'));
    if (band) {
      lines.push('\n✅ 属于业余频段: ' + band.name);
      lines.push('  范围: ' + band.f_low + ' - ' + band.f_high + ' MHz');
      lines.push('  类型: ' + (CAT_CN[band.cat]||band.cat));
      lines.push('  执照: ' + band.license);
      if (band.subs && band.subs.length > 0) {
        const sub = band.subs[0];
        lines.push('  业余业务地位: ' + sub.svc + ' (' + sub.label + ' ' + sub.f_low + '-' + sub.f_high + 'MHz)');
      } else {
        lines.push('  业余业务地位: ' + band.svc);
      }
      if (band.note) lines.push('  备注: ' + band.note);
      lines.push('\n天线计算:');
      const dip = dipoleLength(f1);
      lines.push('  半波偶极: ' + (dip.halfWave*100).toFixed(1) + ' cm (每臂 ' + (dip.eachLeg*100).toFixed(1) + ' cm)');
      lines.push('  四分之一波长: ' + (quarterWaveLength(f1)*100).toFixed(1) + ' cm');
    } else {
      lines.push('\n❌ 不属于业余频段');
    }
  } else {
    const f2 = freqToMHz((document.getElementById('freqInput2') as HTMLInputElement).value, unit);
    if (isNaN(f2)) { (document.getElementById('freqResult') as HTMLElement).textContent = '请输入有效上限频率。'; return; }
    lines.push('搜索范围: ' + f1.toFixed(4) + ' - ' + f2.toFixed(4) + ' MHz\n');
    const found = BANDS.filter((b: Band) => b.f_low <= f2 && b.f_high >= f1);
    if (found.length === 0) {
      lines.push('该范围内无业余频段。');
    } else {
      found.forEach((b: Band) => {
        lines.push(b.name + ': ' + b.f_low + ' - ' + b.f_high + ' MHz (' + (CAT_CN[b.cat]||b.cat) + ') ' + b.svc + ' ' + b.license);
        if (b.subs) {
          b.subs.forEach((s: BandSub) => {
            lines.push('  ├ ' + s.label + ': ' + s.f_low + '-' + s.f_high + ' MHz (' + s.svc + ')');
          });
        }
      });
    }
  }
  (document.getElementById('freqResult') as HTMLElement).textContent = lines.join('\n');
  EventBus.emit('status', '频率查询完成');
}

/**
 * 清空频率查询表单
 */
function freqClear(): void {
  (document.getElementById('freqInput') as HTMLInputElement).value = '';
  (document.getElementById('freqInput2') as HTMLInputElement).value = '';
  (document.getElementById('freqResult') as HTMLElement).textContent = '输入频率或频率区间，查询所属业余频段信息。';
}

/**
 * 初始化频段表（支持子频段折叠）
 */
function initBandTable(): void {
  const tbody = document.querySelector('#bandTable tbody') as HTMLTableSectionElement | null;
  if (!tbody) return;
  let html = '';
  BANDS.forEach((b: Band) => {
    if (b.subs) {
      html += '<tr class="band-parent" data-band="' + b.name + '">'
        + '<td>' + b.name + ' <span class="toggle-icon">▶</span></td>'
        + '<td>' + (CAT_CN[b.cat]||b.cat) + '</td>'
        + '<td>' + b.f_low + '</td>'
        + '<td>' + b.f_high + '</td>'
        + '<td>' + b.svc + '</td>'
        + '</tr>';
      b.subs.forEach((s: BandSub, i: number) => {
        const prefix = i < b.subs!.length - 1 ? '├' : '└';
        html += '<tr class="band-sub" data-parent="' + b.name + '" style="display:none">'
          + '<td>' + prefix + ' ' + s.label + '</td>'
          + '<td></td>'
          + '<td>' + s.f_low + '</td>'
          + '<td>' + s.f_high + '</td>'
          + '<td>' + s.svc + '</td>'
          + '</tr>';
      });
    } else {
      html += '<tr>'
        + '<td>' + b.name + '</td>'
        + '<td>' + (CAT_CN[b.cat]||b.cat) + '</td>'
        + '<td>' + b.f_low + '</td>'
        + '<td>' + b.f_high + '</td>'
        + '<td>' + b.svc + '</td>'
        + '</tr>';
    }
  });
  tbody.innerHTML = html;
  tbody.addEventListener('click', function(e: MouseEvent) {
    const row = (e.target as HTMLElement).closest('tr.band-parent') as HTMLTableRowElement | null;
    if (!row) return;
    const bandName = row.dataset.band!;
    const subs = tbody.querySelectorAll<HTMLElement>('tr[data-parent="' + bandName + '"]');
    const icon = row.querySelector('.toggle-icon') as HTMLElement | null;
    if (!icon) return;
    const expanded = icon.textContent === '▼';
    subs.forEach((sub: HTMLElement) => { sub.style.display = expanded ? 'none' : ''; });
    icon.textContent = expanded ? '▶' : '▼';
  });
}

/**
 * 初始化通信模式参考
 */
function initModesRef(): void {
  const div = document.getElementById('modesRef') as HTMLElement | null;
  if (!div) return;
  div.innerHTML = MODES_REF.map(cat =>
    '<div class="mode-ref"><h4>' + cat.cat + '</h4>' + cat.modes.map(m =>
      '<div class="mode-item"><span class="abbr">' + m.a + '</span><span class="name">' + m.n + '</span><span class="desc">' + m.d + '</span></div>'
    ).join('') + '</div>'
  ).join('');
}

/**
 * 模块初始化
 */
function init(): void {
  initBandTable();
  initModesRef();
}

export { onSearchModeChange, freqQuery, freqClear, init };