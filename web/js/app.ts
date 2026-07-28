/**
 * HAM Radio Toolbox - 应用入口 (ES Module)
 * 整合模块初始化、Tab切换、事件委托、动态导入、错误边界
 * 支持Vue 3渐进式增强模式
 * @module app
 */
'use strict';

import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';
import { initData } from './core.js';
import * as Freq from './ham-freq.js';
import * as RF from './ham-rf.js';
import * as Grid from './ham-grid.js';
import * as Ref from './ham-ref.js';
import * as CW from './ham-cw.js';
import * as Utils from './ham-utils.js';
import { init as initStorage } from './ham-storage.js';

// Vue 3渐进式模式（可选）
let vueApp: any = null;
let useVue = false;

// 动态导入非核心模块（按需加载）
let Log: any = null;
let Map: any = null;
let Smith: any = null;
let Solar: any = null;
let Call: any = null;
let Voacap: any = null;
let Satellite: any = null;

// window 扩展声明
declare global {
  interface Window {
    __HAM_VUE__?: boolean;
  }
}

// ============================================================
// 全局错误边界
// ============================================================
window.onerror = function(msg: string | Event, url?: string, line?: number, col?: number, error?: Error): boolean {
  console.error('[HAM Error Boundary]', msg, url, line, col, error);
  const statusEl = document.getElementById('statusBar');
  if (statusEl) {
    const shortMsg = typeof msg === 'string' ? msg.substring(0, 80) : String(msg);
    statusEl.textContent = '⚠️ 错误: ' + shortMsg;
    statusEl.style.color = '#e74c3c';
    setTimeout(() => { statusEl.style.color = ''; }, 5000);
  }
  return true;
};

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.error('[HAM Error Boundary] Unhandled Promise:', e.reason);
});

// ============================================================
// 状态栏
// ============================================================
function setStatus(msg: string): void {
  const el = document.getElementById('statusBar');
  if (el) { el.textContent = msg; el.style.color = ''; }
}
EventBus.on('status', setStatus);

// ============================================================
// 事件委托 - 替代 window.* 全局函数映射
// ============================================================

/**
 * 动作映射表：data-action值 → 处理函数
 * 核心模块直接引用，延迟加载模块通过闭包访问
 */
const ACTION_MAP: Record<string, (el: HTMLElement) => void> = {
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

  // 参考查询
  abbrevLookup: (el: HTMLElement) => Ref.abbrevLookup((el.dataset.type || 'qcode') as 'qcode' | 'engabbr' | 'numabbr'),

  // CW练习
  cwEncode: () => CW.cwEncode(),
  cwPlayEncode: () => CW.cwPlayEncode(),
  cwDecode: () => CW.cwDecode(),
  cwStopPlay: () => CW.cwStopPlay(),
  cwPracticeStart: () => CW.cwPracticeStart(),
  cwPracticeReveal: () => CW.cwPracticeReveal(),
  cwPracticeCheck: () => CW.cwPracticeCheck(),
  cwSaveKeySettings: () => CW.saveCwKeySettings(),

  // 工具
  updateClocks: () => Utils.updateClocks(),
  addCustomClock: () => Utils.addCustomClock(),
  clearCustomClocks: () => Utils.clearCustomClocks(),
  filterClockOptions: () => Utils.filterClockOptions(),
  hideClockOptions: () => Utils.hideClockOptions(),
  propFetch: () => Utils.propFetch(),
  rstQuery: () => Utils.rstQuery(),

  // 日志（延迟加载）
  logModeRstPreset: () => {
    if (Log) { Log.logModeRstPreset(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logModeRstPreset(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logAdd: () => {
    if (Log) { Log.logAdd(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logAdd(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logCancelEdit: () => {
    if (Log) { Log.logCancelEdit(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logCancelEdit(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logClearForm: () => {
    if (Log) { Log.logClearForm(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logClearForm(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logRefreshTable: () => {
    if (Log) { Log.logRefreshTable(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logRefreshTable(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logSearchInput: () => {
    if (Log) { Log.resetPage(); Log.logRefreshTable(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.resetPage(); Log.logRefreshTable(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logEdit: (el: HTMLElement) => {
    if (Log) { Log.logEdit(el.dataset.id); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logEdit(el.dataset.id); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logDelete: (el: HTMLElement) => {
    if (Log) { Log.logDelete(el.dataset.id); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logDelete(el.dataset.id); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logExportAdi: () => {
    if (Log) { Log.logExportAdi(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logExportAdi(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logExportCabrillo: () => {
    if (Log) { Log.logExportCabrillo(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logExportCabrillo(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logExportCsv: () => {
    if (Log) { Log.logExportCsv(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logExportCsv(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logImportAdi: () => {
    if (Log) { Log.logImportAdi(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logImportAdi(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logImportAdiFile: (el: HTMLElement) => {
    if (Log) { Log.logImportAdiFile({target: el, files: (el as HTMLInputElement).files}); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logImportAdiFile({target: el, files: (el as HTMLInputElement).files}); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logBackup: () => {
    if (Log) { Log.logBackup(); return; }
    import('./ham-log.js').then(mod => {
      Log = mod;
      safeInit('Log', Log);
      Log.logBackup();
    }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logRestore: () => {
    if (Log) { Log.logRestore(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logRestore(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logRestoreFile: (el: HTMLElement) => {
    if (Log) { Log.logRestoreFile({target: el, files: (el as HTMLInputElement).files}); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logRestoreFile({target: el, files: (el as HTMLInputElement).files}); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logGoPage: (el: HTMLElement) => {
    if (Log) { Log.logGoPage(parseInt(el.dataset.page || '1')); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logGoPage(parseInt(el.dataset.page || '1')); }).catch(() => showToast('日志模块加载失败', 'error'));
  },
  logStats: () => {
    if (Log) { Log.logStats(); return; }
    import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logStats(); }).catch(() => showToast('日志模块加载失败', 'error'));
  },

  // 地图（延迟加载）
  mapRender: () => {
    if (Map) { Map.mapRender(); return; }
    import('./ham-map.js').then(mod => { Map = mod; Map.mapRender(); });
  },
  retryMapLoad: () => {
    if (Map) { Map.retryMapLoad(); return; }
    import('./ham-map.js').then(mod => { Map = mod; Map.retryMapLoad(); });
  },

  // Smith圆图（延迟加载）
  smithCalc: () => {
    if (Smith) { Smith.smithCalc(); return; }
    import('./ham-smith.js').then(mod => { Smith = mod; Smith.smithCalc(); });
  },
  smithClear: () => {
    if (Smith) { Smith.smithClear(); return; }
    import('./ham-smith.js').then(mod => { Smith = mod; Smith.smithClear(); });
  },

  // 太阳通量（延迟加载）
  solarRefresh: () => {
    if (Solar) { Solar.solarRefresh(); return; }
    import('./ham-solar.js').then(mod => { Solar = mod; Solar.solarRefresh(); });
  },
  solarClearCache: () => {
    if (Solar) { Solar.solarClearCache(); return; }
    import('./ham-solar.js').then(mod => { Solar = mod; Solar.solarClearCache(); });
  },

  // 呼号查询（延迟加载）
  callLookup: () => {
    if (Call) { Call.callLookup(); return; }
    import('./ham-callsign.js').then(mod => { Call = mod; Call.callLookup(); });
  },
  callClear: () => {
    if (Call) { Call.callClear(); return; }
    import('./ham-callsign.js').then(mod => { Call = mod; Call.callClear(); });
  },

  // VOACAP传播预测（延迟加载）
  voacapRun: () => {
    if (Voacap) { Voacap.runPrediction(); return; }
    import('./ham-voacap.js').then(mod => { Voacap = mod; Voacap.runPrediction(); });
  },
  voacapClear: () => {
    if (Voacap) { Voacap.clearPrediction(); return; }
    import('./ham-voacap.js').then(mod => { Voacap = mod; Voacap.clearPrediction(); });
  },
  voacapFillSfi: () => {
    if (Voacap) { Voacap.fillCurrentSfi(); return; }
    import('./ham-voacap.js').then(mod => { Voacap = mod; Voacap.fillCurrentSfi(); });
  },

  // 卫星跟踪（延迟加载）
  satSelectChange: () => {
    if (Satellite) { Satellite.selectSatellite(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.selectSatellite(); });
  },
  satSwitchApiSource: () => {
    if (Satellite) { Satellite.switchApiSource(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.switchApiSource(); });
  },
  satPredictPasses: () => {
    if (Satellite) { Satellite.predictPasses(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.predictPasses(); });
  },
  satClear: () => {
    if (Satellite) { Satellite.clearSatellite(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.clearSatellite(); });
  },
  satGetMyLocation: () => {
    if (Satellite) { Satellite.getMyLocation(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.getMyLocation(); });
  },
  satSaveApiKey: () => {
    if (Satellite) { Satellite.saveApiKey(); return; }
    import('./ham-satellite.js').then(mod => { Satellite = mod; Satellite.saveApiKey(); });
  },

  // 子Tab切换
  switchSubTab: (el: HTMLElement) => switchSubTab(el, el.dataset.parent || 'ref'),

  // 通用清空（data-target指定要清空的元素ID，逗号分隔多个）
  clearTarget: (el: HTMLElement) => {
    const targets = (el.dataset.target || '').split(',');
    targets.forEach(id => {
      const target = document.getElementById(id.trim());
      if (target) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') (target as HTMLInputElement | HTMLTextAreaElement).value = '';
        else target.textContent = '';
      }
    });
  },

  // Toast通知（供模块内使用）
  toast: (el: HTMLElement) => showToast(el.dataset.message || '', (el.dataset.type as any) || 'info')
};

/**
 * 初始化事件委托
 * 使用data-action属性替代onclick，data-enter替代onkeydown Enter
 */
function initEventDelegation(): void {
  // 点击事件委托
  document.body.addEventListener('click', (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.action!;
    const handler = ACTION_MAP[action];
    if (handler) {
      e.preventDefault();
      handler(el);
    } else {
      console.warn('[HAM] Unknown action:', action);
    }
  });

  // Enter键事件委托
  document.body.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const el = (e.target as HTMLElement).closest('[data-enter]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.enter!;
    const handler = ACTION_MAP[action];
    if (handler) {
      e.preventDefault();
      handler(el);
    }
  });

  // change事件委托（用于select等）
  document.body.addEventListener('change', (e: Event) => {
    const el = (e.target as HTMLElement).closest('[data-change]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.change!;
    const handler = ACTION_MAP[action];
    if (handler) {
      handler(el);
    }
  });

  // 文件输入事件委托
  document.body.addEventListener('change', (e: Event) => {
    const el = (e.target as HTMLElement).closest('[data-file-action]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.fileAction!;
    const handler = ACTION_MAP[action];
    if (handler) {
      handler(el);
    }
  });

  // input事件委托（用于搜索框等实时响应）
  document.body.addEventListener('input', (e: Event) => {
    const el = (e.target as HTMLElement).closest('[data-input]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.input!;
    const handler = ACTION_MAP[action];
    if (handler) {
      handler(el);
    }
  });

  // focus事件委托
  document.body.addEventListener('focusin', (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest('[data-focus]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.focus!;
    const handler = ACTION_MAP[action];
    if (handler) {
      handler(el);
    }
  });

  // blur事件委托
  document.body.addEventListener('focusout', (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest('[data-blur]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.blur!;
    const handler = ACTION_MAP[action];
    if (handler) {
      handler(el);
    }
  });
}

// ============================================================
// Tab 切换
// ============================================================
function initTabs(): void {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabEl = document.getElementById('tab-' + (btn as HTMLElement).dataset.tab);
      if (tabEl) tabEl.classList.add('active');

      // 按需加载并初始化地图模块
      if ((btn as HTMLElement).dataset.tab === 'map') {
        if (!Map) {
          import('./ham-map.js').then(mod => {
            Map = mod;
            Map.init();
            setTimeout(() => Map.mapRender(), 100);
          }).catch((err: Error) => console.error('[HAM] Map module load failed:', err));
        } else {
          setTimeout(() => Map.mapRender(), 100);
        }
      }

      // 按需加载日志模块
      if ((btn as HTMLElement).dataset.tab === 'log' && !Log) {
        import('./ham-log.js').then(mod => {
          Log = mod;
          Log.init();
        }).catch((err: Error) => console.error('[HAM] Log module load failed:', err));
      }

      // 工具Tab时更新时钟
      if ((btn as HTMLElement).dataset.tab === 'utils') {
        Utils.updateClocks();
      }

      // 按需加载Smith圆图模块（射频工具Tab内）
      if ((btn as HTMLElement).dataset.tab === 'rf') {
        if (!Smith) {
          import('./ham-smith.js').then(mod => {
            Smith = mod;
            Smith.init();
          }).catch((err: Error) => console.error('[HAM] Smith module load failed:', err));
        }
      }

      // 按需加载太阳通量模块（传播预测Tab内）
      if ((btn as HTMLElement).dataset.tab === 'voacap') {
        if (!Solar) {
          import('./ham-solar.js').then(mod => {
            Solar = mod;
            Solar.init();
          }).catch((err: Error) => console.error('[HAM] Solar module load failed:', err));
        }
      }

      // 按需加载呼号查询模块
      if ((btn as HTMLElement).dataset.tab === 'call' && !Call) {
        import('./ham-callsign.js').then(mod => {
          Call = mod;
          Call.init();
        }).catch((err: Error) => console.error('[HAM] Call module load failed:', err));
      }

      // 按需加载VOACAP传播预测模块
      if ((btn as HTMLElement).dataset.tab === 'voacap' && !Voacap) {
        import('./ham-voacap.js').then(mod => {
          Voacap = mod;
          Voacap.init();
        }).catch((err: Error) => console.error('[HAM] VOACAP module load failed:', err));
      }

      // 按需加载卫星跟踪模块
      if ((btn as HTMLElement).dataset.tab === 'satellite' && !Satellite) {
        import('./ham-satellite.js').then(mod => {
          Satellite = mod;
          Satellite.init();
        }).catch((err: Error) => console.error('[HAM] Satellite module load failed:', err));
      }
    });
  });
}

// 子Tab切换
function switchSubTab(el: HTMLElement, parent: string): void {
  const container = el.closest('.tab-content') || el.closest('.card');
  if (!container) return;
  container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  container.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const subEl = document.getElementById(parent + '-' + el.dataset.sub);
  if (subEl) subEl.classList.add('active');
}

// ============================================================
// 模块安全初始化
// ============================================================
function safeInit(name: string, mod: any): void {
  if (mod && typeof mod.init === 'function') {
    try {
      mod.init();
      console.log('[HAM] Module ' + name + ' initialized OK');
    } catch(e) {
      console.error('[HAM] Module ' + name + ' init FAILED:', e);
    }
  }
}

// ============================================================
// 应用启动
// ============================================================
async function boot(): Promise<void> {
  // 先加载JSON静态数据
  await initData();

  // 初始化核心模块
  safeInit('Freq', Freq);
  safeInit('RF', RF);
  safeInit('Grid', Grid);
  safeInit('Ref', Ref);
  safeInit('CW', CW);
  safeInit('Utils', Utils);
  // 初始化存储监控（防御性调用，避免异常阻断后续初始化）
  try { initStorage(); } catch(e) { console.error('[HAM] Storage init FAILED:', e); }

  // 事件委托
  initEventDelegation();

  // Tab切换
  initTabs();

  // 如果日志Tab默认激活，立即加载
  const logTab = document.getElementById('tab-log');
  if (logTab && logTab.classList.contains('active')) {
    import('./ham-log.js').then(mod => {
      Log = mod;
      safeInit('Log', Log);
    }).catch((err: Error) => console.error('[HAM] Log module load failed:', err));
  }

  // 如果地图Tab默认激活，立即加载
  const mapTab = document.getElementById('tab-map');
  if (mapTab && mapTab.classList.contains('active')) {
    import('./ham-map.js').then(mod => {
      Map = mod;
      safeInit('Map', Map);
      setTimeout(() => Map.mapRender(), 100);
    }).catch((err: Error) => console.error('[HAM] Map module load failed:', err));
  }

  setStatus('HAM Radio Toolbox 就绪');
  console.log('[HAM] App booted (ES Modules + Event Delegation)');
}

// DOM就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// ============================================================
// Vue 3 渐进式增强模式
// 在HTML中添加 <div id="vue-app"></div> 并设置 window.__HAM_VUE__ = true
// 即可启用Vue模式，否则使用传统DOM模式
// ============================================================
export async function bootVue(): Promise<void> {
  try {
    const { createHamApp } = await import('./vue-app.js') as any;
    const app = await createHamApp();
    const mountEl = document.getElementById('vue-app');
    if (mountEl) {
      app.mount(mountEl);
      vueApp = app;
      useVue = true;
      console.log('[HAM] Vue 3 mode activated');
    } else {
      console.warn('[HAM] #vue-app element not found, falling back to DOM mode');
      boot();
    }
  } catch (e) {
    console.warn('[HAM] Vue 3 load failed, using DOM mode:', e);
    boot();
  }
}

// 自动检测Vue模式
if (window.__HAM_VUE__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootVue);
  } else {
    bootVue();
  }
}