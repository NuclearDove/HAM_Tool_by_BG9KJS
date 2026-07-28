/**
 * Vue 3 ESM浏览器构建的类型声明
 * 用于CDN URL导入的类型支持
 */
declare module 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js' {
  export function createApp(options?: any): any;
  export function ref<T>(value: T): any;
  export function reactive<T extends object>(target: T): T;
  export function computed<T>(getter: () => T): any;
  export function onMounted(callback: () => void): void;
  export function onUnmounted(callback: () => void): void;
  export function defineComponent(options: any): any;
}