/**
 * HAM Radio Toolbox - Toast通知系统
 * 替代alert()，提供非阻塞的用户反馈
 * @module ham-toast
 */
'use strict';
let toastContainer = null;
/**
 * 确保Toast容器存在
 */
function ensureContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}
/**
 * 显示Toast通知
 * @param message - 通知内容
 * @param type - 类型: 'info'|'success'|'warning'|'error'
 * @param duration - 显示时长(ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    const colors = {
        info: '#1a237e',
        success: '#2e7d32',
        warning: '#e65100',
        error: '#c62828'
    };
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    toast.style.cssText = `
    background:${colors[type] || colors.info};
    color:#fff;
    padding:10px 16px;
    border-radius:6px;
    font-size:13px;
    box-shadow:0 4px 12px rgba(0,0,0,.2);
    pointer-events:auto;
    opacity:0;
    transform:translateX(100%);
    transition:all 0.3s ease;
    max-width:360px;
    word-break:break-word;
    display:flex;
    align-items:center;
    gap:8px;
  `;
    toast.textContent = (icons[type] || '') + ' ' + message;
    container.appendChild(toast);
    // 动画进入
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });
    // 自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
export { showToast };
//# sourceMappingURL=ham-toast.js.map