/**
 * HAM Radio Toolbox - CW练习 Tab 模块 (ES Module)
 * 包含摩尔斯码编解码、音频播放、模拟电键(含键盘快捷键)、随机练习
 * @module ham-cw
 */
'use strict';
import { MORSE_CODE, morseEncode, morseDecode } from './core.js';
import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';
// 音频状态
let audioCtx = null;
let cwPlayTimeout = null;
/**
 * 获取AudioContext（懒加载+自动恢复）
 * 现代浏览器要求用户交互后才能播放音频
 */
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // 处理浏览器自动暂停策略
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}
/**
 * 预创建AudioContext（在用户首次交互时调用）
 * 避免首次播放时的延迟
 */
function preCreateAudioCtx() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            // 立即suspend，等待用户交互时resume
            if (audioCtx.state === 'suspended') {
                // 注册一次性交互监听器来解锁
                const unlock = () => {
                    if (audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('keydown', unlock);
                };
                document.addEventListener('click', unlock);
                document.addEventListener('keydown', unlock);
            }
        }
        catch (e) {
            console.warn('[HAM] AudioContext not available:', e);
        }
    }
}
function cwPlayTone(startTime, duration) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.5, startTime + 0.005);
    gain.gain.setValueAtTime(0.5, startTime + duration - 0.005);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}
function cwPlayMorse(morseStr, wpm, callback) {
    cwStopPlay();
    const ctx = getAudioCtx();
    const dotDur = 1.2 / wpm;
    const dashDur = dotDur * 3;
    const symGap = dotDur;
    const charGap = dotDur * 3;
    const wordGap = dotDur * 7;
    let t = ctx.currentTime + 0.1;
    const chars = morseStr.split(' ');
    chars.forEach(c => {
        if (c === '/') {
            t += wordGap;
            return;
        }
        for (let i = 0; i < c.length; i++) {
            const ch = c[i];
            if (ch === '·' || ch === '.') {
                cwPlayTone(t, dotDur);
                t += dotDur;
            }
            else if (ch === '-' || ch === '–') {
                cwPlayTone(t, dashDur);
                t += dashDur;
            }
            if (i < c.length - 1)
                t += symGap;
        }
        t += charGap;
    });
    const totalMs = (t - ctx.currentTime) * 1000;
    cwPlayTimeout = setTimeout(() => { if (callback)
        callback(); }, totalMs);
}
/**
 * 停止播放并清理音频上下文
 */
function cwStopPlay() {
    if (cwPlayTimeout) {
        clearTimeout(cwPlayTimeout);
        cwPlayTimeout = null;
    }
    try {
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
    }
    catch (_e) { /* ignore */ }
}
function cwEncode() {
    const text = document.getElementById('cwEncodeIn').value;
    if (!text) {
        document.getElementById('cwEncodeOut').textContent = '';
        return;
    }
    document.getElementById('cwEncodeOut').textContent = morseEncode(text);
    EventBus.emit('status', '摩尔斯编码完成');
}
function cwPlayEncode() {
    let morse = document.getElementById('cwEncodeOut').textContent || '';
    if (!morse) {
        cwEncode();
        morse = document.getElementById('cwEncodeOut').textContent || '';
    }
    if (!morse)
        return;
    const wpm = parseInt(document.getElementById('cwWpm').value);
    cwPlayMorse(morse, wpm);
    EventBus.emit('status', '播放中...');
}
function cwDecode() {
    const morse = document.getElementById('cwDecodeIn').value;
    if (!morse) {
        document.getElementById('cwDecodeOut').textContent = '';
        return;
    }
    document.getElementById('cwDecodeOut').textContent = morseDecode(morse);
    EventBus.emit('status', '摩尔斯解码完成');
}
// 电键设置存储
const CW_KEY_SETTINGS_KEY = 'ham_cw_key_settings';
function saveCwKeySettings() {
    const dashThresh = parseInt(document.getElementById('cwDashThresh')?.value) || 120;
    const spaceThresh = parseInt(document.getElementById('cwSpaceThresh')?.value) || 240;
    localStorage.setItem(CW_KEY_SETTINGS_KEY, JSON.stringify({ dashThresh, spaceThresh }));
    const hint = document.getElementById('cwKeySettingsHint');
    if (hint) {
        hint.textContent = '已保存';
        setTimeout(() => { hint.textContent = ''; }, 1500);
    }
}
function loadCwKeySettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(CW_KEY_SETTINGS_KEY) || 'null');
        if (saved && typeof saved === 'object' && typeof saved.dashThresh === 'number' && typeof saved.spaceThresh === 'number') {
            document.getElementById('cwDashThresh').value = String(saved.dashThresh);
            document.getElementById('cwSpaceThresh').value = String(saved.spaceThresh);
        }
    }
    catch (_e) { /* ignore */ }
}
// 模拟电键状态
let keyDownTime = 0;
let keyTimer = null;
/**
 * 处理电键按下
 */
function handleKeyDown() {
    if (keyTimer)
        clearTimeout(keyTimer);
    keyDownTime = Date.now();
    const btn = document.getElementById('cwKeyBtn');
    if (btn)
        btn.classList.add('pressed');
}
/**
 * 处理电键释放
 */
function handleKeyUp() {
    const btn = document.getElementById('cwKeyBtn');
    if (btn)
        btn.classList.remove('pressed');
    const dur = Date.now() - keyDownTime;
    const dashThresh = parseInt(document.getElementById('cwDashThresh')?.value) || 120;
    const spaceThresh = parseInt(document.getElementById('cwSpaceThresh')?.value) || 240;
    const sym = dur < dashThresh ? '·' : '-';
    document.getElementById('cwDecodeIn').value += sym;
    if (keyTimer)
        clearTimeout(keyTimer);
    keyTimer = setTimeout(() => { document.getElementById('cwDecodeIn').value += ' '; }, spaceThresh);
}
function initCwKey() {
    loadCwKeySettings();
    const cwKeyBtn = document.getElementById('cwKeyBtn');
    if (!cwKeyBtn)
        return;
    // 鼠标事件
    cwKeyBtn.addEventListener('mousedown', (e) => { e.preventDefault(); handleKeyDown(); });
    cwKeyBtn.addEventListener('mouseup', (e) => { e.preventDefault(); handleKeyUp(); });
    // 触屏事件
    cwKeyBtn.addEventListener('touchstart', (e) => { e.preventDefault(); handleKeyDown(); });
    cwKeyBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleKeyUp(); });
    // 键盘快捷键：空格键模拟电键（仅在CW解码Tab激活时）
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            // 检查焦点是否在输入框/文本域中，如果是则不拦截
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
                return;
            // 检查CW解码子Tab是否可见
            const decodeTab = document.getElementById('cw-cw-decode');
            if (decodeTab && decodeTab.classList.contains('active')) {
                e.preventDefault();
                handleKeyDown();
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
                return;
            const decodeTab = document.getElementById('cw-cw-decode');
            if (decodeTab && decodeTab.classList.contains('active')) {
                e.preventDefault();
                handleKeyUp();
            }
        }
    });
}
// CW 随机练习
let practiceAnswer = '';
let practiceCurrentGroup = 0;
function cwPracticeStart() {
    const alpha = document.getElementById('cwPracAlpha').checked;
    const num = document.getElementById('cwPracNum').checked;
    const punct = document.getElementById('cwPracPunct').checked;
    if (!alpha && !num && !punct) {
        showToast('请至少选择一种字符集。', 'warning');
        return;
    }
    let chars = '';
    if (alpha)
        chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num)
        chars += '0123456789';
    if (punct)
        chars += '.,?/()=+-:;';
    const len = parseInt(document.getElementById('cwPracLen').value);
    const count = parseInt(document.getElementById('cwPracCount').value);
    const groups = [];
    for (let i = 0; i < count; i++) {
        let g = '';
        for (let j = 0; j < len; j++)
            g += chars[Math.floor(Math.random() * chars.length)];
        groups.push(g);
    }
    practiceAnswer = groups.join(' ');
    practiceCurrentGroup = 0;
    const m = morseEncode(practiceAnswer);
    document.getElementById('cwPracDisp').textContent = m;
    document.getElementById('cwPracLog').textContent = '第 ' + (practiceCurrentGroup + 1) + '/' + count + ' 组，正在播放...';
    document.getElementById('cwPracUser').value = '';
    document.getElementById('cwPracScore').textContent = '';
    const wpm = parseInt(document.getElementById('cwWpm').value);
    cwPlayMorse(m, wpm, () => {
        document.getElementById('cwPracLog').textContent = '播放完毕，请输入抄收内容。';
    });
}
function cwPracticeReveal() {
    if (practiceAnswer)
        document.getElementById('cwPracLog').textContent = '答案: ' + practiceAnswer;
}
function cwPracticeCheck() {
    const user = document.getElementById('cwPracUser').value.toUpperCase().trim();
    const answer = practiceAnswer.toUpperCase();
    if (!user || !answer)
        return;
    let correct = 0;
    const total = answer.replace(/\s/g, '').length;
    const uArr = user.replace(/\s/g, '').split('');
    const aArr = answer.replace(/\s/g, '').split('');
    for (let i = 0; i < Math.min(uArr.length, aArr.length); i++) {
        if (uArr[i] === aArr[i])
            correct++;
    }
    const pct = total > 0 ? (correct / total * 100).toFixed(1) : '0';
    document.getElementById('cwPracScore').textContent = '正确率: ' + correct + '/' + total + ' = ' + pct + '%';
    EventBus.emit('status', '练习评分完成');
}

// ==================== Koch方法训练 ====================
/**
 * Koch方法课程顺序（40级，从2个字符开始逐步增加）
 * 标准Koch顺序: K M R S U A P T L O W I N J E F 0 Y V G 5 / Q 9 Z H 3 8 D B 6 2 7 4 1 + - = ?
 */
const KOCH_ORDER = 'KMR SUA PTLO WINJ EF0 YVG5 /Q9 ZH3 8DB6 274 1+- =?';
const KOCH_LEVELS = KOCH_ORDER.replace(/\s/g, '');
const KOCH_PASS_THRESHOLD = 90; // 正确率阈值(%)
const KOCH_PASS_ROUNDS = 5;     // 连续达标轮数才升级
const KOCH_ROUND_CHARS = 5;     // 每轮字符数
const KOCH_ROUND_GROUPS = 3;    // 每轮组数

// Koch训练状态
let kochLevel = 1;
let kochPassCount = 0;
let kochTotalRounds = 0;
let kochAnswer = '';
let kochCustomChars = null; // null=使用Koch标准顺序
let kochAutoSpeed = false;  // 速度渐变
let kochPlaying = false;

/**
 * 获取当前级别的字符集
 * @param {number} level - Koch级别(1-based)
 * @returns {string} 当前级别包含的所有字符
 */
function kochGetChars(level) {
    if (kochCustomChars) {
        // 自定义字符集：按自定义字符数量分level
        const maxLevel = Math.ceil(kochCustomChars.length / 2);
        const clampedLevel = Math.min(level, maxLevel);
        const charCount = Math.min(clampedLevel + 1, kochCustomChars.length);
        return kochCustomChars.slice(0, charCount);
    }
    // 标准Koch：level 1 = 前2字符, level N = 前N+1字符
    const charCount = Math.min(level + 1, KOCH_LEVELS.length);
    return KOCH_LEVELS.slice(0, charCount);
}

/**
 * 获取最大级别数
 */
function kochGetMaxLevel() {
    if (kochCustomChars) {
        return Math.max(1, Math.ceil(kochCustomChars.length / 2));
    }
    return KOCH_LEVELS.length - 1;
}

/**
 * 更新Koch训练UI显示
 */
function kochUpdateUI() {
    const levelEl = document.getElementById('kochLevel');
    const charsEl = document.getElementById('kochChars');
    const progressEl = document.getElementById('kochProgress');
    const maxLevelEl = document.getElementById('kochMaxLevel');
    if (levelEl) {
        levelEl.value = kochLevel;
    }
    if (maxLevelEl) {
        maxLevelEl.textContent = kochGetMaxLevel();
    }
    if (charsEl) {
        const chars = kochGetChars(kochLevel);
        charsEl.textContent = chars.split('').join(' ');
    }
    if (progressEl) {
        progressEl.textContent = '连续达标: ' + kochPassCount + '/' + KOCH_PASS_ROUNDS +
            ' | 总轮数: ' + kochTotalRounds;
    }
}

/**
 * 开始Koch训练（生成并播放一轮）
 */
function kochStart() {
    const levelInput = document.getElementById('kochLevel');
    if (levelInput) {
        kochLevel = Math.max(1, Math.min(parseInt(levelInput.value) || 1, kochGetMaxLevel()));
    }
    kochPassCount = 0;
    kochTotalRounds = 0;
    kochUpdateUI();
    kochNextRound();
}

/**
 * 生成并播放下一轮Koch练习
 */
function kochNextRound() {
    if (kochPlaying) {
        cwStopPlay();
        kochPlaying = false;
    }
    const chars = kochGetChars(kochLevel);
    if (chars.length < 2) {
        showToast('字符集不足，至少需要2个字符', 'warn');
        return;
    }
    // 生成随机字符组
    const groups = [];
    for (let i = 0; i < KOCH_ROUND_GROUPS; i++) {
        let g = '';
        for (let j = 0; j < KOCH_ROUND_CHARS; j++) {
            g += chars[Math.floor(Math.random() * chars.length)];
        }
        groups.push(g);
    }
    kochAnswer = groups.join(' ');
    kochTotalRounds++;
    const morseStr = morseEncode(kochAnswer);
    // 速度渐变：根据正确率调整WPM
    const autoSpeedCb = document.getElementById('kochAutoSpeed');
    kochAutoSpeed = autoSpeedCb ? autoSpeedCb.checked : false;
    let wpm = parseInt(document.getElementById('cwWpm').value) || 20;
    if (kochAutoSpeed && kochTotalRounds > 1) {
        // 基础WPM - 级别越低速度越慢
        const baseWpm = Math.max(10, wpm - (kochGetMaxLevel() - kochLevel));
        wpm = Math.max(10, baseWpm);
    }
    const logEl = document.getElementById('kochLog');
    if (logEl) {
        logEl.textContent = '第 ' + kochTotalRounds + ' 轮，正在播放... (级别 ' + kochLevel + ')';
    }
    const dispEl = document.getElementById('kochDisp');
    if (dispEl) {
        dispEl.textContent = morseStr;
    }
    const userEl = document.getElementById('kochUser');
    if (userEl) {
        userEl.value = '';
    }
    const scoreEl = document.getElementById('kochScore');
    if (scoreEl) {
        scoreEl.textContent = '';
    }
    kochPlaying = true;
    cwPlayMorse(morseStr, wpm, () => {
        kochPlaying = false;
        if (logEl) {
            logEl.textContent = '第 ' + kochTotalRounds + ' 轮播放完毕，请输入抄收内容。';
        }
    });
}

/**
 * 检查Koch训练答案
 */
function kochCheck() {
    const userEl = document.getElementById('kochUser');
    const user = userEl ? userEl.value.toUpperCase().trim() : '';
    const answer = kochAnswer.toUpperCase();
    if (!user || !answer) {
        return;
    }
    let correct = 0;
    const total = answer.replace(/\s/g, '').length;
    const uArr = user.replace(/\s/g, '').split('');
    const aArr = answer.replace(/\s/g, '').split('');
    for (let i = 0; i < Math.min(uArr.length, aArr.length); i++) {
        if (uArr[i] === aArr[i]) {
            correct++;
        }
    }
    const pct = total > 0 ? (correct / total * 100) : 0;
    const pctStr = pct.toFixed(1);
    const scoreEl = document.getElementById('kochScore');
    const logEl = document.getElementById('kochLog');
    if (scoreEl) {
        const color = pct >= KOCH_PASS_THRESHOLD ? '#2e7d32' : '#c62828';
        scoreEl.textContent = '正确率: ' + correct + '/' + total + ' = ' + pctStr + '%';
        scoreEl.style.color = color;
    }
    // 判断是否达标
    if (pct >= KOCH_PASS_THRESHOLD) {
        kochPassCount++;
        if (kochPassCount >= KOCH_PASS_ROUNDS) {
            // 升级！
            const maxLevel = kochGetMaxLevel();
            if (kochLevel < maxLevel) {
                kochLevel++;
                kochPassCount = 0;
                if (logEl) {
                    logEl.textContent = '恭喜升级！当前级别: ' + kochLevel + '，新字符: ' +
                        kochGetChars(kochLevel).split('').join(' ');
                }
                showToast('Koch升级！级别 ' + kochLevel, 'success');
            } else {
                if (logEl) {
                    logEl.textContent = '已达到最高级别！全部字符训练完成！';
                }
                showToast('Koch训练全部完成！', 'success');
            }
        } else {
            if (logEl) {
                logEl.textContent = '达标！连续 ' + kochPassCount + '/' + KOCH_PASS_ROUNDS +
                    ' 轮 (' + pctStr + '%)';
            }
        }
    } else {
        kochPassCount = 0;
        if (logEl) {
            logEl.textContent = '未达标 (' + pctStr + '%)，需 ' + KOCH_PASS_THRESHOLD +
                '% 以上。继续练习当前级别。';
        }
    }
    kochUpdateUI();
    EventBus.emit('status', 'Koch训练评分完成');
}

/**
 * 显示Koch当前答案
 */
function kochReveal() {
    if (kochAnswer) {
        const logEl = document.getElementById('kochLog');
        if (logEl) {
            logEl.textContent = '答案: ' + kochAnswer;
        }
    }
}

/**
 * 跳到下一级
 */
function kochSkipLevel() {
    const maxLevel = kochGetMaxLevel();
    if (kochLevel < maxLevel) {
        kochLevel++;
        kochPassCount = 0;
        kochUpdateUI();
        showToast('跳至级别 ' + kochLevel, 'info');
    } else {
        showToast('已是最高级别', 'warn');
    }
}

/**
 * 重置Koch训练到级别1
 */
function kochReset() {
    kochLevel = 1;
    kochPassCount = 0;
    kochTotalRounds = 0;
    kochAnswer = '';
    kochUpdateUI();
    const logEl = document.getElementById('kochLog');
    if (logEl) {
        logEl.textContent = '已重置到级别1，点击"开始训练"重新开始。';
    }
    const scoreEl = document.getElementById('kochScore');
    if (scoreEl) {
        scoreEl.textContent = '';
    }
    showToast('Koch训练已重置', 'info');
}

/**
 * 设置自定义字符集
 */
function kochSetCustom() {
    const input = document.getElementById('kochCustomInput');
    if (!input) {
        return;
    }
    const raw = input.value.toUpperCase().trim();
    if (!raw) {
        // 清空自定义，恢复Koch标准顺序
        kochCustomChars = null;
        kochLevel = 1;
        kochPassCount = 0;
        kochUpdateUI();
        showToast('已恢复Koch标准顺序', 'info');
        return;
    }
    // 去重并验证字符都在MORSE_CODE中
    const unique = [...new Set(raw.split(''))].filter(ch => MORSE_CODE[ch]);
    if (unique.length < 2) {
        showToast('自定义字符集至少需要2个有效摩尔斯字符', 'warn');
        return;
    }
    kochCustomChars = unique.join('');
    kochLevel = 1;
    kochPassCount = 0;
    kochUpdateUI();
    showToast('自定义字符集: ' + kochCustomChars, 'success');
}

/**
 * 切换速度渐变
 */
function kochToggleAutoSpeed() {
    const cb = document.getElementById('kochAutoSpeed');
    kochAutoSpeed = cb ? cb.checked : false;
}
function initMorseTable() {
    const tbody = document.querySelector('#morseTable tbody');
    if (!tbody)
        return;
    tbody.innerHTML = Object.entries(MORSE_CODE).map(([ch, code]) => '<tr><td style="font-weight:700;font-size:14px">' + ch + '</td><td style="font-family:Consolas,monospace;font-size:16px;letter-spacing:2px">' + code + '</td></tr>').join('');
}
function init() {
    initCwKey();
    initMorseTable();
    // 预创建AudioContext，避免首次播放延迟
    preCreateAudioCtx();
    // 页面卸载时清理AudioContext，防止内存泄漏
    window.addEventListener('pagehide', cwStopPlay);
    window.addEventListener('beforeunload', cwStopPlay);
}
export { cwEncode, cwPlayEncode, cwDecode, cwStopPlay, cwPracticeStart, cwPracticeReveal, cwPracticeCheck, saveCwKeySettings, init,
    kochStart, kochNextRound, kochCheck, kochReveal, kochSkipLevel, kochReset, kochSetCustom, kochToggleAutoSpeed };