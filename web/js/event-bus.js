/**
 * HAM Radio Toolbox - EventBus 事件总线
 * 模块间解耦通信，ES Module 独立导出
 */
/** 事件监听器映射：事件名 → 回调函数数组 */
const _listeners = {};
const EventBus = {
    /**
     * 注册事件监听器
     * @param event - 事件名
     * @param fn - 回调函数
     */
    on(event, fn) {
        if (!_listeners[event])
            _listeners[event] = [];
        _listeners[event].push(fn);
    },
    /**
     * 移除事件监听器
     * @param event - 事件名
     * @param fn - 回调函数，省略则移除该事件全部监听
     */
    off(event, fn) {
        if (!_listeners[event])
            return;
        if (!fn) {
            delete _listeners[event];
            return;
        }
        _listeners[event] = _listeners[event].filter(f => f !== fn);
    },
    /**
     * 触发事件
     * @param event - 事件名
     * @param args - 传递给监听器的参数
     */
    emit(event, ...args) {
        const fns = _listeners[event];
        if (!fns)
            return;
        fns.forEach(fn => {
            try {
                fn(...args);
            }
            catch (e) {
                console.error('[EventBus] Error in handler for "' + event + '":', e);
            }
        });
    }
};
export { EventBus };
//# sourceMappingURL=event-bus.js.map