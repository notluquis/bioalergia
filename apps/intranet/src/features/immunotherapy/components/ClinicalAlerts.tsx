import { Alert } from "@heroui/react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { ClinicalAlert } from "../data/types";

const STATUS_MAP = {
  info: "default",
  warning: "warning",
  danger: "danger",
} as const;

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  danger: ShieldAlert,
} as const;

interface ClinicalAlertsProps {
  alerts: ClinicalAlert[];
}

export function ClinicalAlerts({ alerts }: ClinicalAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, idx) => {
        const Icon = ICON_MAP[alert.severity];
        return (
          <div
            key={`${alert.ruleTriggered}-${idx}`}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
            style={{
              animationDelay: `${idx * 100}ms`,
              animationDuration: "400ms",
            }}
          >
            <Alert status={STATUS_MAP[alert.severity]}>
              <Alert.Indicator>
                <Icon size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{alert.ruleTriggered}</Alert.Title>
                <Alert.Description>{alert.message}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        );
      })}
    </div>
  );
}
