/**
 * HAM Radio Toolbox - localStorage存储监控模块
 * 显示存储使用情况、免责声明、各子项占用详情
 * 点击摘要区域弹出独立详情面板，点击外部关闭
 * @module ham-storage
 */
'use strict';
// 已知的localStorage键名与中文标签映射
const STORAGE_LABELS = {
    'ham_qso_log': '通联日志',
    'ham_custom_clocks': '自定义时钟',
    'ham_solar_history': '太阳通量历史',
    'ham_n2yo_api_key': 'N2YO API Key',
    'ham_sat_api_source': '卫星数据源',
    'ham_cw_key_settings': 'CW按键设置',
    'ham_tle_cache': 'TLE卫星数据缓存'
};
// 默认5MB上限（浏览器通常限制）
const STORAGE_LIMIT = 5 * 1024 * 1024;
// 清理时保留的键（API Key和用户偏好不清除）
const PROTECTED_KEYS = ['ham_n2yo_api_key', 'ham_sat_api_source'];
// 当前展开状态
let expanded = false;
/**
 * 计算localStorage各项占用
 */
function calcStorageUsage() {
    let total = 0;
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key)
            continue;
        const value = localStorage.getItem(key) || '';
        // 计算UTF-16编码字节数（每个字符2字节）
        const size = (key.length + value.length) * 2;
        total += size;
        items.push({
            key: key,
            label: STORAGE_LABELS[key] || key,
            size: size,
            percent: 0
        });
    }
    // 按大小降序排列
    items.sort((a, b) => b.size - a.size);
    // 计算百分比
    items.forEach(item => {
        item.percent = total > 0 ? (item.size / total * 100) : 0;
    });
    return {
        items: items,
        total: total,
        limit: STORAGE_LIMIT,
        percent: (total / STORAGE_LIMIT * 100)
    };
}
/**
 * 格式化字节数为可读字符串
 */
function formatBytes(bytes) {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
/**
 * 初始化存储监控UI
 */
export function init() {
    try {
        // 防止重复初始化（Tab切换可能多次调用init）
        if (document.getElementById('storageWidget'))
            return;
        const header = document.querySelector('.header');
        if (!header)
            return;
        const storageWidget = document.createElement('div');
        storageWidget.id = 'storageWidget';
        storageWidget.innerHTML = buildWidgetHTML();
        header.appendChild(storageWidget);
        // 点击摘要区域切换面板
        const summary = storageWidget.querySelector('.storage-summary');
        if (summary) {
            summary.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel();
            });
        }
        // 点击面板内部不关闭
        const panel = storageWidget.querySelector('.storage-panel');
        if (panel) {
            panel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        // 刷新按钮
        const refreshBtn = storageWidget.querySelector('.storage-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                refreshWidget();
            });
        }
        // 清除缓存按钮
        const clearBtn = storageWidget.querySelector('.storage-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmDialog();
            });
        }
        // 确认弹窗按钮
        const cancelBtn = storageWidget.querySelector('.storage-confirm-cancel');
        const okBtn = storageWidget.querySelector('.storage-confirm-ok');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hideConfirmDialog();
            });
        }
        if (okBtn) {
            okBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearCache();
                hideConfirmDialog();
                refreshWidget();
            });
        }
        // 点击外部关闭面板（使用mousedown避免干扰Tab切换等click事件）
        document.addEventListener('mousedown', (e) => {
            if (!expanded)
                return;
            const target = e.target;
            // 如果点击在storageWidget内部，不关闭（由summary和panel的stopPropagation处理）
            if (storageWidget.contains(target))
                return;
            closePanel();
        });
        // 每30秒刷新一次
        setInterval(refreshWidget, 30000);
    }
    catch (e) {
        console.error('[HAM Storage] init failed:', e);
    }
}
/**
 * 切换面板展开/收起
 */
function togglePanel() {
    expanded ? closePanel() : openPanel();
}
/**
 * 打开面板
 */
function openPanel() {
    expanded = true;
    const panel = document.querySelector('#storageWidget .storage-panel');
    const arrow = document.querySelector('#storageWidget .storage-arrow');
    if (panel)
        panel.classList.add('storage-panel-open');
    if (arrow) {
        arrow.textContent = '▼';
        arrow.title = '收起详情';
    }
}
/**
 * 关闭面板
 */
function closePanel() {
    expanded = false;
    const panel = document.querySelector('#storageWidget .storage-panel');
    const arrow = document.querySelector('#storageWidget .storage-arrow');
    if (panel)
        panel.classList.remove('storage-panel-open');
    if (arrow) {
        arrow.textContent = '▶';
        arrow.title = '展开详情';
    }
}
/**
 * 构建存储指示器HTML
 */
function buildWidgetHTML() {
    const usage = calcStorageUsage();
    const colorClass = usage.percent > 80 ? 'storage-danger' : usage.percent > 50 ? 'storage-warning' : 'storage-ok';
    let html = `
    <div class="storage-summary" title="点击查看存储详情" tabindex="0" role="button" aria-expanded="false">
      <span class="storage-arrow" title="展开详情">▶</span>
      <span class="storage-icon">💾</span>
      <span class="storage-text">${formatBytes(usage.total)} / ${formatBytes(usage.limit)}</span>
      <span class="storage-bar-wrap">
        <span class="storage-bar ${colorClass}" style="width:${Math.min(usage.percent, 100)}%"></span>
      </span>
      <span class="storage-pct">${usage.percent.toFixed(1)}%</span>
    </div>
    <div class="storage-panel">
      <div class="storage-panel-header">
        <span>存储详情</span>
        <span class="storage-header-actions">
          <span class="storage-refresh" title="刷新">🔄</span>
        </span>
      </div>`;
    // 各子项占用
    if (usage.items.length > 0) {
        html += `<div class="storage-items">`;
        usage.items.forEach(item => {
            const barColor = item.percent > 50 ? '#e65100' : item.percent > 25 ? '#f9a825' : '#4caf50';
            html += `
        <div class="storage-item">
          <span class="storage-item-label">${escapeHtml(item.label)}</span>
          <span class="storage-item-bar-wrap">
            <span class="storage-item-bar" style="width:${item.percent}%;background:${barColor}"></span>
          </span>
          <span class="storage-item-size">${formatBytes(item.size)}</span>
        </div>`;
        });
        html += `</div>`;
    }
    // 清除按钮栏
    html += `
      <div class="storage-clear-bar">
        <button class="storage-clear-btn" title="清除缓存数据（保留API Key和设置）">清除缓存</button>
      </div>
      <!-- 确认弹窗（默认隐藏） -->
      <div class="storage-confirm-overlay" style="display:none">
        <div class="storage-confirm-dialog">
          <div class="storage-confirm-title">确认清除缓存？</div>
          <div class="storage-confirm-msg">将清除通联日志、太阳通量历史、TLE缓存等数据。<br>API Key和数据源设置将保留。</div>
          <div class="storage-confirm-actions">
            <button class="storage-confirm-cancel">取消</button>
            <button class="storage-confirm-ok">确认清除</button>
          </div>
        </div>
      </div>
    </div>`;
    return html;
}
/**
 * 刷新存储指示器
 */
function refreshWidget() {
    const widget = document.getElementById('storageWidget');
    if (!widget)
        return;
    const wasExpanded = expanded;
    widget.innerHTML = buildWidgetHTML();
    // 恢复展开状态
    if (wasExpanded) {
        const panel = widget.querySelector('.storage-panel');
        const arrow = widget.querySelector('.storage-arrow');
        if (panel)
            panel.classList.add('storage-panel-open');
        if (arrow) {
            arrow.textContent = '▼';
            arrow.title = '收起详情';
        }
    }
    // 重新绑定事件
    const summary = widget.querySelector('.storage-summary');
    if (summary) {
        summary.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });
    }
    const panel = widget.querySelector('.storage-panel');
    if (panel) {
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    // 刷新按钮
    const refreshBtn = widget.querySelector('.storage-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshWidget();
        });
    }
    // 清除缓存按钮
    const clearBtn = widget.querySelector('.storage-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmDialog();
        });
    }
    // 确认弹窗按钮
    const cancelBtn = widget.querySelector('.storage-confirm-cancel');
    const okBtn = widget.querySelector('.storage-confirm-ok');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideConfirmDialog();
        });
    }
    if (okBtn) {
        okBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearCache();
            hideConfirmDialog();
            refreshWidget();
        });
    }
}
/**
 * HTML转义
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
/**
 * 显示确认清除弹窗
 */
function showConfirmDialog() {
    const overlay = document.querySelector('#storageWidget .storage-confirm-overlay');
    if (overlay)
        overlay.style.display = 'flex';
}
/**
 * 隐藏确认清除弹窗
 */
function hideConfirmDialog() {
    const overlay = document.querySelector('#storageWidget .storage-confirm-overlay');
    if (overlay)
        overlay.style.display = 'none';
}
/**
 * 清除缓存数据（保留API Key和用户偏好设置）
 */
function clearCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !PROTECTED_KEYS.includes(key)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
        }
        catch (_e) { /* 忽略删除错误 */ }
    });
    console.log('[HAM Storage] 已清除', keysToRemove.length, '项缓存数据');
}