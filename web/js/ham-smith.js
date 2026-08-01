/**
 * HAM Radio Toolbox - Smith圆图模块
 * 交互式Smith圆图：归一化阻抗/导纳、等电阻圆、等电抗圆、点击定位
 * @module ham-smith
 */
'use strict';
// ============================================================
// 常量
// ============================================================
const SMITH_SIZE = 480; // Canvas逻辑尺寸
const SMITH_R = 220; // Smith圆图半径(px)
const SMITH_CX = 240; // 圆心X
const SMITH_CY = 240; // 圆心Y
const R_CIRCLES = [0, 0.2, 0.5, 1, 2, 5]; // 归一化电阻圆
const X_CIRCLES = [0, 0.2, 0.5, 1, 2, 5]; // 归一化电抗圆
// 当前标记点
let markerZ = null; // { r: normalizedR, x: normalizedX }
let z0 = 50; // 特性阻抗
// Canvas引用
let canvas = null;
let ctx = null;
// ============================================================
// 坐标变换
// ============================================================
/**
 * 归一化阻抗 z = r + jx → Smith圆图Canvas坐标
 * Smith圆图: Γ = (z-1)/(z+1)
 */
function zToGamma(r, x) {
    const denom = (r + 1) * (r + 1) + x * x;
    if (denom < 1e-12)
        return { re: -1, im: 0 };
    const gr = (r * r + x * x - 1) / denom;
    const gi = 2 * x / denom;
    return { re: gr, im: gi };
}
/**
 * Γ → Canvas像素坐标
 */
function gammaToPixel(gr, gi) {
    return {
        px: SMITH_CX + gr * SMITH_R,
        py: SMITH_CY - gi * SMITH_R
    };
}
/**
 * Canvas像素 → Γ
 */
function pixelToGamma(px, py) {
    return {
        re: (px - SMITH_CX) / SMITH_R,
        im: -(py - SMITH_CY) / SMITH_R
    };
}
/**
 * Γ → 归一化阻抗 z
 */
function gammaToZ(gr, gi) {
    const d = (1 - gr) * (1 - gr) + gi * gi;
    if (d < 1e-12)
        return { r: Infinity, x: 0 };
    const r = (1 - gr * gr - gi * gi) / d;
    const x = 2 * gi / d;
    return { r, x };
}
// ============================================================
// 绘图
// ============================================================
function drawSmithChart() {
    if (!ctx)
        return;
    const c = ctx;
    const dpr = window.devicePixelRatio || 1;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, SMITH_SIZE, SMITH_SIZE);
    // 背景
    c.fillStyle = '#fff';
    c.fillRect(0, 0, SMITH_SIZE, SMITH_SIZE);
    // 外圆（|Γ|=1）
    c.beginPath();
    c.arc(SMITH_CX, SMITH_CY, SMITH_R, 0, 2 * Math.PI);
    c.strokeStyle = '#333';
    c.lineWidth = 2;
    c.stroke();
    // 等电阻圆
    c.strokeStyle = '#1a237e';
    c.lineWidth = 0.8;
    R_CIRCLES.forEach(r => {
        if (r === 0)
            return; // r=0 是外圆，已画
        const gr = r / (r + 1);
        const cr = 1 / (r + 1);
        c.beginPath();
        c.arc(SMITH_CX + gr * SMITH_R, SMITH_CY, cr * SMITH_R, 0, 2 * Math.PI);
        c.stroke();
    });
    // 等电抗圆弧
    c.strokeStyle = '#c62828';
    c.lineWidth = 0.6;
    X_CIRCLES.forEach(x => {
        if (x === 0)
            return; // x=0 是实轴
        // 圆心在 (1, 1/x)，半径 1/|x| (归一化坐标)
        const cx_n = 1;
        const cy_n = 1 / x;
        const cr_n = 1 / Math.abs(x);
        // 只画在|Γ|≤1内的弧
        drawArcInUnitCircle(cx_n, cy_n, cr_n, x > 0);
    });
    // 实轴
    c.beginPath();
    c.moveTo(SMITH_CX - SMITH_R, SMITH_CY);
    c.lineTo(SMITH_CX + SMITH_R, SMITH_CY);
    c.strokeStyle = '#333';
    c.lineWidth = 1;
    c.stroke();
    // 刻度标注
    c.fillStyle = '#555';
    c.font = '10px Consolas, monospace';
    c.textAlign = 'center';
    R_CIRCLES.forEach(r => {
        if (r === 0)
            return;
        const gr = r / (r + 1);
        const px = SMITH_CX + gr * SMITH_R;
        c.fillText(r.toString(), px, SMITH_CY + 12);
    });
    // 电抗标注
    c.textAlign = 'left';
    X_CIRCLES.forEach(x => {
        if (x === 0)
            return;
        // 在外圆上标注
        const angle = x > 0 ? Math.atan2(1 / x, 1) : Math.atan2(1 / x, 1);
        const gx = Math.cos(angle);
        const gy = Math.sin(angle);
        const px = SMITH_CX + gx * (SMITH_R + 12);
        const py = SMITH_CY - gy * (SMITH_R + 12);
        c.fillText((x > 0 ? 'j' : '-j') + Math.abs(x), px, py + 3);
    });
    // 标记点
    if (markerZ) {
        const g = zToGamma(markerZ.r, markerZ.x);
        const p = gammaToPixel(g.re, g.im);
        // 十字标记
        c.beginPath();
        c.arc(p.px, p.py, 5, 0, 2 * Math.PI);
        c.fillStyle = '#c62828';
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 1.5;
        c.stroke();
        // 标注文本
        const zr = markerZ.r * z0;
        const zx = markerZ.x * z0;
        const label = zr.toFixed(1) + (zx >= 0 ? '+j' : '-j') + Math.abs(zx).toFixed(1) + ' Ω';
        c.fillStyle = '#c62828';
        c.font = 'bold 12px Consolas, monospace';
        c.textAlign = 'left';
        c.fillText(label, p.px + 8, p.py - 8);
        // Γ值
        const gLabel = 'Γ=' + g.re.toFixed(3) + (g.im >= 0 ? '+j' : '-j') + Math.abs(g.im).toFixed(3);
        c.font = '11px Consolas, monospace';
        c.fillText(gLabel, p.px + 8, p.py + 6);
        // SWR
        const swr = calcSWR(g.re, g.im);
        c.fillText('SWR=' + swr.toFixed(2) + ':1', p.px + 8, p.py + 20);
        // 回波损耗
        const rl = -20 * Math.log10(Math.sqrt(g.re * g.re + g.im * g.im) + 1e-12);
        c.fillText('RL=' + rl.toFixed(1) + ' dB', p.px + 8, p.py + 34);
    }
    c.restore();
}
/**
 * 在|Γ|≤1区域内绘制圆弧
 */
function drawArcInUnitCircle(cx_n, cy_n, cr_n, isPositive) {
    if (!ctx)
        return;
    // 计算单位圆与该圆的交点
    const dist = Math.sqrt(cx_n * cx_n + cy_n * cy_n);
    if (dist > cr_n + 1 + 0.001)
        return; // 不相交
    // 交点角度
    const d = (cr_n * cr_n - dist * dist + 1) / (2 * cr_n);
    const h = Math.sqrt(Math.max(0, cr_n * cr_n - d * d));
    const px1 = cx_n + d * (-cx_n / dist) + h * (cy_n / dist);
    const py1 = cy_n + d * (-cy_n / dist) - h * (-cx_n / dist);
    const px2 = cx_n + d * (-cx_n / dist) - h * (cy_n / dist);
    const py2 = cy_n + d * (-cy_n / dist) + h * (-cx_n / dist);
    // Canvas坐标
    const cp_x = SMITH_CX + cx_n * SMITH_R;
    const cp_y = SMITH_CY - cy_n * SMITH_R;
    const cr_px = cr_n * SMITH_R;
    const startAngle = Math.atan2(-(py1 - cy_n), px1 - cx_n);
    const endAngle = Math.atan2(-(py2 - cy_n), px2 - cx_n);
    ctx.beginPath();
    if (isPositive) {
        ctx.arc(cp_x, cp_y, cr_px, startAngle, endAngle, false);
    }
    else {
        ctx.arc(cp_x, cp_y, cr_px, endAngle, startAngle, false);
    }
    ctx.stroke();
}
/**
 * 计算SWR
 */
function calcSWR(gr, gi) {
    const mag = Math.sqrt(gr * gr + gi * gi);
    if (mag >= 1)
        return Infinity;
    return (1 + mag) / (1 - mag);
}
// ============================================================
// 交互
// ============================================================
function onCanvasClick(e) {
    if (!canvas)
        return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SMITH_SIZE / rect.width;
    const scaleY = SMITH_SIZE / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const g = pixelToGamma(px, py);
    const mag = Math.sqrt(g.re * g.re + g.im * g.im);
    if (mag > 1.0)
        return; // 圆外忽略
    const z = gammaToZ(g.re, g.im);
    markerZ = { r: Math.max(0, z.r), x: z.x };
    drawSmithChart();
    updateInputFields();
}
function onCanvasMouseMove(_e) {
    // 可选：hover预览
}
// ============================================================
// 输入处理
// ============================================================
function smithCalc() {
    const rVal = parseFloat(document.getElementById('smithR').value);
    const xVal = parseFloat(document.getElementById('smithX').value);
    const z0Val = parseFloat(document.getElementById('smithZ0').value);
    if (isNaN(rVal) || rVal < 0) {
        showResult('请输入有效的电阻值 (≥0)');
        return;
    }
    if (isNaN(xVal)) {
        showResult('请输入有效的电抗值');
        return;
    }
    z0 = (isNaN(z0Val) || z0Val <= 0) ? 50 : z0Val;
    markerZ = { r: rVal / z0, x: xVal / z0 };
    drawSmithChart();
    updateResultText();
}
function smithClear() {
    markerZ = null;
    document.getElementById('smithR').value = '';
    document.getElementById('smithX').value = '';
    document.getElementById('smithZ0').value = '50';
    document.getElementById('smithResult').textContent = '';
    drawSmithChart();
}
function updateInputFields() {
    if (!markerZ)
        return;
    document.getElementById('smithR').value = (markerZ.r * z0).toFixed(2);
    document.getElementById('smithX').value = (markerZ.x * z0).toFixed(2);
    document.getElementById('smithZ0').value = String(z0);
    updateResultText();
}
function updateResultText() {
    if (!markerZ)
        return;
    const g = zToGamma(markerZ.r, markerZ.x);
    const mag = Math.sqrt(g.re * g.re + g.im * g.im);
    const swr = calcSWR(g.re, g.im);
    const rl = -20 * Math.log10(mag + 1e-12);
    const phase = Math.atan2(g.im, g.re) * 180 / Math.PI;
    let txt = '';
    txt += '归一化阻抗: z = ' + markerZ.r.toFixed(3) + (markerZ.x >= 0 ? '+j' : '-j') + Math.abs(markerZ.x).toFixed(3) + '\n';
    txt += '实际阻抗: Z = ' + (markerZ.r * z0).toFixed(1) + (markerZ.x >= 0 ? '+j' : '-j') + Math.abs(markerZ.x * z0).toFixed(1) + ' Ω\n';
    txt += '反射系数: Γ = ' + mag.toFixed(4) + '∠' + phase.toFixed(1) + '°\n';
    txt += '  Γ = ' + g.re.toFixed(4) + (g.im >= 0 ? '+j' : '-j') + Math.abs(g.im).toFixed(4) + '\n';
    txt += 'SWR: ' + (isFinite(swr) ? swr.toFixed(2) : '∞') + ':1\n';
    txt += '回波损耗: ' + rl.toFixed(1) + ' dB\n';
    txt += '匹配效率: ' + ((1 - mag * mag) * 100).toFixed(1) + '%';
    showResult(txt);
}
function showResult(txt) {
    const el = document.getElementById('smithResult');
    if (el)
        el.textContent = txt;
}
// ============================================================
// 初始化
// ============================================================
function init() {
    canvas = document.getElementById('smithCanvas');
    if (!canvas)
        return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SMITH_SIZE * dpr;
    canvas.height = SMITH_SIZE * dpr;
    canvas.style.width = SMITH_SIZE + 'px';
    canvas.style.height = SMITH_SIZE + 'px';
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    drawSmithChart();
    console.log('[HAM] Smith Chart initialized');
}
// ============================================================
// 导出
// ============================================================
export { init, smithCalc, smithClear };