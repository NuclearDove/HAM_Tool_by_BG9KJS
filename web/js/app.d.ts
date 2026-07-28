declare global {
    interface Window {
        __HAM_VUE__?: boolean;
    }
}
export declare function bootVue(): Promise<void>;
