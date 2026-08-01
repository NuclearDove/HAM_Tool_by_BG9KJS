/**
 * HAM Radio Toolbox - 应用入口 (ES Module)
 * @module app
 */
"use strict";
import { EventBus } from "./event-bus.js";
import { showToast } from "./ham-toast.js";
import { initData } from "./core.js";
import * as Freq from "./ham-freq.js";
import * as RF from "./ham-rf.js";
import * as Grid from "./ham-grid.js";
import * as Ref from "./ham-ref.js";
import * as CW from "./ham-cw.js";
import * as Utils from "./ham-utils.js";
import { init as initStorage } from "./ham-storage.js";

// 延迟加载模块缓存
const _m = {};
// 延迟加载辅助：name=模块名, path=导入路径, method=方法名, argFn=参数提取函数
function _lazy(name, path, method, argFn) {
  return (el) => {
    if (_m[name]) { _m[name][method](argFn ? argFn(el) : undefined); return; }
    import(path).then(mod => { _m[name] = mod; safeInit(name, mod); mod[method](argFn ? argFn(el) : undefined); }).catch(() => showToast(name + '模块加载失败', 'error'));
  };
}
// 全局错误边界
window.onerror = function (msg, url, line, col, error) {
  console.error('[HAM Error]', msg, url, line, col, error);
  const el = document.getElementById('statusBar');
  if (el) {
    el.textContent = '⚠️ 错误: ' + (typeof msg === 'string' ? msg.substring(0, 80) : String(msg));
    el.style.color = '#e74c3c';
    setTimeout(() => { el.style.color = ''; }, 5000);
  }
  return true;
};
window.addEventListener("unhandledrejection", (e) => {
  console.error('[HAM Error] Unhandled Promise:', e.reason);
});
// 状态栏
function setStatus(msg) {
  const el = document.getElementById('statusBar');
  if (el) { el.textContent = msg; el.style.color = ''; }
}
EventBus.on("status", setStatus);
// 动作映射表
const ACTION_MAP = {
  // 频率查询
  onSearchModeChange: () => Freq.onSearchModeChange(),
  freqQuery: () => Freq.freqQuery(),
  freqClear: () => Freq.freqClear(),
  // 射频计算
  antennaCalc: () => RF.antennaCalc(),
  powerConvert: () => RF.powerConvert(),
  swrFromPower: () => RF.swrFromPower(),
  swrToReflect: () => RF.swrToReflect(),
  coaxCalc: () => RF.coaxCalc(),
  // 网格坐标
  llToGrid: () => Grid.llToGrid(),
  gridToLl: () => Grid.gridToLl(),
  gridDistance: () => Grid.gridDistance(),
  getMyLocation: () => Grid.getMyLocation(),
  switchLatLonMode: () => Grid.switchLatLonMode(),
  // 参考查询
  abbrevLookup: (el) => Ref.abbrevLookup((el.dataset.type || 'qcode')),
  // CW练习
  cwEncode: () => CW.cwEncode(),
  cwPlayEncode: () => CW.cwPlayEncode(),
  cwDecode: () => CW.cwDecode(),
  cwStopPlay: () => CW.cwStopPlay(),
  cwPracticeStart: () => CW.cwPracticeStart(),
  cwPracticeReveal: () => CW.cwPracticeReveal(),
  cwPracticeCheck: () => CW.cwPracticeCheck(),
  cwSaveKeySettings: () => CW.saveCwKeySettings(),
  // Koch方法训练
  kochStart: () => CW.kochStart(),
  kochNextRound: () => CW.kochNextRound(),
  kochCheck: () => CW.kochCheck(),
  kochReveal: () => CW.kochReveal(),
  kochSkipLevel: () => CW.kochSkipLevel(),
  kochReset: () => CW.kochReset(),
  kochSetCustom: () => CW.kochSetCustom(),
  kochToggleAutoSpeed: () => CW.kochToggleAutoSpeed(),
  // 工具
  updateClocks: () => Utils.updateClocks(),
  addCustomClock: () => Utils.addCustomClock(),
  clearCustomClocks: () => Utils.clearCustomClocks(),
  filterClockOptions: debounce(() => Utils.filterClockOptions(), 300),
  hideClockOptions: () => Utils.hideClockOptions(),
  rstQuery: () => Utils.rstQuery(),
  // 日志（延迟加载）
  logModeRstPreset: _lazy('Log', './ham-log.js', 'logModeRstPreset'),
  logAdd: _lazy('Log', './ham-log.js', 'logAdd'),
  logCancelEdit: _lazy('Log', './ham-log.js', 'logCancelEdit'),
  logClearForm: _lazy('Log', './ham-log.js', 'logClearForm'),
  logRefreshTable: _lazy('Log', './ham-log.js', 'logRefreshTable'),
  logSearchInput: () => {
    if (_m.Log) { _m.Log.resetPage(); _m.Log.logRefreshTable(); return; }
    import('./ham-log.js').then(mod => { _m.Log = mod; safeInit('Log', mod); mod.resetPage(); mod.logRefreshTable(); }).catch(() => showToast('Log模块加载失败', 'error'));
  },
  logEdit: _lazy('Log', './ham-log.js', 'logEdit', el => el.dataset.id),
  logDelete: _lazy('Log', './ham-log.js', 'logDelete', el => el.dataset.id),
  logExportAdi: _lazy('Log', './ham-log.js', 'logExportAdi'),
  logExportCabrillo: _lazy('Log', './ham-log.js', 'logExportCabrillo'),
  logExportCsv: _lazy('Log', './ham-log.js', 'logExportCsv'),
  logExportJson: _lazy('Log', './ham-log.js', 'logExportJson'),
  logImportAdi: _lazy('Log', './ham-log.js', 'logImportAdi'),
  logImportAdiFile: _lazy('Log', './ham-log.js', 'logImportAdiFile', el => ({ target: el, files: el.files })),
  logBackup: _lazy('Log', './ham-log.js', 'logBackup'),
  logRestore: _lazy('Log', './ham-log.js', 'logRestore'),
  logRestoreFile: _lazy('Log', './ham-log.js', 'logRestoreFile', el => ({ target: el, files: el.files })),
  logGoPage: _lazy('Log', './ham-log.js', 'logGoPage', el => parseInt(el.dataset.page || '1')),
  logStats: _lazy('Log', './ham-log.js', 'logStats'),
  // 地图（延迟加载）
  mapRender: _lazy('Map', './ham-map.js', 'mapRender'),
  retryMapLoad: _lazy('Map', './ham-map.js', 'retryMapLoad'),
  // Smith圆图
  smithCalc: _lazy('Smith', './ham-smith.js', 'smithCalc'),
  smithClear: _lazy('Smith', './ham-smith.js', 'smithClear'),
  // 太阳通量
  solarRefresh: _lazy('Solar', './ham-solar.js', 'solarRefresh'),
  solarClearCache: _lazy('Solar', './ham-solar.js', 'solarClearCache'),
  // 呼号查询
  callLookup: _lazy('Call', './ham-callsign.js', 'callLookup'),
  callClear: _lazy('Call', './ham-callsign.js', 'callClear'),
  // VOACAP传播预测
  voacapRun: _lazy('Voacap', './ham-voacap.js', 'runPrediction'),
  voacapClear: _lazy('Voacap', './ham-voacap.js', 'clearPrediction'),
  voacapFillSfi: _lazy('Voacap', './ham-voacap.js', 'fillCurrentSfi'),
  // 卫星跟踪
  satSwitchApiSource: () => {
    if (_m.Satellite) { _m.Satellite.switchApiSource(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.switchApiSource(); });
  },
  satPredictPasses: () => {
    if (_m.Satellite) { _m.Satellite.predictPasses(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.predictPasses(); });
  },
  satClear: () => {
    if (_m.Satellite) { _m.Satellite.clearSatellite(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.clearSatellite(); });
  },
  satGetMyLocation: () => {
    if (_m.Satellite) { _m.Satellite.getMyLocation(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.getMyLocation(); });
  },
  satSaveApiKey: () => {
    if (_m.Satellite) { _m.Satellite.saveApiKey(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.saveApiKey(); });
  },
  satUpdatePosition: () => {
    if (_m.Satellite) { _m.Satellite.updatePosition(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.updatePosition(); });
  },
  satShowGroundTrack: () => {
    if (_m.Satellite) { _m.Satellite.showGroundTrack(); return; }
    import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; mod.init(); mod.showGroundTrack(); });
  },
  // 子Tab切换
  switchSubTab: (el) => switchSubTab(el, el.dataset.parent || 'ref'),
  // 通用清空
  clearTarget: (el) => {
    (el.dataset.target || '').split(',').forEach(id => {
      const t = document.getElementById(id.trim());
      if (t) { if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') t.value = ''; else t.textContent = ''; }
    });
  },
  toast: (el) => showToast(el.dataset.message || '', el.dataset.type || 'info')
};
// 防抖辅助函数
function debounce(fn, ms) {
  let timer = null;
  return (el) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(el); }, ms);
  };
}
// 事件委托
function initEventDelegation() {
  const handle = (attr, e) => {
    const el = e.target.closest('[' + attr + ']');
    if (!el) return;
    const action = el.getAttribute(attr);
    const handler = ACTION_MAP[action];
    if (handler) { e.preventDefault(); handler(el); }
    else if (attr === 'data-action' || attr === 'data-change') { console.warn('[HAM] Unknown action:', action); }
  };
  document.body.addEventListener('click', (e) => handle('data-action', e));
  document.body.addEventListener('keydown', (e) => { if (e.key === 'Enter') handle('data-enter', e); });
  document.body.addEventListener('change', (e) => { handle('data-change', e); handle('data-file-action', e); });
  document.body.addEventListener('input', (e) => handle('data-input', e));
  document.body.addEventListener('focusin', (e) => handle('data-focus', e));
  document.body.addEventListener('focusout', (e) => handle('data-blur', e));
}
// Tab 切换
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabEl = document.getElementById('tab-' + btn.dataset.tab);
      if (tabEl) tabEl.classList.add('active');
      const tab = btn.dataset.tab;
      // 按需加载模块
      if (tab === 'map' && !_m.Map) {
        import('./ham-map.js').then(mod => { _m.Map = mod; mod.init(); setTimeout(() => mod.mapRender(), 100); }).catch((e) => console.error('[HAM] Map load failed:', e));
      } else if (tab === 'map' && _m.Map) { setTimeout(() => _m.Map.mapRender(), 100); }
      if (tab === 'log' && !_m.Log) {
        import('./ham-log.js').then(mod => { _m.Log = mod; mod.init(); }).catch((e) => console.error('[HAM] Log load failed:', e));
      }
      if (tab === 'utils') Utils.updateClocks();
      if (tab === 'rf' && !_m.Smith) {
        import('./ham-smith.js').then(mod => { _m.Smith = mod; mod.init(); }).catch((e) => console.error('[HAM] Smith load failed:', e));
      }
      if (tab === 'voacap' && !_m.Solar) {
        import('./ham-solar.js').then(mod => { _m.Solar = mod; mod.init(); }).catch((e) => console.error('[HAM] Solar load failed:', e));
      }
      if (tab === 'call' && !_m.Call) {
        import('./ham-callsign.js').then(mod => { _m.Call = mod; mod.init(); }).catch((e) => console.error('[HAM] Call load failed:', e));
      }
      if (tab === 'voacap' && !_m.Voacap) {
        import('./ham-voacap.js').then(mod => { _m.Voacap = mod; mod.init(); }).catch((e) => console.error('[HAM] Voacap load failed:', e));
      }
      if (tab === 'satellite') {
        const p = _m.Satellite ? Promise.resolve(_m.Satellite) : import('./ham-satellite.js?v=20260802').then(mod => { _m.Satellite = mod; return mod; });
        p.then(mod => mod.init()).catch((e) => console.error('[HAM] Satellite load failed:', e));
      }
    });
  });
}
// 子Tab切换
function switchSubTab(el, parent) {
  const container = el.closest('.tab-content') || el.closest('.card');
  if (!container) return;
  container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  container.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const subEl = document.getElementById(parent + '-' + el.dataset.sub);
  if (subEl) subEl.classList.add('active');
}
// 模块安全初始化
function safeInit(name, mod) {
  if (mod && typeof mod.init === 'function') {
    try { mod.init(); } catch (e) { console.error('[HAM] ' + name + ' init failed:', e); }
  }
}
// 应用启动
async function boot() {
  await initData();
  safeInit('Freq', Freq); safeInit('RF', RF); safeInit('Grid', Grid);
  safeInit('Ref', Ref); safeInit('CW', CW); safeInit('Utils', Utils);
  try { initStorage(); } catch (e) { console.error('[HAM] Storage init failed:', e); }
  try { initEventDelegation(); } catch (e) { console.error('[HAM] Event delegation failed:', e); }
  try { initTabs(); } catch (e) { console.error('[HAM] Tabs init failed:', e); }
  // 默认激活Tab的模块预加载
  const logTab = document.getElementById('tab-log');
  if (logTab && logTab.classList.contains('active')) {
    import('./ham-log.js').then(mod => { _m.Log = mod; safeInit('Log', mod); }).catch((e) => console.error('[HAM] Log load failed:', e));
  }
  const mapTab = document.getElementById('tab-map');
  if (mapTab && mapTab.classList.contains('active')) {
    import('./ham-map.js').then(mod => { _m.Map = mod; safeInit('Map', mod); setTimeout(() => mod.mapRender(), 100); }).catch((e) => console.error('[HAM] Map load failed:', e));
  }
  setStatus('HAM Radio Toolbox 就绪');
  window.__HAM_BOOTED__ = true;
}
// DOM就绪后启动
if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
// Vue 3 渐进式增强
export async function bootVue() {
  try {
    const { createHamApp } = await import('./vue-app.js');
    const app = await createHamApp();
    const mountEl = document.getElementById('vue-app');
    if (mountEl) { app.mount(mountEl); }
    else { boot(); }
  } catch (e) {
    console.warn('[HAM] Vue 3 load failed, using DOM mode:', e);
    boot();
  }
}
if (window.__HAM_VUE__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootVue);
  } else {
    bootVue();
  }
}
