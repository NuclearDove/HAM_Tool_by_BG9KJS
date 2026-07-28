/**
 * HAM Radio Toolbox - CW练习 Tab 模块 (ES Module)
 * 包含摩尔斯码编解码、音频播放、模拟电键(含键盘快捷键)、随机练习
 * @module ham-cw
 */
'use strict';

import type { MorseCodeMap } from './types.js';
import { MORSE_CODE, MORSE_REVERSE, morseEncode, morseDecode } from './core.js';
import { EventBus } from './event-bus.js';
import { showToast } from './ham-toast.js';

// 音频状态
let audioCtx: AudioContext | null = null;
let cwPlaying: boolean = false;
let cwPlayTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * 获取AudioContext（懒加载+自动恢复）
 * 现代浏览器要求用户交互后才能播放音频
 */
function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
function preCreateAudioCtx(): void {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      // 立即suspend，等待用户交互时resume
      if (audioCtx.state === 'suspended') {
        // 注册一次性交互监听器来解锁
        const unlock = (): void => {
          if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          document.removeEventListener('click', unlock);
          document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
      }
    } catch(e) {
      console.warn('[HAM] AudioContext not available:', e);
    }
  }
}

function cwPlayTone(startTime: number, duration: number): void {
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

function cwPlayMorse(morseStr: string, wpm: number, callback?: () => void): void {
  cwStopPlay();
  cwPlaying = true;
  const ctx = getAudioCtx();
  const dotDur = 1.2 / wpm;
  const dashDur = dotDur * 3;
  const symGap = dotDur;
  const charGap = dotDur * 3;
  const wordGap = dotDur * 7;
  let t = ctx.currentTime + 0.1;
  const chars = morseStr.split(' ');
  chars.forEach(c => {
    if (c === '/') { t += wordGap; return; }
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      if (ch === '·' || ch === '.') { cwPlayTone(t, dotDur); t += dotDur; }
      else if (ch === '-' || ch === '–') { cwPlayTone(t, dashDur); t += dashDur; }
      if (i < c.length - 1) t += symGap;
    }
    t += charGap;
  });
  const totalMs = (t - ctx.currentTime) * 1000;
  cwPlayTimeout = setTimeout(() => { cwPlaying = false; if (callback) callback(); }, totalMs);
}

/**
 * 停止播放并清理音频上下文
 */
function cwStopPlay(): void {
  cwPlaying = false;
  if (cwPlayTimeout) { clearTimeout(cwPlayTimeout); cwPlayTimeout = null; }
  try { if (audioCtx) { audioCtx.close(); audioCtx = null; } } catch(e) { /* ignore */ }
}

function cwEncode(): void {
  const text = (document.getElementById('cwEncodeIn') as HTMLInputElement).value;
  if (!text) { (document.getElementById('cwEncodeOut') as HTMLElement).textContent = ''; return; }
  (document.getElementById('cwEncodeOut') as HTMLElement).textContent = morseEncode(text);
  EventBus.emit('status', '摩尔斯编码完成');
}

function cwPlayEncode(): void {
  let morse = (document.getElementById('cwEncodeOut') as HTMLElement).textContent || '';
  if (!morse) { cwEncode(); morse = (document.getElementById('cwEncodeOut') as HTMLElement).textContent || ''; }
  if (!morse) return;
  const wpm = parseInt((document.getElementById('cwWpm') as HTMLInputElement).value);
  cwPlayMorse(morse, wpm);
  EventBus.emit('status', '播放中...');
}

function cwDecode(): void {
  const morse = (document.getElementById('cwDecodeIn') as HTMLInputElement).value;
  if (!morse) { (document.getElementById('cwDecodeOut') as HTMLElement).textContent = ''; return; }
  (document.getElementById('cwDecodeOut') as HTMLElement).textContent = morseDecode(morse);
  EventBus.emit('status', '摩尔斯解码完成');
}

// 电键设置存储
const CW_KEY_SETTINGS_KEY = 'ham_cw_key_settings' as const;

interface CwKeySettings {
  dashThresh: number;
  spaceThresh: number;
}

function saveCwKeySettings(): void {
  const dashThresh = parseInt((document.getElementById('cwDashThresh') as HTMLInputElement)?.value) || 120;
  const spaceThresh = parseInt((document.getElementById('cwSpaceThresh') as HTMLInputElement)?.value) || 240;
  localStorage.setItem(CW_KEY_SETTINGS_KEY, JSON.stringify({ dashThresh, spaceThresh }));
  const hint = document.getElementById('cwKeySettingsHint') as HTMLElement | null;
  if (hint) { hint.textContent = '已保存'; setTimeout(() => { hint.textContent = ''; }, 1500); }
}

function loadCwKeySettings(): void {
  try {
    const saved: CwKeySettings = JSON.parse(localStorage.getItem(CW_KEY_SETTINGS_KEY) || 'null');
    if (saved) {
      if (saved.dashThresh) (document.getElementById('cwDashThresh') as HTMLInputElement).value = String(saved.dashThresh);
      if (saved.spaceThresh) (document.getElementById('cwSpaceThresh') as HTMLInputElement).value = String(saved.spaceThresh);
    }
  } catch(e) { /* ignore */ }
}

// 模拟电键状态
let keyDownTime: number = 0;
let keyTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 处理电键按下
 */
function handleKeyDown(): void {
  if (keyTimer) clearTimeout(keyTimer);
  keyDownTime = Date.now();
  const btn = document.getElementById('cwKeyBtn') as HTMLElement | null;
  if (btn) btn.classList.add('pressed');
}

/**
 * 处理电键释放
 */
function handleKeyUp(): void {
  const btn = document.getElementById('cwKeyBtn') as HTMLElement | null;
  if (btn) btn.classList.remove('pressed');
  const dur = Date.now() - keyDownTime;
  const dashThresh = parseInt((document.getElementById('cwDashThresh') as HTMLInputElement)?.value) || 120;
  const spaceThresh = parseInt((document.getElementById('cwSpaceThresh') as HTMLInputElement)?.value) || 240;
  const sym = dur < dashThresh ? '·' : '-';
  (document.getElementById('cwDecodeIn') as HTMLInputElement).value += sym;
  if (keyTimer) clearTimeout(keyTimer);
  keyTimer = setTimeout(() => { (document.getElementById('cwDecodeIn') as HTMLInputElement).value += ' '; }, spaceThresh);
}

function initCwKey(): void {
  loadCwKeySettings();
  const cwKeyBtn = document.getElementById('cwKeyBtn') as HTMLElement | null;
  if (!cwKeyBtn) return;

  // 鼠标事件
  cwKeyBtn.addEventListener('mousedown', (e: MouseEvent) => { e.preventDefault(); handleKeyDown(); });
  cwKeyBtn.addEventListener('mouseup', (e: MouseEvent) => { e.preventDefault(); handleKeyUp(); });

  // 触屏事件
  cwKeyBtn.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); handleKeyDown(); });
  cwKeyBtn.addEventListener('touchend', (e: TouchEvent) => { e.preventDefault(); handleKeyUp(); });

  // 键盘快捷键：空格键模拟电键（仅在CW解码Tab激活时）
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      // 检查焦点是否在输入框/文本域中，如果是则不拦截
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // 检查CW解码子Tab是否可见
      const decodeTab = document.getElementById('cw-cw-decode') as HTMLElement | null;
      if (decodeTab && decodeTab.classList.contains('active')) {
        e.preventDefault();
        handleKeyDown();
      }
    }
  });

  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const decodeTab = document.getElementById('cw-cw-decode') as HTMLElement | null;
      if (decodeTab && decodeTab.classList.contains('active')) {
        e.preventDefault();
        handleKeyUp();
      }
    }
  });
}

// CW 随机练习
let practiceAnswer: string = '';
let practiceGroupCount: number = 0;
let practiceCurrentGroup: number = 0;

function cwPracticeStart(): void {
  const alpha = (document.getElementById('cwPracAlpha') as HTMLInputElement).checked;
  const num = (document.getElementById('cwPracNum') as HTMLInputElement).checked;
  const punct = (document.getElementById('cwPracPunct') as HTMLInputElement).checked;
  if (!alpha && !num && !punct) { showToast('请至少选择一种字符集。', 'warning'); return; }
  let chars = '';
  if (alpha) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (num) chars += '0123456789';
  if (punct) chars += '.,?/()=+-:;';
  const len = parseInt((document.getElementById('cwPracLen') as HTMLInputElement).value);
  const count = parseInt((document.getElementById('cwPracCount') as HTMLInputElement).value);
  const groups: string[] = [];
  for (let i = 0; i < count; i++) {
    let g = '';
    for (let j = 0; j < len; j++) g += chars[Math.floor(Math.random() * chars.length)];
    groups.push(g);
  }
  practiceAnswer = groups.join(' ');
  practiceGroupCount = count;
  practiceCurrentGroup = 0;
  const m = morseEncode(practiceAnswer);
  (document.getElementById('cwPracDisp') as HTMLElement).textContent = m;
  (document.getElementById('cwPracLog') as HTMLElement).textContent = '第 ' + (practiceCurrentGroup + 1) + '/' + count + ' 组，正在播放...';
  (document.getElementById('cwPracUser') as HTMLInputElement).value = '';
  (document.getElementById('cwPracScore') as HTMLElement).textContent = '';
  const wpm = parseInt((document.getElementById('cwWpm') as HTMLInputElement).value);
  cwPlayMorse(m, wpm, () => {
    (document.getElementById('cwPracLog') as HTMLElement).textContent = '播放完毕，请输入抄收内容。';
  });
}

function cwPracticeReveal(): void {
  if (practiceAnswer) (document.getElementById('cwPracLog') as HTMLElement).textContent = '答案: ' + practiceAnswer;
}

function cwPracticeCheck(): void {
  const user = (document.getElementById('cwPracUser') as HTMLInputElement).value.toUpperCase().trim();
  const answer = practiceAnswer.toUpperCase();
  if (!user || !answer) return;
  let correct = 0;
  const total = answer.replace(/\s/g,'').length;
  const uArr = user.replace(/\s/g,'').split('');
  const aArr = answer.replace(/\s/g,'').split('');
  for (let i = 0; i < Math.min(uArr.length, aArr.length); i++) {
    if (uArr[i] === aArr[i]) correct++;
  }
  const pct = total > 0 ? (correct / total * 100).toFixed(1) : '0';
  (document.getElementById('cwPracScore') as HTMLElement).textContent = '正确率: ' + correct + '/' + total + ' = ' + pct + '%';
  EventBus.emit('status', '练习评分完成');
}

function initMorseTable(): void {
  const tbody = document.querySelector('#morseTable tbody') as HTMLTableSectionElement | null;
  if (!tbody) return;
  tbody.innerHTML = Object.entries(MORSE_CODE as MorseCodeMap).map(([ch, code]) =>
    '<tr><td style="font-weight:700;font-size:14px">' + ch + '</td><td style="font-family:Consolas,monospace;font-size:16px;letter-spacing:2px">' + code + '</td></tr>'
  ).join('');
}

function init(): void {
  initCwKey();
  initMorseTable();
  // 预创建AudioContext，避免首次播放延迟
  preCreateAudioCtx();
  // 页面卸载时清理AudioContext，防止内存泄漏
  window.addEventListener('pagehide', cwStopPlay);
  window.addEventListener('beforeunload', cwStopPlay);
}

export { cwEncode, cwPlayEncode, cwDecode, cwStopPlay, cwPracticeStart, cwPracticeReveal, cwPracticeCheck, saveCwKeySettings, init };