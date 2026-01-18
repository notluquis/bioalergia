export interface HealthResponse {
  checks: {
    db: {
      latency: null | number;
      message?: string;
      status: "error" | "ok";
    };
  };
  status: "degraded" | "error" | "ok";
  timestamp: string;
}
