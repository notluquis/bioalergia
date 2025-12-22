export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: {
    db: {
      status: "ok" | "error";
      latency: number | null;
      message?: string;
    };
  };
}
