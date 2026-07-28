/**
 * 停止播放并清理音频上下文
 */
declare function cwStopPlay(): void;
declare function cwEncode(): void;
declare function cwPlayEncode(): void;
declare function cwDecode(): void;
declare function saveCwKeySettings(): void;
declare function cwPracticeStart(): void;
declare function cwPracticeReveal(): void;
declare function cwPracticeCheck(): void;
declare function init(): void;
export { cwEncode, cwPlayEncode, cwDecode, cwStopPlay, cwPracticeStart, cwPracticeReveal, cwPracticeCheck, saveCwKeySettings, init };
