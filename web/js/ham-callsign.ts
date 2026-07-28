/**
 * HAM Radio Toolbox - 呼号查询模块
 * 集成HamQTH/QRZ API查询呼号信息
 * @module ham-callsign
 */
'use strict';

import { escHtml } from './core.js';
import { showToast } from './ham-toast.js';
import type { CallInfo, CallPrefix } from './types.js';

// ============================================================
// 常量
// ============================================================
const HAMQTH_API = 'https://www.hamqth.com/php/callsearch.php';

// 查询状态
let callLoading = false;

// ============================================================
// 查询逻辑
// ============================================================

/**
 * 查询呼号信息
 * 使用HamQTH公开API（无需API Key的基础查询）
 */
async function callLookup(): Promise<void> {
  const input = document.getElementById('callInput') as HTMLInputElement | null;
  const resultEl = document.getElementById('callResult') as HTMLElement | null;
  const statusEl = document.getElementById('callStatus') as HTMLElement | null;
  if (!input || !resultEl) return;

  const call = input.value.trim().toUpperCase();
  if (!call) {
    resultEl.innerHTML = '<span style="color:#c62828">请输入呼号</span>';
    return;
  }

  // 基本格式校验
  if (!/^[A-Z0-9]{1,2}[0-9][A-Z0-9]{1,4}(\/[A-Z0-9]{1,3})?$/.test(call)) {
    resultEl.innerHTML = '<span style="color:#c62828">呼号格式不正确，如: BD4TQR, W1AW, JA1AAA</span>';
    return;
  }

  if (callLoading) return;
  callLoading = true;
  if (statusEl) statusEl.textContent = '正在查询...';
  resultEl.innerHTML = '';

  try {
    // 尝试HamQTH API
    const data = await fetchHamQTH(call);
    if (data && (data as any)._error) {
      const errMsg = (data as any)._error === 'timeout' ? 'HamQTH查询超时，请稍后重试' : 'HamQTH查询失败，请检查网络连接';
      const localData = lookupLocalPrefix(call);
      if (localData) {
        renderLocalResult(call, localData, resultEl);
        if (statusEl) statusEl.textContent = 'API不可用，本地查询';
        showToast(errMsg + '，已回退到本地查询', 'warning');
      } else {
        resultEl.innerHTML = '<span style="color:#c62828">' + escHtml(errMsg) + '</span>';
        if (statusEl) statusEl.textContent = '查询失败';
        showToast(errMsg, 'error');
      }
    } else if (data) {
      renderCallResult(data, resultEl);
      if (statusEl) statusEl.textContent = '查询成功';
    } else {
      // HamQTH无结果，尝试本地呼号前缀数据库
      const localData = lookupLocalPrefix(call);
      if (localData) {
        renderLocalResult(call, localData, resultEl);
        if (statusEl) statusEl.textContent = '本地数据库查询';
      } else {
        resultEl.innerHTML = '<span style="color:#e65100">未找到呼号 ' + escHtml(call) + ' 的信息。可能是新呼号或非业余电台呼号。</span>';
        if (statusEl) statusEl.textContent = '未找到';
      }
    }
  } catch(err: any) {
    console.warn('[HAM] Call lookup failed:', err.message);
    // 回退到本地查询
    const localData = lookupLocalPrefix(call);
    if (localData) {
      renderLocalResult(call, localData, resultEl);
      if (statusEl) statusEl.textContent = 'API不可用，本地查询';
      showToast('查询失败，已回退到本地查询', 'warning');
    } else {
      resultEl.innerHTML = '<span style="color:#c62828">查询失败: ' + escHtml(err.message) + '</span>';
      if (statusEl) statusEl.textContent = '查询失败';
      showToast('呼号查询失败: ' + err.message, 'error');
    }
  } finally {
    callLoading = false;
  }
}

/**
 * 从HamQTH API查询
 */
async function fetchHamQTH(call: string): Promise<CallInfo | null> {
  try {
    const url = HAMQTH_API + '?callsign=' + encodeURIComponent(call) + '&format=json';
    const resp = await fetch(url, {
      cache: 'no-cache',
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) return null;
    const text = await resp.text();

    // HamQTH可能返回XML或JSON
    let data: any;
    try {
      data = JSON.parse(text);
    } catch(_e) {
      // 尝试解析XML
      data = parseHamQTHXml(text);
    }

    if (!data || data.error) return null;

    return {
      call: data.call || call,
      name: data.name || data.nick || '',
      address: data.addr1 || '',
      city: data.city || '',
      country: data.country || '',
      grid: data.grid || '',
      lat: data.lat || '',
      lon: data.lon || '',
      qsl: data.qsl || '',
      url: data.url || '',
      source: 'HamQTH'
    };
  } catch(_e: any) {
    const isTimeout = _e && (_e.name === 'TimeoutError' || _e.name === 'AbortError');
    return { _error: isTimeout ? 'timeout' : 'network' } as any;
  }
}

/**
 * 解析HamQTH XML响应
 */
function parseHamQTHXml(text: string): any {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const search = doc.querySelector('search');
    if (!search) return null;

    const get = (tag: string): string => {
      const el = search.querySelector(tag);
      return el ? (el.textContent || '') : '';
    };

    return {
      call: get('call'),
      name: get('nick'),
      addr1: get('adr_street'),
      city: get('adr_city'),
      country: get('adr_country'),
      grid: get('grid'),
      lat: get('latitude'),
      lon: get('longitude'),
      qsl: get('qsl'),
      url: get('url')
    };
  } catch(_e: any) {
    const isTimeout = _e && (_e.name === 'TimeoutError' || _e.name === 'AbortError');
    return { _error: isTimeout ? 'timeout' : 'network' } as any;
  }
}

/**
 * 本地呼号前缀数据库（常见国家/地区前缀）
 */
const CALL_PREFIXES: Record<string, CallPrefix> = {
  'B': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BA': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BD': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BG': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BI': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BY': { country: '中国', ituz: '33,42,44', cqz: '24' },
  'BV': { country: '中国台湾', ituz: '45', cqz: '24' },
  'VR': { country: '中国香港', ituz: '44', cqz: '24' },
  'XX': { country: '中国澳门', ituz: '44', cqz: '24' },
  'W': { country: '美国', ituz: '7,8', cqz: '3,4,5' },
  'K': { country: '美国', ituz: '7,8', cqz: '3,4,5' },
  'N': { country: '美国', ituz: '7,8', cqz: '3,4,5' },
  'AA': { country: '美国', ituz: '7,8', cqz: '3,4,5' },
  'JA': { country: '日本', ituz: '45', cqz: '25' },
  'JH': { country: '日本', ituz: '45', cqz: '25' },
  'JR': { country: '日本', ituz: '45', cqz: '25' },
  '7J': { country: '日本', ituz: '45', cqz: '25' },
  'G': { country: '英格兰', ituz: '27', cqz: '14' },
  'M': { country: '英格兰', ituz: '27', cqz: '14' },
  '2E': { country: '英格兰', ituz: '27', cqz: '14' },
  'GM': { country: '苏格兰', ituz: '27', cqz: '14' },
  'GI': { country: '北爱尔兰', ituz: '27', cqz: '14' },
  'GW': { country: '威尔士', ituz: '27', cqz: '14' },
  'F': { country: '法国', ituz: '27', cqz: '14' },
  'DL': { country: '德国', ituz: '28', cqz: '14' },
  'DA': { country: '德国', ituz: '28', cqz: '14' },
  'I': { country: '意大利', ituz: '28', cqz: '15' },
  'EA': { country: '西班牙', ituz: '37', cqz: '14' },
  'CT': { country: '葡萄牙', ituz: '37', cqz: '14' },
  'PY': { country: '巴西', ituz: '11,12,13', cqz: '11' },
  'LU': { country: '阿根廷', ituz: '13,14', cqz: '13' },
  'CE': { country: '智利', ituz: '14', cqz: '12' },
  'VK': { country: '澳大利亚', ituz: '55,58,59,60', cqz: '29,30,31,32' },
  'ZL': { country: '新西兰', ituz: '60,61', cqz: '32' },
  'HL': { country: '韩国', ituz: '44', cqz: '25' },
  '6K': { country: '韩国', ituz: '44', cqz: '25' },
  'DS': { country: '韩国', ituz: '44', cqz: '25' },
  'HS': { country: '泰国', ituz: '49', cqz: '26' },
  '9M': { country: '马来西亚', ituz: '54', cqz: '28' },
  '9V': { country: '新加坡', ituz: '54', cqz: '28' },
  'YB': { country: '印度尼西亚', ituz: '51,52,54', cqz: '28,51' },
  'VU': { country: '印度', ituz: '41', cqz: '22' },
  '4S': { country: '斯里兰卡', ituz: '41', cqz: '22' },
  'AP': { country: '巴基斯坦', ituz: '41', cqz: '21' },
  'SU': { country: '埃及', ituz: '34', cqz: '34' },
  'ZS': { country: '南非', ituz: '46,57,58', cqz: '38' },
  '5Z': { country: '肯尼亚', ituz: '47', cqz: '37' },
  'C5': { country: '冈比亚', ituz: '46', cqz: '35' },
  'UA': { country: '俄罗斯(欧洲)', ituz: '29', cqz: '16' },
  'RA': { country: '俄罗斯', ituz: '29,30,31,32', cqz: '16,17,18,19,23' },
  'R': { country: '俄罗斯', ituz: '29,30,31,32', cqz: '16,17,18,19,23' },
  'UY': { country: '俄罗斯', ituz: '29,30', cqz: '16,17' },
  'UN': { country: '哈萨克斯坦', ituz: '30,31', cqz: '17' },
  '4X': { country: '以色列', ituz: '39', cqz: '20' },
  'JY': { country: '约旦', ituz: '39', cqz: '20' },
  'OD': { country: '黎巴嫩', ituz: '39', cqz: '20' },
  'A7': { country: '卡塔尔', ituz: '39', cqz: '21' },
  '9K': { country: '科威特', ituz: '39', cqz: '21' },
  'HZ': { country: '沙特阿拉伯', ituz: '39', cqz: '21' },
  'A4': { country: '阿曼', ituz: '39', cqz: '21' },
  'A6': { country: '阿联酋', ituz: '39', cqz: '21' },
  'T7': { country: '圣马力诺', ituz: '28', cqz: '15' },
  '1A': { country: '马耳他骑士团', ituz: '28', cqz: '15' },
  'OH': { country: '芬兰', ituz: '18', cqz: '15' },
  'SM': { country: '瑞典', ituz: '18', cqz: '14' },
  'LA': { country: '挪威', ituz: '18', cqz: '14' },
  'OZ': { country: '丹麦', ituz: '18', cqz: '14' },
  'PA': { country: '荷兰', ituz: '27', cqz: '14' },
  'ON': { country: '比利时', ituz: '27', cqz: '14' },
  'HB': { country: '瑞士', ituz: '28', cqz: '14' },
  'OE': { country: '奥地利', ituz: '28', cqz: '15' },
  'HA': { country: '匈牙利', ituz: '28', cqz: '15' },
  'OK': { country: '捷克', ituz: '28', cqz: '15' },
  'SP': { country: '波兰', ituz: '28', cqz: '15' },
  'YO': { country: '罗马尼亚', ituz: '28', cqz: '20' },
  'LZ': { country: '保加利亚', ituz: '28', cqz: '20' },
  'SV': { country: '希腊', ituz: '28', cqz: '20' },
  'TA': { country: '土耳其', ituz: '39', cqz: '20' },
  '4L': { country: '格鲁吉亚', ituz: '29', cqz: '17' },
  'EK': { country: '亚美尼亚', ituz: '29', cqz: '17' },
  'EX': { country: '乌兹别克斯坦', ituz: '30', cqz: '17' },
  'EY': { country: '塔吉克斯坦', ituz: '30', cqz: '17' },
  'EZ': { country: '土库曼斯坦', ituz: '30', cqz: '17' },
  'UK': { country: '吉尔吉斯斯坦', ituz: '30', cqz: '17' },
  'C6': { country: '巴哈马', ituz: '11', cqz: '8' },
  'CO': { country: '古巴', ituz: '11', cqz: '8' },
  'HI': { country: '多米尼加', ituz: '11', cqz: '8' },
  'TG': { country: '危地马拉', ituz: '11', cqz: '7' },
  'TI': { country: '哥斯达黎加', ituz: '11', cqz: '7' },
  'HP': { country: '巴拿马', ituz: '11', cqz: '7' },
  'XE': { country: '墨西哥', ituz: '10', cqz: '6' },
  'XA': { country: '墨西哥', ituz: '10', cqz: '6' },
  'XJ': { country: '加拿大', ituz: '2,3,4', cqz: '1,2,3,4' },
  'VE': { country: '加拿大', ituz: '2,3,4', cqz: '1,2,3,4' },
  'VA': { country: '加拿大', ituz: '2,3,4', cqz: '1,2,3,4' },
  'VO': { country: '加拿大', ituz: '2,3,4', cqz: '1,2,3,4' },
  'VY': { country: '加拿大', ituz: '2,3,4', cqz: '1,2,3,4' },
  'CX': { country: '乌拉圭', ituz: '13', cqz: '13' },
  'HC': { country: '厄瓜多尔', ituz: '12', cqz: '10' },
  'OA': { country: '秘鲁', ituz: '12', cqz: '10' },
  'CP': { country: '玻利维亚', ituz: '12', cqz: '10' },
  'YV': { country: '委内瑞拉', ituz: '12', cqz: '9' },
  'P4': { country: '阿鲁巴', ituz: '11', cqz: '9' },
  'PJ': { country: '荷属安的列斯', ituz: '11', cqz: '9' },
  'J6': { country: '圣卢西亚', ituz: '11', cqz: '8' },
  '8P': { country: '巴巴多斯', ituz: '11', cqz: '8' },
  'VP': { country: '英属海外领地', ituz: '11,46', cqz: '8,35' },
  'V2': { country: '安提瓜和巴布达', ituz: '11', cqz: '8' },
  'J3': { country: '格林纳达', ituz: '11', cqz: '8' },
  'J8': { country: '圣文森特', ituz: '11', cqz: '8' },
  '3DA': { country: '斯威士兰', ituz: '57', cqz: '38' },
  'D2': { country: '安哥拉', ituz: '52', cqz: '36' },
  'TJ': { country: '喀麦隆', ituz: '47', cqz: '36' },
  '5N': { country: '尼日利亚', ituz: '46', cqz: '35' },
  '6O': { country: '索马里', ituz: '48', cqz: '37' },
  '5H': { country: '坦桑尼亚', ituz: '53', cqz: '37' },
  '4W': { country: '也门', ituz: '39', cqz: '21' },
  'A9': { country: '巴林', ituz: '39', cqz: '21' },
  'J5': { country: '几内亚比绍', ituz: '46', cqz: '35' },
  'C9': { country: '莫桑比克', ituz: '53', cqz: '37' },
  'V3': { country: '伯利兹', ituz: '11', cqz: '7' },
  'YS': { country: '萨尔瓦多', ituz: '11', cqz: '7' },
  'HH': { country: '海地', ituz: '11', cqz: '8' },
  'FS': { country: '圣马丁', ituz: '11', cqz: '8' },
  'ZF': { country: '开曼群岛', ituz: '11', cqz: '8' },
};

/**
 * 本地前缀查询
 */
function lookupLocalPrefix(call: string): CallPrefix | null {
  // 尝试2字符前缀，然后1字符
  const prefix2 = call.substring(0, 2);
  const prefix1 = call.substring(0, 1);

  if (CALL_PREFIXES[prefix2]) return CALL_PREFIXES[prefix2];
  if (CALL_PREFIXES[prefix1]) return CALL_PREFIXES[prefix1];

  // 尝试数字前缀（如7J, 4X等）
  const prefixNum = call.match(/^[A-Z0-9]{1,2}[0-9]/);
  if (prefixNum) {
    const p = prefixNum[0].substring(0, prefixNum[0].length - 1);
    if (CALL_PREFIXES[p]) return CALL_PREFIXES[p];
  }

  return null;
}

/**
 * 渲染在线查询结果
 */
function renderCallResult(data: CallInfo, el: HTMLElement): void {
  let html = '<table class="data-table" style="text-align:left">';
  html += '<tr><th style="width:120px">呼号</th><td><b>' + escHtml(data.call) + '</b></td></tr>';
  if (data.name) html += '<tr><th>姓名</th><td>' + escHtml(data.name) + '</td></tr>';
  if (data.address) html += '<tr><th>地址</th><td>' + escHtml(data.address) + '</td></tr>';
  if (data.city) html += '<tr><th>城市</th><td>' + escHtml(data.city) + '</td></tr>';
  if (data.country) html += '<tr><th>国家</th><td>' + escHtml(data.country) + '</td></tr>';
  if (data.grid) html += '<tr><th>网格</th><td>' + escHtml(data.grid) + '</td></tr>';
  if (data.lat && data.lon) html += '<tr><th>坐标</th><td>' + escHtml(String(data.lat)) + ', ' + escHtml(String(data.lon)) + '</td></tr>';
  if (data.qsl) html += '<tr><th>QSL</th><td>' + escHtml(data.qsl) + '</td></tr>';
  if (data.url) html += '<tr><th>主页</th><td><a href="' + escHtml(data.url) + '" target="_blank">' + escHtml(data.url) + '</a></td></tr>';
  html += '<tr><th>来源</th><td>' + escHtml(data.source) + '</td></tr>';
  html += '</table>';
  el.innerHTML = html;
}

/**
 * 渲染本地查询结果
 */
function renderLocalResult(call: string, data: CallPrefix, el: HTMLElement): void {
  let html = '<table class="data-table" style="text-align:left">';
  html += '<tr><th style="width:120px">呼号</th><td><b>' + escHtml(call) + '</b></td></tr>';
  html += '<tr><th>国家/地区</th><td>' + escHtml(data.country) + '</td></tr>';
  html += '<tr><th>ITU分区</th><td>' + escHtml(data.ituz) + '</td></tr>';
  html += '<tr><th>CQ分区</th><td>' + escHtml(data.cqz) + '</td></tr>';
  html += '<tr><th>来源</th><td>本地前缀数据库</td></tr>';
  html += '</table>';
  html += '<p style="font-size:11px;color:#888;margin-top:6px">提示: 在线查询可获取更详细信息。如需在线查询，请确保网络可访问 hamqth.com</p>';
  el.innerHTML = html;
}

/**
 * 清空查询
 */
function callClear(): void {
  const input = document.getElementById('callInput') as HTMLInputElement | null;
  const resultEl = document.getElementById('callResult') as HTMLElement | null;
  const statusEl = document.getElementById('callStatus') as HTMLElement | null;
  if (input) input.value = '';
  if (resultEl) resultEl.innerHTML = '';
  if (statusEl) statusEl.textContent = '';
}

// ============================================================
// 初始化
// ============================================================

function init(): void {
  console.log('[HAM] Callsign Lookup initialized');
}

// ============================================================
// 导出
// ============================================================

export {
  init,
  callLookup,
  callClear
};