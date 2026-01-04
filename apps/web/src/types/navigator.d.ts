export {};

declare global {
  interface Navigator {
    deviceMemory?: number;
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
    };
  }
}
