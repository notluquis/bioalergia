import { Button, Card, Chip, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import {
  useAccounts,
  useConversation,
  useSendTemplate,
  useSendText,
  useTemplates,
  useUpdateConversation,
} from "../hooks/useWaCloud";

export function ConversationDetail({ conversationId }: { conversationId: number }) {
  const conv = useConversation(conversationId);
  const accounts = useAccounts();
  const templates = useTemplates();
  const sendText = useSendText();
  const sendTemplate = useSendTemplate();
  const updateConv = useUpdateConversation();

  const [body, setBody] = useState("");
  const [phoneId, setPhoneId] = useState<string>("");
  const [mode, setMode] = useState<"text" | "template">("text");
  const [tplKey, setTplKey] = useState("");
  const [tplVars, setTplVars] = useState<string[]>([]);

  const allPhones = useMemo(
    () => (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers),
    [accounts.data]
  );
  const phoneOptions = allPhones.map((p) => ({
    value: String(p.id),
    label: `${p.label ?? p.displayPhoneNumber}`,
  }));
  const tplOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...(templates.data?.templates ?? [])
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({
          value: `${t.id}|${t.name}|${t.language}`,
          label: `${t.name} (${t.language})`,
        })),
    ],
    [templates.data]
  );

  useEffect(() => {
    if (!phoneId && conv.data?.channels[0]) {
      setPhoneId(String(conv.data.channels[0].phoneNumberId));
    }
  }, [conv.data, phoneId]);

  useEffect(() => {
    if (!conv.data?.windowOpen) setMode("template");
    else setMode("text");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.data?.windowOpen]);

  useEffect(() => {
    if (!tplKey) {
      setTplVars([]);
      return;
    }
    const tpl = templates.data?.templates.find((t) => `${t.id}|${t.name}|${t.language}` === tplKey);
    if (!tpl) return;
    const body = (tpl.components as Array<{ type: string; text?: string }>).find(
      (c) => c.type === "BODY" || c.type === "body"
    );
    const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
    setTplVars(new Array(matches.length).fill(""));
  }, [tplKey, templates.data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conv.data?.messages.length]);

  if (conv.isLoading || !conv.data) {
    return (
      <Card.Content className="flex h-full items-center justify-center">
        <Spinner />
      </Card.Content>
    );
  }

  const c = conv.data;

  const handleSendText = async () => {
    if (!body.trim() || !phoneId) return;
    await sendText.mutateAsync({
      conversationId,
      phoneNumberId: Number.parseInt(phoneId, 10),
      body: body.trim(),
    });
    setBody("");
  };

  const handleSendTemplate = async () => {
    if (!tplKey || !phoneId) return;
    const [, name, language] = tplKey.split("|");
    if (!name || !language) return;
    await sendTemplate.mutateAsync({
      conversationId,
      phoneNumberId: Number.parseInt(phoneId, 10),
      templateName: name,
      language,
      bodyParams: tplVars.length ? tplVars : undefined,
    });
    setTplKey("");
    setTplVars([]);
  };

  return (
    <>
      <Card.Header className="flex items-center justify-between p-3">
        <div>
          <Card.Title>{c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164}</Card.Title>
          <Card.Description>
            {c.contact.phoneE164}
            {c.contact.patientRut && <> · RUT {c.contact.patientRut}</>}
          </Card.Description>
        </div>
        <div className="flex items-center gap-2">
          <Chip variant="soft" size="sm">
            {c.conversation.status}
          </Chip>
          {c.windowOpen ? (
            <Chip color="success" variant="soft" size="sm">
              Ventana abierta {c.windowExpiresAt && dayjs(c.windowExpiresAt).fromNow(true)}
            </Chip>
          ) : (
            <Chip color="warning" variant="soft" size="sm">
              Ventana 24h cerrada
            </Chip>
          )}
        </div>
      </Card.Header>

      <Card.Content className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto rounded bg-default-50 p-3">
          {c.messages.map((m) => {
            const out = m.direction === "OUTBOUND";
            return (
              <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded p-2 ${out ? "bg-primary-100" : "bg-default-200"}`}
                >
                  <p className="whitespace-pre-line text-sm">{m.body ?? `[${m.type}]`}</p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-default-500 text-xs">
                    <span>{dayjs(m.timestamp).format("HH:mm")}</span>
                    {out && (
                      <Chip size="sm" variant="soft">
                        {m.status}
                      </Chip>
                    )}
                  </div>
                  {m.errorTitle && (
                    <p className="text-danger text-xs">
                      {m.errorTitle}: {m.errorDetails ?? m.errorCode}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 rounded border border-default-200 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <SelectInput
              label="Enviar desde"
              value={phoneId}
              onValueChange={setPhoneId}
              options={phoneOptions}
            />
            <SelectInput
              label="Modo"
              value={mode}
              onValueChange={(v) => setMode(v as "text" | "template")}
              options={[
                { value: "text", label: "Texto libre (24h)" },
                { value: "template", label: "Plantilla" },
              ]}
            />
            <SelectInput
              label="Asignar a (futuro)"
              value=""
              onValueChange={(v) => {
                if (v === "current")
                  updateConv.mutate({ id: conversationId, assignedToUserId: null });
              }}
              options={[
                { value: "", label: "—" },
                { value: "current", label: "Liberar asignación" },
              ]}
            />
          </div>

          {mode === "text" ? (
            <>
              {!c.windowOpen && (
                <p className="text-warning text-xs">
                  Texto libre solo dentro de 24h tras último inbound. Usa plantilla.
                </p>
              )}
              <TextAreaInput
                label="Mensaje"
                rows={3}
                value={body}
                onValueChange={setBody}
                isDisabled={!c.windowOpen}
              />
              <Button
                variant="primary"
                isDisabled={!body.trim() || !phoneId || !c.windowOpen || sendText.isPending}
                onPress={handleSendText}
              >
                {sendText.isPending ? "Enviando..." : "Enviar"}
              </Button>
              {sendText.isError && (
                <p className="text-danger text-sm">
                  {(sendText.error as Error)?.message ?? "Error"}
                </p>
              )}
            </>
          ) : (
            <>
              <SelectInput
                label="Plantilla aprobada"
                value={tplKey}
                onValueChange={setTplKey}
                options={tplOptions}
              />
              {tplVars.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {tplVars.map((v, i) => (
                    <TextInput
                      key={i}
                      label={`Variable {{${i + 1}}}`}
                      value={v}
                      onValueChange={(val) =>
                        setTplVars((arr) => {
                          const n = [...arr];
                          n[i] = val;
                          return n;
                        })
                      }
                    />
                  ))}
                </div>
              )}
              <Button
                variant="primary"
                isDisabled={!tplKey || !phoneId || sendTemplate.isPending}
                onPress={handleSendTemplate}
              >
                {sendTemplate.isPending ? "Enviando..." : "Enviar plantilla"}
              </Button>
              {sendTemplate.isError && (
                <p className="text-danger text-sm">
                  {(sendTemplate.error as Error)?.message ?? "Error"}
                </p>
              )}
            </>
          )}
        </div>
      </Card.Content>
    </>
  );
}
