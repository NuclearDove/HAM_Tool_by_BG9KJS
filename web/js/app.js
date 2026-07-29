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
let vueApp = null;
let useVue = false;
// 动态导入非核心模块（按需加载）
let Log = null;
let Map = null;
let Smith = null;
let Solar = null;
let Call = null;
let Voacap = null;
let Satellite = null;
// ============================================================
// 全局错误边界
// ============================================================
window.onerror = function (msg, url, line, col, error) {
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
window.addEventListener('unhandledrejection', (e) => {
    console.error('[HAM Error Boundary] Unhandled Promise:', e.reason);
});
// ============================================================
// 状态栏
// ============================================================
function setStatus(msg) {
    const el = document.getElementById('statusBar');
    if (el) {
        el.textContent = msg;
        el.style.color = '';
    }
}
EventBus.on('status', setStatus);
// ============================================================
// 事件委托 - 替代 window.* 全局函数映射
// ============================================================
/**
 * 动作映射表：data-action值 → 处理函数
 * 核心模块直接引用，延迟加载模块通过闭包访问
 */
const ACTION_MAP = {
    // Tab切换
    switchTab: (el) => {
        const tab = el.dataset.tab;
        if (!tab) return;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
        if (btn) btn.classList.add('active');
        const tabEl = document.getElementById('tab-' + tab);
        if (tabEl) tabEl.classList.add('active');
    },
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
    logEdit: (el) => {
        if (Log) { Log.logEdit(el.dataset.id); return; }
        import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logEdit(el.dataset.id); }).catch(() => showToast('日志模块加载失败', 'error'));
    },
    logDelete: (el) => {
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
    logImportAdiFile: (el) => {
        if (Log) { Log.logImportAdiFile({ target: el, files: el.files }); return; }
        import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logImportAdiFile({ target: el, files: el.files }); }).catch(() => showToast('日志模块加载失败', 'error'));
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
    logRestoreFile: (el) => {
        if (Log) { Log.logRestoreFile({ target: el, files: el.files }); return; }
        import('./ham-log.js').then(mod => { Log = mod; safeInit('Log', Log); Log.logRestoreFile({ target: el, files: el.files }); }).catch(() => showToast('日志模块加载失败', 'error'));
    },
    logGoPage: (el) => {
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
    satSwitchApiSource: () => {
        if (Satellite) { Satellite.switchApiSource(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.switchApiSource(); });
    },
    satPredictPasses: () => {
        if (Satellite) { Satellite.predictPasses(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.predictPasses(); });
    },
    satClear: () => {
        if (Satellite) { Satellite.clearSatellite(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.clearSatellite(); });
    },
    satGetMyLocation: () => {
        if (Satellite) { Satellite.getMyLocation(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.getMyLocation(); });
    },
    satSaveApiKey: () => {
        if (Satellite) { Satellite.saveApiKey(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.saveApiKey(); });
    },
    satUpdatePosition: () => {
        if (Satellite) { Satellite.updatePosition(); return; }
        import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; Satellite.init(); Satellite.updatePosition(); });
    },
    // 子Tab切换
    switchSubTab: (el) => switchSubTab(el, el.dataset.parent || 'ref'),
    // 通用清空（data-target指定要清空的元素ID，逗号分隔多个）
    clearTarget: (el) => {
        const targets = (el.dataset.target || '').split(',');
        targets.forEach(id => {
            const target = document.getElementById(id.trim());
            if (target) {
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
                    target.value = '';
                else
                    target.textContent = '';
            }
        });
    },
    // Toast通知（供模块内使用）
    toast: (el) => showToast(el.dataset.message || '', el.dataset.type || 'info')
};
/**
 * 初始化事件委托
 * 使用data-action属性替代onclick，data-enter替代onkeydown Enter
 */
function initEventDelegation() {
    // 点击事件委托
    document.body.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el)
            return;
        const action = el.dataset.action;
        const handler = ACTION_MAP[action];
        if (handler) {
            e.preventDefault();
            handler(el);
        }
        else {
            console.warn('[HAM] Unknown action:', action);
        }
    });
    // Enter键事件委托
    document.body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter')
            return;
        const el = e.target.closest('[data-enter]');
        if (!el)
            return;
        const action = el.dataset.enter;
        const handler = ACTION_MAP[action];
        if (handler) {
            e.preventDefault();
            handler(el);
        }
    });
    // change事件委托（用于select等）
    document.body.addEventListener('change', (e) => {
        const el = e.target.closest('[data-change]');
        if (!el)
            return;
        const action = el.dataset.change;
        const handler = ACTION_MAP[action];
        if (handler) {
            handler(el);
        }
    });
    // 文件输入事件委托
    document.body.addEventListener('change', (e) => {
        const el = e.target.closest('[data-file-action]');
        if (!el)
            return;
        const action = el.dataset.fileAction;
        const handler = ACTION_MAP[action];
        if (handler) {
            handler(el);
        }
    });
    // input事件委托（用于搜索框等实时响应）
    document.body.addEventListener('input', (e) => {
        const el = e.target.closest('[data-input]');
        if (!el)
            return;
        const action = el.dataset.input;
        const handler = ACTION_MAP[action];
        if (handler) {
            handler(el);
        }
    });
    // focus事件委托
    document.body.addEventListener('focusin', (e) => {
        const el = e.target.closest('[data-focus]');
        if (!el)
            return;
        const action = el.dataset.focus;
        const handler = ACTION_MAP[action];
        if (handler) {
            handler(el);
        }
    });
    // blur事件委托
    document.body.addEventListener('focusout', (e) => {
        const el = e.target.closest('[data-blur]');
        if (!el)
            return;
        const action = el.dataset.blur;
        const handler = ACTION_MAP[action];
        if (handler) {
            handler(el);
        }
    });
}
// ============================================================
// Tab 切换
// ============================================================
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabEl = document.getElementById('tab-' + btn.dataset.tab);
            if (tabEl)
                tabEl.classList.add('active');
            // 按需加载并初始化地图模块
            if (btn.dataset.tab === 'map') {
                if (!Map) {
                    import('./ham-map.js').then(mod => {
                        Map = mod;
                        Map.init();
                        setTimeout(() => Map.mapRender(), 100);
                    }).catch((err) => console.error('[HAM] Map module load failed:', err));
                }
                else {
                    setTimeout(() => Map.mapRender(), 100);
                }
            }
            // 按需加载日志模块
            if (btn.dataset.tab === 'log' && !Log) {
                import('./ham-log.js').then(mod => {
                    Log = mod;
                    Log.init();
                }).catch((err) => console.error('[HAM] Log module load failed:', err));
            }
            // 工具Tab时更新时钟
            if (btn.dataset.tab === 'utils') {
                Utils.updateClocks();
            }
            // 按需加载Smith圆图模块（射频工具Tab内）
            if (btn.dataset.tab === 'rf') {
                if (!Smith) {
                    import('./ham-smith.js').then(mod => {
                        Smith = mod;
                        Smith.init();
                    }).catch((err) => console.error('[HAM] Smith module load failed:', err));
                }
            }
            // 按需加载太阳通量模块（传播预测Tab内）
            if (btn.dataset.tab === 'voacap') {
                if (!Solar) {
                    import('./ham-solar.js').then(mod => {
                        Solar = mod;
                        Solar.init();
                    }).catch((err) => console.error('[HAM] Solar module load failed:', err));
                }
            }
            // 按需加载呼号查询模块
            if (btn.dataset.tab === 'call' && !Call) {
                import('./ham-callsign.js').then(mod => {
                    Call = mod;
                    Call.init();
                }).catch((err) => console.error('[HAM] Call module load failed:', err));
            }
            // 按需加载VOACAP传播预测模块
            if (btn.dataset.tab === 'voacap' && !Voacap) {
                import('./ham-voacap.js').then(mod => {
                    Voacap = mod;
                    Voacap.init();
                }).catch((err) => console.error('[HAM] VOACAP module load failed:', err));
            }
            // 按需加载卫星跟踪模块
            if (btn.dataset.tab === 'satellite') {
                const loadSat = Satellite ? Promise.resolve(Satellite) : import('./ham-satellite.js?v=20260730').then(mod => { Satellite = mod; return mod; });
                loadSat.then(mod => { mod.init(); }).catch((err) => console.error('[HAM] Satellite module load failed:', err));
            }
        });
    });
}
// 子Tab切换
function switchSubTab(el, parent) {
    const container = el.closest('.tab-content') || el.closest('.card');
    if (!container)
        return;
    container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const subEl = document.getElementById(parent + '-' + el.dataset.sub);
    if (subEl)
        subEl.classList.add('active');
}
// ============================================================
// 模块安全初始化
// ============================================================
function safeInit(name, mod) {
    if (mod && typeof mod.init === 'function') {
        try {
            mod.init();
            console.log('[HAM] Module ' + name + ' initialized OK');
        }
        catch (e) {
            console.error('[HAM] Module ' + name + ' init FAILED:', e);
        }
    }
}
// ============================================================
// 应用启动
// ============================================================
async function boot() {
    console.log('[HAM] boot() started');
    // 先加载JSON静态数据
    try {
        await initData();
        console.log('[HAM] initData() completed');
    } catch(e) {
        console.error('[HAM] initData() FAILED:', e);
    }
    // 初始化核心模块
    safeInit('Freq', Freq);
    safeInit('RF', RF);
    safeInit('Grid', Grid);
    safeInit('Ref', Ref);
    safeInit('CW', CW);
    safeInit('Utils', Utils);
    // 初始化存储监控（防御性调用，避免异常阻断后续初始化）
    try { initStorage(); console.log('[HAM] Storage init OK'); } catch(e) { console.error('[HAM] Storage init FAILED:', e); }
    // 事件委托
    try { initEventDelegation(); console.log('[HAM] initEventDelegation() OK'); } catch(e) { console.error('[HAM] initEventDelegation() FAILED:', e); }
    // Tab切换
    try { initTabs(); console.log('[HAM] initTabs() OK'); } catch(e) { console.error('[HAM] initTabs() FAILED:', e); }
    // 如果日志Tab默认激活，立即加载
    const logTab = document.getElementById('tab-log');
    if (logTab && logTab.classList.contains('active')) {
        import('./ham-log.js').then(mod => {
            Log = mod;
            safeInit('Log', Log);
        }).catch((err) => console.error('[HAM] Log module load failed:', err));
    }
    // 如果地图Tab默认激活，立即加载
    const mapTab = document.getElementById('tab-map');
    if (mapTab && mapTab.classList.contains('active')) {
        import('./ham-map.js').then(mod => {
            Map = mod;
            safeInit('Map', Map);
            setTimeout(() => Map.mapRender(), 100);
        }).catch((err) => console.error('[HAM] Map module load failed:', err));
    }
    setStatus('HAM Radio Toolbox 就绪');
    window.__HAM_BOOTED__ = true;
    if (window.__HAM_BOOT_TIMEOUT__) clearTimeout(window.__HAM_BOOT_TIMEOUT__);
    console.log('[HAM] App booted (ES Modules + Event Delegation)');
}
// DOM就绪后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
}
else {
    boot();
}
// ============================================================
// Vue 3 渐进式增强模式
// 在HTML中添加 <div id="vue-app"></div> 并设置 window.__HAM_VUE__ = true
// 即可启用Vue模式，否则使用传统DOM模式
// ============================================================
export async function bootVue() {
    try {
        const { createHamApp } = await import('./vue-app.js');
        const app = await createHamApp();
        const mountEl = document.getElementById('vue-app');
        if (mountEl) {
            app.mount(mountEl);
            vueApp = app;
            useVue = true;
            console.log('[HAM] Vue 3 mode activated');
        }
        else {
            console.warn('[HAM] #vue-app element not found, falling back to DOM mode');
            boot();
        }
    }
    catch (e) {
        console.warn('[HAM] Vue 3 load failed, using DOM mode:', e);
        boot();
    }
}
// 自动检测Vue模式
if (window.__HAM_VUE__) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootVue);
    }
    else {
        bootVue();
    }
}
//# sourceMappingURL=app.js.map