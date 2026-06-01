export {};

declare global {
  interface Window {
    electron: import("../types/electron_api.type").ElectronApi;
  }
}
