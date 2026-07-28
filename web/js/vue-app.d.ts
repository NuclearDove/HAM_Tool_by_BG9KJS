import type { AppState } from './types.js';
import { EventBus } from './event-bus.js';
declare let appState: AppState;
export declare function createHamApp(): Promise<any>;
export { appState, EventBus };
