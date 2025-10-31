import type { IStaticMethods } from "preline/dist";

declare global {
  interface Window {
    _?: any;
    $?: typeof import("jquery");
    jQuery?: typeof import("jquery");
    HSStaticMethods?: IStaticMethods;
  }
}

export {};
