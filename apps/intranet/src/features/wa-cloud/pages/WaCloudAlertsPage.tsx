import { Badge, Button, Card, Chip, EmptyState, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { Bell, Check, Megaphone, Settings2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useAccountEvents, useAcknowledgeAccountEvent } from "../hooks/useWaCloud";

const SEVERITY_COLOR: Record<string, "success" | "warning" | "danger" | "default" | "accent"> = {
  info: "default",
  warning: "warning",
  critical: "danger",
};

const KIND_ICON: Record<string, React.ReactNode> = {
  ACCOUNT_ALERT: <Megaphone size={14} />,
  ACCOUNT_REVIEW: <ShieldAlert size={14} />,
  SECURITY: <ShieldAlert size={14} />,
  BUSINESS_CAPABILITY: <Settings2 size={14} />,
  PHONE_QUALITY: <Settings2 size={14} />,
};

export function WaCloudAlertsPage() {
  const [showAck, setShowAck] = useState(false);
  const events = useAccountEvents({
    acknowledged: showAck ? undefined : false,
    limit: 200,
  });
  const ack = useAcknowledgeAccountEvent();

  const items = events.data?.events ?? [];
  const unacked = events.data?.unacknowledgedCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-lg">
          <Bell size={18} className="text-warning" />
          Alertas de cuenta WhatsApp
          {unacked > 0 && (
            <Chip size="sm" color="danger" variant="soft">
              <Chip.Label>{unacked}</Chip.Label>
            </Chip>
          )}
        </h2>
        <Button size="sm" variant="outline" onPress={() => setShowAck((s) => !s)}>
          {showAck ? "Solo no leídas" : "Mostrar todas"}
        </Button>
      </div>

      {events.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState className="text-center">
              <Bell size={36} className="mx-auto text-default-300" />
              <p className="mt-2 font-semibold text-base">Sin alertas</p>
              <p className="text-default-500 text-sm">
                Meta enviará aquí avisos de cuenta, seguridad, calidad y cambios de tier.
              </p>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li key={e.id}>
              <Card>
                <Card.Content className="flex items-start gap-3 p-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      e.severity === "critical"
                        ? "bg-danger-100 text-danger"
                        : e.severity === "warning"
                          ? "bg-warning-100 text-warning-700"
                          : "bg-default-100 text-default-500"
                    }`}
                  >
                    {KIND_ICON[e.kind] ?? <Bell size={14} />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-sm">{e.title}</p>
                      <Chip size="sm" color={SEVERITY_COLOR[e.severity]} variant="soft">
                        <Chip.Label>{e.severity}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft" color="default">
                        <Chip.Label>{e.kind}</Chip.Label>
                      </Chip>
                      <span className="text-default-400 text-xs">
                        {dayjs(e.receivedAt).format("DD-MM HH:mm")}
                      </span>
                    </div>
                    {e.description && <p className="text-default-600 text-sm">{e.description}</p>}
                    <p className="font-mono text-default-400 text-[10px]">{e.field}</p>
                  </div>
                  {!e.acknowledged ? (
                    <Button
                      size="sm"
                      variant="outline"
                      isPending={ack.isPending}
                      onPress={() => ack.mutate(e.id)}
                    >
                      <Check size={12} />
                      Marcar leída
                    </Button>
                  ) : (
                    <Badge color="success" placement="top-right" size="sm">
                      <Badge.Label>OK</Badge.Label>
                      <Badge.Anchor>
                        <span className="size-3" />
                      </Badge.Anchor>
                    </Badge>
                  )}
                </Card.Content>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
