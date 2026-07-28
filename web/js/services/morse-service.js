/**
 * HAM Radio Toolbox - 莫尔斯电码服务层
 * 纯业务逻辑，无DOM依赖，可独立测试
 * @module services/morse-service
 */
const MORSE_CODE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
    I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
    Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};
const MORSE_DECODE = Object.fromEntries(Object.entries(MORSE_CODE).map(([k, v]) => [v, k]));
/**
 * 文本转莫尔斯电码
 * @param text - 输入文本
 * @returns 莫尔斯电码字符串
 */
export function morseEncode(text) {
    if (!text)
        return '';
    return text.toUpperCase().split('').map(ch => {
        if (ch === ' ')
            return '/';
        return MORSE_CODE[ch] || '';
    }).filter(Boolean).join(' ');
}
/**
 * 莫尔斯电码转文本
 * @param morse - 莫尔斯电码字符串
 * @returns 解码文本
 */
export function morseDecode(morse) {
    if (!morse)
        return '';
    return morse.trim().split(/\s*\/\s*/).map(word => word.trim().split(/\s+/).map(code => MORSE_DECODE[code] || '').join('')).join(' ');
}
/**
 * 获取莫尔斯电码映射表
 * @returns 莫尔斯电码映射对象
 */
export function getMorseTable() {
    return { ...MORSE_CODE };
}
//# sourceMappingURL=morse-service.js.map