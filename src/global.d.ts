import type { IStaticMethods } from "preline/dist";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _?: any;
    $?: typeof import("jquery");
    jQuery?: typeof import("jquery");
    HSStaticMethods?: IStaticMethods;
  }
}

export {};
