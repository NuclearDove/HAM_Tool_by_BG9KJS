/**
 * 缩略语查询
 * @param type - 查询类型: 'qcode'|'engabbr'|'numabbr'
 */
declare function abbrevLookup(type: 'qcode' | 'engabbr' | 'numabbr'): void;
declare function init(): void;
export { abbrevLookup, init };
