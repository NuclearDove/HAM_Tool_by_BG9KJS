import type { ToastType } from './types.js';
/**
 * 显示Toast通知
 * @param message - 通知内容
 * @param type - 类型: 'info'|'success'|'warning'|'error'
 * @param duration - 显示时长(ms)
 */
declare function showToast(message: string, type?: ToastType, duration?: number): void;
export { showToast };
