/**
 * HAM Radio Toolbox - EventBus 事件总线
 * 模块间解耦通信，ES Module 独立导出
 */
declare const EventBus: {
    /**
     * 注册事件监听器
     * @param event - 事件名
     * @param fn - 回调函数
     */
    on(event: string, fn: Function): void;
    /**
     * 移除事件监听器
     * @param event - 事件名
     * @param fn - 回调函数，省略则移除该事件全部监听
     */
    off(event: string, fn?: Function): void;
    /**
     * 触发事件
     * @param event - 事件名
     * @param args - 传递给监听器的参数
     */
    emit(event: string, ...args: any[]): void;
};
export { EventBus };
