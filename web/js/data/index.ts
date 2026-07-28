/**
 * HAM Radio Toolbox - 静态数据加载器
 * 从JSON文件异步加载所有静态数据，实现数据与代码分离
 * @module data
 */

import type { StaticData } from '../types.js';

/** 数据加载状态 */
let _loaded = false;
let _loadPromise: Promise<void> | null = null;

/** 缓存的静态数据 */
const _data: StaticData = {
  bands: [],
  modes: [],
  coaxTypes: {},
  qCodes: [],
  engAbbrev: [],
  numAbbrev: [],
  cityCoords: {},
  modesRef: [],
  defaultClocks: [],
  rstData: { readability: [], strength: [], tone: [] }
};

/**
 * 加载单个JSON文件
 * @param path - JSON文件路径
 * @returns 解析后的JSON数据
 */
async function _fetchJson<T>(path: string): Promise<T> {
  const resp = await fetch(path, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) throw new Error('Failed to load ' + path + ': ' + resp.status);
  return resp.json() as Promise<T>;
}

/**
 * 加载所有静态数据
 * 并行加载所有JSON文件，加载完成后设置_loaded标志
 */
async function loadAll(): Promise<void> {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const base = new URL('.', import.meta.url).href;
    const [
      bands, modes, coaxTypes, qCodes, engAbbrev,
      numAbbrev, cityCoords, modesRef, defaultClocks, rstData
    ] = await Promise.all([
      _fetchJson<StaticData['bands']>(base + 'bands.json'),
      _fetchJson<StaticData['modes']>(base + 'modes.json'),
      _fetchJson<StaticData['coaxTypes']>(base + 'coax-types.json'),
      _fetchJson<StaticData['qCodes']>(base + 'q-codes.json'),
      _fetchJson<StaticData['engAbbrev']>(base + 'eng-abbrev.json'),
      _fetchJson<StaticData['numAbbrev']>(base + 'num-abbrev.json'),
      _fetchJson<StaticData['cityCoords']>(base + 'city-coords.json'),
      _fetchJson<StaticData['modesRef']>(base + 'modes-ref.json'),
      _fetchJson<StaticData['defaultClocks']>(base + 'default-clocks.json'),
      _fetchJson<StaticData['rstData']>(base + 'rst-data.json')
    ]);

    _data.bands = bands;
    _data.modes = modes;
    _data.coaxTypes = coaxTypes;
    _data.qCodes = qCodes;
    _data.engAbbrev = engAbbrev;
    _data.numAbbrev = numAbbrev;
    _data.cityCoords = cityCoords;
    _data.modesRef = modesRef;
    _data.defaultClocks = defaultClocks;
    _data.rstData = rstData;
    _loaded = true;
  })();

  return _loadPromise;
}

/**
 * 获取已加载的数据
 * @param key - 数据键名
 * @returns 对应的静态数据
 */
function get<K extends keyof StaticData>(key: K): StaticData[K] {
  return _data[key];
}

/** 数据是否已加载完成 */
function isLoaded(): boolean {
  return _loaded;
}

export { loadAll, get, isLoaded };