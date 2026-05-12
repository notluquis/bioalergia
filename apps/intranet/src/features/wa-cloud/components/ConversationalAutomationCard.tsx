import { Button, Card, Chip, Switch } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useConversationalAutomation,
  useUpdateConversationalAutomation,
} from "../hooks/useWaCloud";

type LocalCommand = { command_name: string; command_description: string };

// Editor for Meta's Conversational Automation: ice breakers (max 4),
// commands (max 30, slash menu in WhatsApp client), and the welcome
// message toggle. State lives locally until "Guardar" so the operator
// can iterate without thrashing the Meta API.
export function ConversationalAutomationCard() {
  const accounts = useAccounts();
  const allPhones = useMemo(
    () =>
      (accounts.data?.accounts ?? []).flatMap((a) =>
        a.phoneNumbers.map((p) => ({ id: p.id, label: `${p.label ?? p.displayPhoneNumber}` }))
      ) ?? [],
    [accounts.data]
  );
  const [phoneId, setPhoneId] = useState("");
  useEffect(() => {
    if (!phoneId && allPhones[0]) setPhoneId(String(allPhones[0].id));
  }, [allPhones, phoneId]);

  const numericPhoneId = phoneId ? Number.parseInt(phoneId, 10) : undefined;
  const remote = useConversationalAutomation(numericPhoneId);
  const update = useUpdateConversationalAutomation();

  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [commands, setCommands] = useState<LocalCommand[]>([]);

  // Hydrate local state from server, reset whenever phone changes.
  useEffect(() => {
    if (!remote.data) return;
    setWelcomeEnabled(remote.data.enable_welcome_message);
    setPrompts(remote.data.prompts ?? []);
    setCommands(remote.data.commands ?? []);
  }, [remote.data]);

  const addPrompt = () => {
    if (prompts.length >= 4) {
      toast.error("Máximo 4 ice breakers");
      return;
    }
    setPrompts([...prompts, ""]);
  };
  const removePrompt = (i: number) => setPrompts(prompts.filter((_, idx) => idx !== i));
  const setPrompt = (i: number, v: string) =>
    setPrompts(prompts.map((p, idx) => (idx === i ? v : p)));

  const addCommand = () => {
    if (commands.length >= 30) {
      toast.error("Máximo 30 commands");
      return;
    }
    setCommands([...commands, { command_name: "", command_description: "" }]);
  };
  const removeCommand = (i: number) => setCommands(commands.filter((_, idx) => idx !== i));
  const setCommand = (i: number, key: keyof LocalCommand, v: string) =>
    setCommands(commands.map((c, idx) => (idx === i ? { ...c, [key]: v } : c)));

  const save = () => {
    if (!numericPhoneId) {
      toast.error("Selecciona un número primero");
      return;
    }
    const trimmedPrompts = prompts.map((p) => p.trim()).filter(Boolean);
    const trimmedCommands = commands
      .map((c) => ({
        command_name: c.command_name.trim().toLowerCase(),
        command_description: c.command_description.trim(),
      }))
      .filter((c) => c.command_name && c.command_description);
    if (trimmedPrompts.some((p) => p.length > 80)) {
      toast.error("Cada ice breaker debe tener máximo 80 caracteres");
      return;
    }
    if (trimmedCommands.some((c) => !/^[a-z0-9_]+$/.test(c.command_name))) {
      toast.error("Commands: solo letras minúsculas, números y guión bajo");
      return;
    }
    update.mutate(
      {
        phoneNumberId: numericPhoneId,
        config: {
          enable_welcome_message: welcomeEnabled,
          prompts: trimmedPrompts,
          commands: trimmedCommands,
        },
      },
      {
        onSuccess: () => toast.success("Configuración enviada a Meta"),
        onError: (e) => toast.error(`Error Meta: ${String(e)}`),
      }
    );
  };

  return (
    <Card>
      <Card.Header className="!flex !flex-row !items-center !justify-between">
        <div>
          <Card.Title>Conversational components (Meta)</Card.Title>
          <Card.Description>
            Ice breakers + commands + welcome message. Aparecen nativos en WhatsApp del paciente.
          </Card.Description>
        </div>
        <SelectInput
          label="Número"
          value={phoneId}
          onValueChange={setPhoneId}
          options={allPhones.map((p) => ({ value: String(p.id), label: p.label }))}
        />
      </Card.Header>
      <Card.Content className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-default-200 bg-content2 p-3">
          <div>
            <p className="font-medium text-sm">Welcome message</p>
            <p className="text-default-500 text-xs">
              Meta envía un mensaje de bienvenida la primera vez que un paciente abre tu chat.
            </p>
          </div>
          <Switch isSelected={welcomeEnabled} onChange={setWelcomeEnabled} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Ice breakers ({prompts.length}/4)</p>
              <p className="text-default-500 text-xs">
                Sugerencias en chips encima del input. Máx 80 caracteres c/u.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onPress={addPrompt}
              isDisabled={prompts.length >= 4}
            >
              <Plus size={12} />
              Agregar
            </Button>
          </div>
          <div className="space-y-2">
            {prompts.length === 0 && (
              <p className="text-default-400 text-xs italic">Sin ice breakers configurados.</p>
            )}
            {prompts.map((p, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextInput
                    label={`Ice breaker ${i + 1}`}
                    value={p}
                    onValueChange={(v) => setPrompt(i, v)}
                    placeholder="Ej: Quiero agendar una consulta"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label="Quitar"
                  onPress={() => removePrompt(i)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Commands ({commands.length}/30)</p>
              <p className="text-default-500 text-xs">
                Aparecen al tipear "/" en WhatsApp. Solo minúsculas/números/guión bajo.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onPress={addCommand}
              isDisabled={commands.length >= 30}
            >
              <Plus size={12} />
              Agregar
            </Button>
          </div>
          <div className="space-y-2">
            {commands.length === 0 && (
              <p className="text-default-400 text-xs italic">Sin commands configurados.</p>
            )}
            {commands.map((c, i) => (
              <div
                key={i}
                className="flex items-end gap-2 rounded-md border border-default-200 bg-content1 p-2"
              >
                <div className="w-32 shrink-0">
                  <TextInput
                    label="Comando"
                    value={c.command_name}
                    onValueChange={(v) => setCommand(i, "command_name", v)}
                    placeholder="agendar"
                  />
                  {c.command_name && (
                    <Chip size="sm" variant="soft" color="default" className="mt-1">
                      <Chip.Label>/{c.command_name}</Chip.Label>
                    </Chip>
                  )}
                </div>
                <div className="flex-1">
                  <TextInput
                    label="Descripción"
                    value={c.command_description}
                    onValueChange={(v) => setCommand(i, "command_description", v)}
                    placeholder="Agendar consulta nueva"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label="Quitar"
                  onPress={() => removeCommand(i)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onPress={save} isPending={update.isPending} isDisabled={!numericPhoneId}>
            Guardar y enviar a Meta
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
