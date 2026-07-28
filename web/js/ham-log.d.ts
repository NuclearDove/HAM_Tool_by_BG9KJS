import type { QsoEntry } from './types.js';
declare function loadQsos(): QsoEntry[];
declare function logModeRstPreset(): void;
declare function logAdd(): void;
declare function logEdit(id: string): void;
declare function logCancelEdit(): void;
declare function logDelete(id: string): void;
declare function logClearForm(): void;
declare function logRefreshTable(): void;
/** 搜索时重置页码 */
declare function resetPage(): void;
/**
 * 跳转到指定页
 */
declare function logGoPage(page: number): void;
declare function logExportAdi(): void;
declare function logExportCabrillo(): void;
declare function logExportCsv(): void;
declare function logImportAdi(): void;
/**
 * ADI文件导入（含白名单过滤防止原型污染 + 字段校验）
 */
declare function logImportAdiFile(e: Event): void;
declare function logBackup(): void;
declare function logRestore(): void;
declare function logRestoreFile(e: Event): void;
declare function init(): void;
/**
 * 通联统计：模式分布、频段分布、月度趋势
 */
declare function logStats(): void;
export { logModeRstPreset, logAdd, logClearForm, logRefreshTable, logEdit, logCancelEdit, logDelete, logExportAdi, logExportCabrillo, logExportCsv, logImportAdi, logImportAdiFile, logBackup, logRestore, logRestoreFile, loadQsos, init, logGoPage, logStats, resetPage };
