/**
 * HAM Radio Toolbox - Vue 3 应用入口
 * 渐进式迁移：Vue管理Tab切换和全局状态，现有模块作为Composition API组件
 * @module vue-app
 */
'use strict';
import { initData } from './core.js';
import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';
// Vue 3 API引用（延迟初始化）
let createApp, reactive, computed, onMounted, defineComponent;
// ============================================================
// 全局状态管理
// ============================================================
let appState = {};
// ============================================================
// Tab组件
// ============================================================
let HamTabs;
// ============================================================
// 状态栏组件
// ============================================================
let StatusBar;
// ============================================================
// 初始化Vue 3 API
// ============================================================
async function initVueApi() {
    const vue = await import('https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js');
    createApp = vue.createApp;
    reactive = vue.reactive;
    computed = vue.computed;
    onMounted = vue.onMounted;
    defineComponent = vue.defineComponent;
}
// ============================================================
// 初始化组件和状态
// ============================================================
function initComponents() {
    // 初始化全局状态
    appState = reactive({
        activeTab: 'freq',
        statusMessage: '加载中...',
        statusColor: '',
        dataLoaded: false,
        modules: {}
    });
    // Tab组件
    HamTabs = defineComponent({
        name: 'HamTabs',
        setup() {
            const tabs = [
                { id: 'freq', label: '频率查询', icon: '📡' },
                { id: 'rf', label: '射频工具', icon: '🔧' },
                { id: 'grid', label: '网格坐标', icon: '📍' },
                { id: 'log', label: '通联日志', icon: '📝' },
                { id: 'map', label: '地图', icon: '🗺' },
                { id: 'ref', label: '参考查询', icon: '📖' },
                { id: 'cw', label: 'CW练习', icon: '🎵' },
                { id: 'call', label: '呼号查询', icon: '🔍' },
                { id: 'utils', label: '工具', icon: '🛠' }
            ];
            function switchTab(tabId) {
                appState.activeTab = tabId;
                // 触发DOM兼容：同时管理.tab-content的active类
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === tabId);
                });
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.toggle('active', c.id === 'tab-' + tabId);
                });
                EventBus.emit('tab:switch', tabId);
            }
            return { tabs, activeTab: computed(() => appState.activeTab), switchTab };
        },
        template: `
      <div class="tab-bar">
        <button v-for="tab in tabs" :key="tab.id"
          class="tab-btn" :class="{ active: activeTab === tab.id }"
          :data-tab="tab.id" @click="switchTab(tab.id)">
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>
    `
    });
    // 状态栏组件
    StatusBar = defineComponent({
        name: 'StatusBar',
        setup() {
            const message = computed(() => appState.statusMessage);
            const color = computed(() => appState.statusColor);
            EventBus.on('status', (msg) => {
                appState.statusMessage = msg;
                appState.statusColor = '';
            });
            return { message, color };
        },
        template: `<div class="status-bar" id="statusBar" :style="{ color: color }">{{ message }}</div>`
    });
}
// ============================================================
// Vue应用创建与挂载
// ============================================================
export async function createHamApp() {
    // 加载Vue 3 API
    await initVueApi();
    // 初始化组件和状态
    initComponents();
    // 加载静态数据
    try {
        await initData();
        appState.dataLoaded = true;
        appState.statusMessage = 'HAM Radio Toolbox 就绪';
    }
    catch (e) {
        console.warn('[HAM] Data load failed, using fallback:', e);
        appState.statusMessage = '数据加载失败，使用内置数据';
    }
    const app = createApp({
        setup() {
            onMounted(() => {
                console.log('[HAM] Vue 3 app mounted');
            });
        }
    });
    // 注册全局组件
    app.component('HamTabs', HamTabs);
    app.component('StatusBar', StatusBar);
    // 全局属性
    app.config.globalProperties.$state = appState;
    app.config.globalProperties.$bus = EventBus;
    app.config.globalProperties.$toast = showToast;
    // 错误处理
    app.config.errorHandler = (err, vm, info) => {
        console.error('[HAM Vue Error]', err, info);
        showToast('Vue错误: ' + err.message, 'error');
    };
    return app;
}
// 导出状态供外部模块使用
export { appState, EventBus };
//# sourceMappingURL=vue-app.js.map