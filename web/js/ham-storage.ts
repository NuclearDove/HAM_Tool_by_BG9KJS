/**
 * HAM Radio Toolbox - localStorage存储监控模块
 * 显示存储使用情况、免责声明、各子项占用详情
 * 点击摘要区域弹出独立详情面板，点击外部关闭
 * @module ham-storage
 */
'use strict';

// 已知的localStorage键名与中文标签映射
const STORAGE_LABELS: Record<string, string> = {
    'ham_qso_log': '通联日志',
    'ham_custom_clocks': '自定义时钟',
    'ham_solar_history': '太阳通量历史',
    'ham_n2yo_api_key': 'N2YO API Key',
    'ham_sat_api_source': '卫星数据源',
    'ham_cw_key_settings': 'CW按键设置'
};

// 默认5MB上限（浏览器通常限制）
const STORAGE_LIMIT = 5 * 1024 * 1024;

interface StorageItem {
    key: string;
    label: string;
    size: number;
    percent: number;
}

interface StorageUsage {
    items: StorageItem[];
    total: number;
    limit: number;
    percent: number;
}

// 当前展开状态
let expanded = false;

/**
 * 计算localStorage各项占用
 */
function calcStorageUsage(): StorageUsage {
    let total = 0;
    const items: StorageItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
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
function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * 初始化存储监控UI
 */
export function init(): void {
    try {
        const header = document.querySelector('.header');
        if (!header) return;

        const storageWidget = document.createElement('div');
        storageWidget.id = 'storageWidget';
        storageWidget.innerHTML = buildWidgetHTML();
        header.appendChild(storageWidget);

        // 点击摘要区域切换面板
        const summary = storageWidget.querySelector('.storage-summary');
        if (summary) {
            summary.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                togglePanel();
            });
        }

        // 点击面板内部不关闭
        const panel = storageWidget.querySelector('.storage-panel');
        if (panel) {
            panel.addEventListener('click', (e: Event) => {
                e.stopPropagation();
            });
        }

        // 点击外部关闭面板（使用mousedown避免干扰Tab切换等click事件）
        document.addEventListener('mousedown', (e: Event) => {
            if (!expanded) return;
            const target = e.target as HTMLElement;
            // 如果点击在storageWidget内部，不关闭（由summary和panel的stopPropagation处理）
            if (storageWidget.contains(target)) return;
            closePanel();
        });

        // 每30秒刷新一次
        setInterval(refreshWidget, 30000);
    } catch (e) {
        console.error('[HAM Storage] init failed:', e);
    }
}

/**
 * 切换面板展开/收起
 */
function togglePanel(): void {
    expanded ? closePanel() : openPanel();
}

/**
 * 打开面板
 */
function openPanel(): void {
    expanded = true;
    const panel = document.querySelector('#storageWidget .storage-panel') as HTMLElement | null;
    const arrow = document.querySelector('#storageWidget .storage-arrow') as HTMLElement | null;
    if (panel) panel.classList.add('storage-panel-open');
    if (arrow) { arrow.textContent = '▼'; arrow.title = '收起详情'; }
}

/**
 * 关闭面板
 */
function closePanel(): void {
    expanded = false;
    const panel = document.querySelector('#storageWidget .storage-panel') as HTMLElement | null;
    const arrow = document.querySelector('#storageWidget .storage-arrow') as HTMLElement | null;
    if (panel) panel.classList.remove('storage-panel-open');
    if (arrow) { arrow.textContent = '▶'; arrow.title = '展开详情'; }
}

/**
 * 构建存储指示器HTML
 */
function buildWidgetHTML(): string {
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
      <div class="storage-panel-header">存储详情</div>`;

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

    html += `</div>`;
    return html;
}

/**
 * 刷新存储指示器
 */
function refreshWidget(): void {
    const widget = document.getElementById('storageWidget');
    if (!widget) return;
    const wasExpanded = expanded;
    widget.innerHTML = buildWidgetHTML();
    // 恢复展开状态
    if (wasExpanded) {
        const panel = widget.querySelector('.storage-panel') as HTMLElement | null;
        const arrow = widget.querySelector('.storage-arrow') as HTMLElement | null;
        if (panel) panel.classList.add('storage-panel-open');
        if (arrow) { arrow.textContent = '▼'; arrow.title = '收起详情'; }
    }
    // 重新绑定事件
    const summary = widget.querySelector('.storage-summary');
    if (summary) {
        summary.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            togglePanel();
        });
    }
    const panel = widget.querySelector('.storage-panel');
    if (panel) {
        panel.addEventListener('click', (e: Event) => {
            e.stopPropagation();
        });
    }
}

/**
 * HTML转义
 */
function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}