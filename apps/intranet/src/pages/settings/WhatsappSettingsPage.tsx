import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  Surface,
  Switch,
  Table,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  CheckCheck,
  ClipboardCopy,
  MessageCircle,
  Send,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";
import {
  archiveWhatsappChat,
  assignWhatsappBusinessChatLabel,
  assignWhatsappBusinessMessageLabel,
  blockWhatsappChat,
  deleteWhatsappBusinessQuickReply,
  fetchWhatsappBusinessProfile,
  loadOlderWhatsappMessages,
  markWhatsappChatReadState,
  muteWhatsappChat,
  removeWhatsappBusinessChatLabel,
  removeWhatsappBusinessCoverPhoto,
  removeWhatsappBusinessMessageLabel,
  saveWhatsappBusinessLabel,
  saveWhatsappBusinessQuickReply,
  sendWhatsappCustomMessage,
  setWhatsappChatDisappearingMode,
  setWhatsappContactConsent,
  starWhatsappMessages,
  toggleWhatsappConnection,
  updateWhatsappBusinessCoverPhoto,
  updateWhatsappBusinessProfile,
  type WhatsappCustomMessageInput,
} from "@/features/whatsapp/api";
import { whatsappKeys } from "@/features/whatsapp/queries";
import { PAGE_CONTAINER } from "@/lib/styles";

function renderWhatsappInlineFormatting(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) => {
    const isBold = part.startsWith("*") && part.endsWith("*") && part.length >= 2;
    if (!isBold) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
  });
}

function renderWhatsappPreview(text: string) {
  const lines = text.split("\n");

  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line.length === 0 ? (
        <div className="h-4" />
      ) : (
        <div>{renderWhatsappInlineFormatting(line)}</div>
      )}
    </Fragment>
  ));
}

function getChatDisplayName(name: string | null | undefined, jid: string) {
  return name?.trim() || jid.replace(/@.+$/, "");
}

function getChatInitials(name: string | null | undefined, jid: string) {
  const base = getChatDisplayName(name, jid)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();

  if (!base) return "WA";

  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function formatChatTimestamp(date: Date | string | null | undefined) {
  if (!date) return "";

  const value = dayjs(date);
  if (!value.isValid()) return "";

  if (value.isSame(dayjs(), "day")) return value.format("HH:mm");
  if (value.isSame(dayjs().subtract(1, "day"), "day")) return "Ayer";
  return value.format("DD MMM");
}

const WHATSAPP_TEMPLATE_PREVIEW_EXAMPLE: Record<string, string> = {
  appointmentDate: dayjs().add(2, "day").hour(10).minute(30).format("DD/MM/YYYY HH:mm"),
  appointmentDoctor: "Dr. José Manuel Martínez",
  appointmentService: "Primera Consulta Inmunólogo Alergólogo (40 min)",
  clinicAddress: "Av. Ejemplo 123, Providencia",
  patientName: "Sandra Maldonado Guzmán",
};

const COMPOSER_KIND_OPTIONS: Array<{ label: string; value: WhatsappCustomMessageInput["kind"] }> = [
  { label: "Texto", value: "contextual_text" },
  { label: "Imagen", value: "image" },
  { label: "Documento / PDF", value: "document" },
  { label: "Audio", value: "audio" },
  { label: "Video", value: "video" },
  { label: "Sticker", value: "sticker" },
  { label: "Reacción", value: "reaction" },
  { label: "Marcar leído", value: "mark_read" },
  { label: "Typing", value: "typing" },
  { label: "Forward", value: "forward" },
  { label: "Delete", value: "delete" },
  { label: "Edit", value: "edit" },
  { label: "Location", value: "location" },
  { label: "Contacts", value: "contacts" },
  { label: "Temporales", value: "disappearing_messages" },
];

const HISTORY_DIRECTION_OPTIONS = [
  { label: "Todas", value: "all" },
  { label: "Inbound", value: "inbound" },
  { label: "Outbound", value: "outbound" },
] as const;

const HISTORY_STATUS_OPTIONS = [
  { label: "Todos", value: "all" },
  { label: "PENDING", value: "PENDING" },
  { label: "SENT", value: "SENT" },
  { label: "DELIVERED", value: "DELIVERED" },
  { label: "READ", value: "READ" },
  { label: "PLAYED", value: "PLAYED" },
  { label: "FAILED", value: "FAILED" },
  { label: "RECEIVED", value: "RECEIVED" },
] as const;

const BUSINESS_DAYS = [
  { day: "mon", label: "Lunes" },
  { day: "tue", label: "Martes" },
  { day: "wed", label: "Miércoles" },
  { day: "thu", label: "Jueves" },
  { day: "fri", label: "Viernes" },
  { day: "sat", label: "Sábado" },
  { day: "sun", label: "Domingo" },
] as const;

type BusinessDayForm = {
  closeTimeInMinutes: string;
  day: (typeof BUSINESS_DAYS)[number]["day"];
  mode: "appointment_only" | "open_24h" | "specific_hours";
  openTimeInMinutes: string;
};

function defaultBusinessHoursForm(): BusinessDayForm[] {
  return BUSINESS_DAYS.map(({ day }) => ({
    closeTimeInMinutes: "1080",
    day,
    mode: "specific_hours",
    openTimeInMinutes: "540",
  }));
}

function mapBusinessProfileToForm(
  profile: Awaited<ReturnType<typeof fetchWhatsappBusinessProfile>>["profile"]
) {
  const days = defaultBusinessHoursForm();
  const configByDay = new Map(
    profile?.businessHours?.config.map((item) => [item.dayOfWeek, item]) ?? []
  );

  return {
    address: profile?.address ?? "",
    days: days.map((entry) => {
      const config = configByDay.get(entry.day);
      if (!config) return entry;
      return {
        closeTimeInMinutes:
          config.mode === "specific_hours" ? String(config.closeTime ?? 1080) : "1080",
        day: entry.day,
        mode: config.mode,
        openTimeInMinutes:
          config.mode === "specific_hours" ? String(config.openTime ?? 540) : "540",
      };
    }),
    description: profile?.description ?? "",
    email: profile?.email ?? "",
    timezone: profile?.businessHours?.timezone ?? "America/Santiago",
    websites: (profile?.website ?? []).join("\n"),
  };
}

function fillWhatsappTemplatePreview(text: string) {
  return text.replace(
    /\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g,
    (_match, doubleKey: string, singleKey: string) => {
      const key = doubleKey || singleKey;
      return WHATSAPP_TEMPLATE_PREVIEW_EXAMPLE[key] ?? _match;
    }
  );
}

function renderWhatsappNotificationStatus(status: string) {
  const colorMap: Record<string, React.ComponentProps<typeof Chip>["color"]> = {
    DELIVERED: "accent",
    FAILED: "danger",
    PENDING: "warning",
    PLAYED: "accent",
    READ: "success",
    SENT: "default",
  };

  return (
    <Chip color={colorMap[status] ?? "default"} size="sm" variant="soft">
      {status}
    </Chip>
  );
}

function renderHistoryStatus(status: string) {
  const colorMap: Record<string, React.ComponentProps<typeof Chip>["color"]> = {
    DELIVERED: "accent",
    FAILED: "danger",
    PENDING: "warning",
    PLAYED: "accent",
    READ: "success",
    RECEIVED: "default",
    SENT: "default",
  };

  return (
    <Chip color={colorMap[status] ?? "default"} size="sm" variant="soft">
      {status}
    </Chip>
  );
}

function renderDirection(direction: "inbound" | "outbound") {
  return (
    <Chip color={direction === "outbound" ? "accent" : "default"} size="sm" variant="soft">
      {direction === "outbound" ? "Outbound" : "Inbound"}
    </Chip>
  );
}

export function WhatsappSettingsPage() {
  const { error: showError, success: showSuccess } = useToast();
  const { settings, updateSettings } = useSettings();
  const queryClient = useQueryClient();

  const [consentPhone, setConsentPhone] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(settings.whatsappFreeformMessage);

  const [composerKind, setComposerKind] =
    useState<WhatsappCustomMessageInput["kind"]>("contextual_text");
  const [composerPhone, setComposerPhone] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerLink, setComposerLink] = useState("");
  const [composerCaption, setComposerCaption] = useState("");
  const [composerFilename, setComposerFilename] = useState("");
  const [composerMessageId, setComposerMessageId] = useState("");
  const [composerQuotedMessageId, setComposerQuotedMessageId] = useState("");
  const [composerEmoji, setComposerEmoji] = useState("👍");
  const [locationLatitude, setLocationLatitude] = useState("");
  const [locationLongitude, setLocationLongitude] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [contactCardName, setContactCardName] = useState("");
  const [contactCardPhone, setContactCardPhone] = useState("");
  const [contactCardFirstName, setContactCardFirstName] = useState("");
  const [contactCardOrganization, setContactCardOrganization] = useState("");
  const [disappearingMode, setDisappearingMode] = useState<"off" | "1d" | "7d" | "30d">("7d");

  const [historyPhoneFilter, setHistoryPhoneFilter] = useState("");
  const [historyDirection, setHistoryDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [historyStatus, setHistoryStatus] = useState<
    "all" | "DELIVERED" | "FAILED" | "PENDING" | "PLAYED" | "READ" | "RECEIVED" | "SENT"
  >("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [chatFilter, setChatFilter] = useState<
    "all" | "archived" | "blocked" | "groups" | "unread"
  >("all");
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChatJid, setSelectedChatJid] = useState<string | null>(null);
  const [chatReplyMessageId, setChatReplyMessageId] = useState("");

  const [businessDescription, setBusinessDescription] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessWebsites, setBusinessWebsites] = useState("");
  const [businessTimezone, setBusinessTimezone] = useState("America/Santiago");
  const [businessHoursForm, setBusinessHoursForm] = useState<BusinessDayForm[]>(
    defaultBusinessHoursForm()
  );
  const [coverPhotoLink, setCoverPhotoLink] = useState("");
  const [coverPhotoIdToRemove, setCoverPhotoIdToRemove] = useState("");
  const [quickReplyTimestamp, setQuickReplyTimestamp] = useState("");
  const [quickReplyShortcut, setQuickReplyShortcut] = useState("");
  const [quickReplyMessage, setQuickReplyMessage] = useState("");
  const [quickReplyKeywords, setQuickReplyKeywords] = useState("");
  const [labelId, setLabelId] = useState("");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("0");
  const [chatLabelJid, setChatLabelJid] = useState("");
  const [chatLabelId, setChatLabelId] = useState("");
  const [messageLabelJid, setMessageLabelJid] = useState("");
  const [messageLabelId, setMessageLabelId] = useState("");
  const [messageLabelMessageId, setMessageLabelMessageId] = useState("");

  const { data: overview } = useQuery({
    ...whatsappKeys.overview(),
    refetchInterval: 30_000,
  });

  const { data: connectionStatus } = useQuery(whatsappKeys.connectionStatus());

  const { data: contactsData, isPending: contactsPending } = useQuery({
    ...whatsappKeys.contacts({
      limit: 24,
      offset: 0,
      search: contactSearch.trim() ? contactSearch : undefined,
    }),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    ...whatsappKeys.stats(),
    refetchInterval: 30_000,
  });

  const { data: notificationsData, isPending: notificationsPending } = useQuery({
    ...whatsappKeys.notifications({ limit: 15, offset: 0 }),
    refetchInterval: 30_000,
  });

  const { data: chatsData, isPending: chatsPending } = useQuery({
    ...whatsappKeys.chats({ limit: 50, offset: 0 }),
    refetchInterval: 30_000,
  });

  const chatSidebarQuery = useQuery({
    ...whatsappKeys.chatSidebar({
      filter: chatFilter,
      limit: 100,
      search: chatSearch.trim() || undefined,
    }),
    refetchInterval: 12_000,
  });

  const chatMetaQuery = useQuery({
    ...whatsappKeys.chatMeta({ jid: selectedChatJid ?? "" }),
    enabled: Boolean(selectedChatJid),
    refetchInterval: 15_000,
  });

  const chatThreadQuery = useQuery({
    ...whatsappKeys.chatThread({
      jid: selectedChatJid ?? undefined,
      limit: 120,
    }),
    enabled: Boolean(selectedChatJid),
    refetchInterval: 8_000,
  });

  const businessProfileQuery = useQuery({
    ...whatsappKeys.businessProfile(),
    refetchInterval: 60_000,
  });

  const businessQuickRepliesQuery = useQuery({
    ...whatsappKeys.businessQuickReplies(),
    refetchInterval: 60_000,
  });

  const businessLabelsQuery = useQuery({
    ...whatsappKeys.businessLabels(),
    refetchInterval: 60_000,
  });

  const businessChatLabelsQuery = useQuery({
    ...whatsappKeys.businessChatLabels({
      chatJid: chatLabelJid.trim() || undefined,
      limit: 30,
    }),
    refetchInterval: 60_000,
  });

  const businessMessageLabelsQuery = useQuery({
    ...whatsappKeys.businessMessageLabels({
      chatJid: messageLabelJid.trim() || undefined,
      limit: 30,
      messageId: messageLabelMessageId.trim() || undefined,
    }),
    refetchInterval: 60_000,
  });

  const historyQuery = useQuery({
    ...whatsappKeys.messageHistory({
      direction: historyDirection === "all" ? undefined : historyDirection,
      limit: 50,
      offset: 0,
      phone: historyPhoneFilter.trim() || undefined,
      status: historyStatus === "all" ? undefined : historyStatus,
      type: historyTypeFilter.trim() || undefined,
    }),
    refetchInterval: 15_000,
  });

  const threadQuery = useQuery({
    ...whatsappKeys.conversationThread({
      jid: selectedChatJid ?? undefined,
      limit: 100,
      phone: !selectedChatJid && historyPhoneFilter.trim() ? historyPhoneFilter.trim() : undefined,
    }),
    enabled: Boolean(selectedChatJid || historyPhoneFilter.trim()),
    refetchInterval: 15_000,
  });

  const consentMutation = useMutation({
    mutationFn: (args: { phone: string; status: "OPTED_IN" | "OPTED_OUT" }) =>
      setWhatsappContactConsent({
        phone: args.phone,
        source: "settings_whatsapp",
        status: args.status,
      }),
    onError: (err: Error) => showError(`Error al guardar consentimiento: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(
        `Consentimiento actualizado para ${result.phone}: ${result.optInStatus}`,
        "Consentimiento guardado"
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappKeys.overview().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "contacts"] }),
      ]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleWhatsappConnection,
    onError: (err: Error) => showError(`Error: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") showSuccess(result.message);
      else showError(result.message);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
  });

  const messageTemplateMutation = useMutation({
    mutationFn: async () => {
      await updateSettings({
        ...settings,
        whatsappFreeformMessage: messageTemplate,
      });
    },
    onError: (err: Error) => showError(`Error al guardar mensaje: ${err.message}`),
    onSuccess: () => showSuccess("Mensaje de WhatsApp actualizado"),
  });

  const composerMutation = useMutation({
    mutationFn: (payload: WhatsappCustomMessageInput) => sendWhatsappCustomMessage(payload),
    onError: (err: Error) => showError(`Error al enviar: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") {
        showSuccess(result.message, "Operación enviada");
      } else {
        showError(result.message, "Error de WhatsApp");
      }

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-thread"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-sidebar"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-meta"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "message-history"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "conversation-thread"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "notifications"] }),
        queryClient.invalidateQueries({ queryKey: whatsappKeys.connectionStatus().queryKey }),
      ]);
    },
  });

  const loadOlderMutation = useMutation({
    mutationFn: (args: {
      count?: number;
      jid: string;
      oldestMessageId: string;
      oldestTimestamp: Date;
    }) => loadOlderWhatsappMessages(args),
    onError: (err: Error) => showError(`Error al cargar mensajes antiguos: ${err.message}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-thread"] });
    },
  });

  const archiveChatMutation = useMutation({
    mutationFn: (args: { archive: boolean; jid: string }) =>
      archiveWhatsappChat(args.jid, args.archive),
    onError: (err: Error) => showError(`Error al archivar chat: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-sidebar"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-meta"] }),
      ]);
    },
  });

  const muteChatMutation = useMutation({
    mutationFn: (args: { jid: string; until: Date | null }) =>
      muteWhatsappChat(args.jid, args.until),
    onError: (err: Error) => showError(`Error al silenciar chat: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-sidebar"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] }),
      ]);
    },
  });

  const markChatReadMutation = useMutation({
    mutationFn: (args: { jid: string; markRead: boolean }) =>
      markWhatsappChatReadState(args.jid, args.markRead),
    onError: (err: Error) => showError(`Error al actualizar leído/no leído: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-sidebar"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] }),
      ]);
    },
  });

  const disappearingChatMutation = useMutation({
    mutationFn: (args: { duration: number; jid: string }) =>
      setWhatsappChatDisappearingMode(args.jid, args.duration),
    onError: (err: Error) => showError(`Error al cambiar temporales: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-meta"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-thread"] }),
      ]);
    },
  });

  const starMessageMutation = useMutation({
    mutationFn: (args: { jid: string; id: string; fromMe: boolean; star: boolean }) =>
      starWhatsappMessages({
        jid: args.jid,
        messages: [{ fromMe: args.fromMe, id: args.id }],
        star: args.star,
      }),
    onError: (err: Error) => showError(`Error al destacar mensaje: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-thread"] });
    },
  });

  const blockChatMutation = useMutation({
    mutationFn: (args: { action: "block" | "unblock"; jid: string }) =>
      blockWhatsappChat(args.jid, args.action),
    onError: (err: Error) => showError(`Error al bloquear chat: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-sidebar"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chat-meta"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] }),
      ]);
    },
  });

  const businessProfileMutation = useMutation({
    mutationFn: updateWhatsappBusinessProfile,
    onError: (err: Error) => showError(`Error al guardar perfil business: ${err.message}`),
    onSuccess: () => {
      showSuccess("Perfil business actualizado");
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.businessProfile().queryKey });
    },
  });

  const coverPhotoMutation = useMutation({
    mutationFn: updateWhatsappBusinessCoverPhoto,
    onError: (err: Error) => showError(`Error al actualizar cover photo: ${err.message}`),
    onSuccess: (result) => {
      setCoverPhotoIdToRemove(result.coverPhotoId);
      showSuccess(`Cover photo actualizada. ID: ${result.coverPhotoId}`);
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.businessProfile().queryKey });
    },
  });

  const removeCoverPhotoMutation = useMutation({
    mutationFn: removeWhatsappBusinessCoverPhoto,
    onError: (err: Error) => showError(`Error al eliminar cover photo: ${err.message}`),
    onSuccess: () => {
      setCoverPhotoIdToRemove("");
      showSuccess("Cover photo eliminada");
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.businessProfile().queryKey });
    },
  });

  const quickReplyMutation = useMutation({
    mutationFn: saveWhatsappBusinessQuickReply,
    onError: (err: Error) => showError(`Error al guardar quick reply: ${err.message}`),
    onSuccess: () => {
      setQuickReplyTimestamp("");
      setQuickReplyShortcut("");
      setQuickReplyMessage("");
      setQuickReplyKeywords("");
      showSuccess("Quick reply guardada");
      void queryClient.invalidateQueries({
        queryKey: whatsappKeys.businessQuickReplies().queryKey,
      });
    },
  });

  const deleteQuickReplyMutation = useMutation({
    mutationFn: deleteWhatsappBusinessQuickReply,
    onError: (err: Error) => showError(`Error al eliminar quick reply: ${err.message}`),
    onSuccess: () => {
      showSuccess("Quick reply eliminada");
      void queryClient.invalidateQueries({
        queryKey: whatsappKeys.businessQuickReplies().queryKey,
      });
    },
  });

  const labelMutation = useMutation({
    mutationFn: saveWhatsappBusinessLabel,
    onError: (err: Error) => showError(`Error al guardar label: ${err.message}`),
    onSuccess: (result) => {
      setLabelId(result.id);
      showSuccess("Label guardado");
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.businessLabels().queryKey });
    },
  });

  const chatLabelMutation = useMutation({
    mutationFn: assignWhatsappBusinessChatLabel,
    onError: (err: Error) => showError(`Error al asignar label al chat: ${err.message}`),
    onSuccess: () => {
      showSuccess("Label asignado al chat");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappKeys.businessChatLabels().queryKey }),
        queryClient.invalidateQueries({ queryKey: whatsappKeys.businessLabels().queryKey }),
      ]);
    },
  });

  const removeChatLabelMutation = useMutation({
    mutationFn: removeWhatsappBusinessChatLabel,
    onError: (err: Error) => showError(`Error al remover label del chat: ${err.message}`),
    onSuccess: () => {
      showSuccess("Label removido del chat");
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.businessChatLabels().queryKey });
    },
  });

  const messageLabelMutation = useMutation({
    mutationFn: assignWhatsappBusinessMessageLabel,
    onError: (err: Error) => showError(`Error al asignar label al mensaje: ${err.message}`),
    onSuccess: () => {
      showSuccess("Label asignado al mensaje");
      void queryClient.invalidateQueries({
        queryKey: whatsappKeys.businessMessageLabels().queryKey,
      });
    },
  });

  const removeMessageLabelMutation = useMutation({
    mutationFn: removeWhatsappBusinessMessageLabel,
    onError: (err: Error) => showError(`Error al remover label del mensaje: ${err.message}`),
    onSuccess: () => {
      showSuccess("Label removido del mensaje");
      void queryClient.invalidateQueries({
        queryKey: whatsappKeys.businessMessageLabels().queryKey,
      });
    },
  });

  const enabled = connectionStatus?.enabled ?? false;
  const connected = connectionStatus?.connectionState === "open";
  const connecting = connectionStatus?.connectionState === "connecting";
  const socketReady = connectionStatus?.isReady ?? false;

  useEffect(() => {
    setMessageTemplate(settings.whatsappFreeformMessage);
  }, [settings.whatsappFreeformMessage]);

  useEffect(() => {
    if (!businessProfileQuery.data) return;
    const form = mapBusinessProfileToForm(businessProfileQuery.data.profile);
    setBusinessAddress(form.address);
    setBusinessDescription(form.description);
    setBusinessEmail(form.email);
    setBusinessHoursForm(form.days);
    setBusinessTimezone(form.timezone);
    setBusinessWebsites(form.websites);
    setCoverPhotoIdToRemove(businessProfileQuery.data.savedCoverPhotoId ?? "");
  }, [businessProfileQuery.data]);

  useEffect(() => {
    if (!selectedChatJid) return;
    setChatLabelJid((current) => current || selectedChatJid);
    setMessageLabelJid((current) => current || selectedChatJid);
    if (selectedChatJid.endsWith("@s.whatsapp.net")) {
      setComposerPhone(selectedChatJid.replace(/@s\.whatsapp\.net$/, ""));
    }
  }, [selectedChatJid]);

  useEffect(() => {
    if (selectedChatJid) return;
    const firstChat = chatSidebarQuery.data?.records[0];
    if (firstChat?.jid) {
      setSelectedChatJid(firstChat.jid);
    }
  }, [chatSidebarQuery.data?.records, selectedChatJid]);

  const composerValidationError = useMemo(() => {
    if (!composerPhone.trim()) return "Debes ingresar un teléfono.";

    switch (composerKind) {
      case "contextual_text":
      case "edit":
        return composerBody.trim() ? null : "Debes escribir el contenido del mensaje.";
      case "image":
      case "audio":
      case "document":
      case "video":
      case "sticker":
        return composerLink.trim() ? null : "Debes ingresar la URL pública del archivo.";
      case "reaction":
        return composerMessageId.trim() && composerEmoji.trim()
          ? null
          : "Debes ingresar messageId y emoji.";
      case "mark_read":
      case "forward":
      case "delete":
        return composerMessageId.trim() ? null : "Debes ingresar el messageId objetivo.";
      case "location":
        return locationLatitude.trim() && locationLongitude.trim()
          ? null
          : "Debes ingresar latitud y longitud.";
      case "contacts":
        return contactCardName.trim() && contactCardPhone.trim()
          ? null
          : "Debes ingresar nombre y teléfono del contacto.";
      default:
        return null;
    }
  }, [
    composerBody,
    composerEmoji,
    composerKind,
    composerLink,
    composerMessageId,
    composerPhone,
    contactCardName,
    contactCardPhone,
    locationLatitude,
    locationLongitude,
  ]);

  function buildComposerPayload(): WhatsappCustomMessageInput {
    switch (composerKind) {
      case "contextual_text":
        return {
          body: composerBody.trim(),
          kind: "contextual_text",
          phone: composerPhone.trim(),
          quotedMessageId: composerQuotedMessageId.trim() || undefined,
        };
      case "image":
      case "audio":
      case "document":
      case "video":
      case "sticker":
        return {
          caption: composerCaption.trim() || undefined,
          filename: composerKind === "document" ? composerFilename.trim() || undefined : undefined,
          kind: composerKind,
          link: composerLink.trim(),
          phone: composerPhone.trim(),
        };
      case "reaction":
        return {
          emoji: composerEmoji.trim(),
          kind: "reaction",
          messageId: composerMessageId.trim(),
          phone: composerPhone.trim(),
        };
      case "mark_read":
        return {
          kind: "mark_read",
          messageId: composerMessageId.trim(),
          phone: composerPhone.trim(),
        };
      case "typing":
        return {
          kind: "typing",
          phone: composerPhone.trim(),
        };
      case "forward":
        return {
          kind: "forward",
          messageId: composerMessageId.trim(),
          phone: composerPhone.trim(),
        };
      case "delete":
        return {
          kind: "delete",
          messageId: composerMessageId.trim(),
          phone: composerPhone.trim(),
        };
      case "edit":
        return {
          body: composerBody.trim(),
          kind: "edit",
          messageId: composerMessageId.trim(),
          phone: composerPhone.trim(),
        };
      case "location":
        return {
          address: locationAddress.trim() || undefined,
          degreesLatitude: Number(locationLatitude),
          degreesLongitude: Number(locationLongitude),
          kind: "location",
          name: locationName.trim() || undefined,
          phone: composerPhone.trim(),
        };
      case "contacts":
        return {
          contacts: [
            {
              displayName: contactCardName.trim(),
              firstName: contactCardFirstName.trim() || undefined,
              organization: contactCardOrganization.trim() || undefined,
              phone: contactCardPhone.trim(),
            },
          ],
          kind: "contacts",
          phone: composerPhone.trim(),
        };
      case "disappearing_messages":
        return {
          expiration:
            disappearingMode === "off"
              ? false
              : disappearingMode === "1d"
                ? 86400
                : disappearingMode === "7d"
                  ? 604800
                  : 2592000,
          kind: "disappearing_messages",
          phone: composerPhone.trim(),
        };
    }
  }

  function prefillComposerFromHistory(args: {
    kind: "contextual_text" | "mark_read" | "reaction";
    messageId: string;
    phone: string | null;
  }) {
    if (args.phone) {
      setComposerPhone(args.phone);
    }

    if (args.kind === "contextual_text") {
      setComposerKind("contextual_text");
      setComposerQuotedMessageId(args.messageId);
      showSuccess("Quoted message ID cargado en el composer.");
      return;
    }

    setComposerKind(args.kind);
    setComposerMessageId(args.messageId);
    showSuccess(`Composer preparado para ${args.kind}.`);
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(successMessage);
    } catch {
      showError("No se pudo copiar al portapapeles.");
    }
  }

  function updateBusinessDay(
    day: BusinessDayForm["day"],
    field: keyof Omit<BusinessDayForm, "day">,
    value: string
  ) {
    setBusinessHoursForm((current) =>
      current.map((entry) =>
        entry.day !== day
          ? entry
          : field === "mode"
            ? { ...entry, mode: value as BusinessDayForm["mode"] }
            : field === "openTimeInMinutes"
              ? { ...entry, openTimeInMinutes: value }
              : { ...entry, closeTimeInMinutes: value }
      )
    );
  }

  function submitBusinessProfile() {
    const websites = businessWebsites
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    businessProfileMutation.mutate({
      address: businessAddress.trim() || undefined,
      description: businessDescription.trim() || undefined,
      email: businessEmail.trim() || undefined,
      hours: {
        days: businessHoursForm.map((entry) =>
          entry.mode === "specific_hours"
            ? {
                closeTimeInMinutes: entry.closeTimeInMinutes.trim() || "1080",
                day: entry.day,
                mode: "specific_hours" as const,
                openTimeInMinutes: entry.openTimeInMinutes.trim() || "540",
              }
            : {
                day: entry.day,
                mode: entry.mode,
              }
        ),
        timezone: businessTimezone.trim() || "America/Santiago",
      },
      websites: websites.length ? websites : undefined,
    });
  }

  const activeSidebarChat =
    chatSidebarQuery.data?.records.find((record) => record.jid === selectedChatJid) ?? null;
  const activeThread = chatThreadQuery.data ?? [];
  const oldestThreadMessage = activeThread[0] ?? null;

  return (
    <div className={PAGE_CONTAINER}>
      <Tabs defaultSelectedKey="chat">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de WhatsApp">
            <Tabs.Tab id="chat">
              Chat
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="channel">
              Canal
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="composer">
              Composer
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="history">
              Historial
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="business">
              Business
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="consent">
              Consentimiento
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="chat">
          <div className="mt-4 space-y-4">
            {!socketReady ? (
              <Alert status="warning">
                El socket todavía no está listo. La ventana de chat usa el historial persistido de
                Baileys y se vuelve realmente útil cuando el canal ya terminó de sincronizar.
              </Alert>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <Surface
                className="flex min-h-[78vh] flex-col overflow-hidden rounded-[30px] border border-default-200/80 bg-content1/85 backdrop-blur"
                variant="secondary"
              >
                <div className="border-default-200/80 border-b px-4 py-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-base">Chats</h2>
                      <Description className="text-default-500 text-xs">
                        Conversaciones recientes y presencia.
                      </Description>
                    </div>
                    <Chip size="sm" variant="soft">
                      {chatSidebarQuery.data?.records.length ?? 0}
                    </Chip>
                  </div>

                  <div className="space-y-3">
                    <TextField onChange={setChatSearch} value={chatSearch}>
                      <Label>Buscar</Label>
                      <Input placeholder="Nombre, JID o preview" />
                    </TextField>

                    <Select
                      onChange={(value) => setChatFilter(value as typeof chatFilter)}
                      value={chatFilter}
                    >
                      <Label>Filtro</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="all">Todos</ListBox.Item>
                          <ListBox.Item id="unread">No leídos</ListBox.Item>
                          <ListBox.Item id="archived">Archivados</ListBox.Item>
                          <ListBox.Item id="blocked">Bloqueados</ListBox.Item>
                          <ListBox.Item id="groups">Grupos</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                  {chatSidebarQuery.isPending ? (
                    <div className="space-y-2">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <Skeleton className="h-20 rounded-3xl" key={index} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {chatSidebarQuery.data?.records.map((chat) => {
                        const isSelected = selectedChatJid === chat.jid;

                        return (
                          <button
                            className={`w-full rounded-[24px] border px-3 py-3 text-left transition ${
                              isSelected
                                ? "border-accent/50 bg-accent/10 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                                : "border-transparent bg-transparent hover:border-default-200/80 hover:bg-content2/70"
                            }`}
                            key={chat.jid}
                            onClick={() => setSelectedChatJid(chat.jid)}
                            type="button"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-content2 text-sm font-semibold text-default-700">
                                {getChatInitials(chat.name, chat.jid)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate font-medium text-sm">
                                    {getChatDisplayName(chat.name, chat.jid)}
                                  </div>
                                  {chat.isGroup ? (
                                    <Chip size="sm" variant="soft">
                                      Grupo
                                    </Chip>
                                  ) : null}
                                </div>

                                <div className="mt-1 truncate text-default-500 text-xs">
                                  {chat.typing
                                    ? "Escribiendo…"
                                    : chat.lastMessagePreview || "Sin actividad visible"}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-[11px] text-default-400">
                                  {formatChatTimestamp(chat.lastMessageAt)}
                                </span>
                                {chat.unreadCount > 0 ? (
                                  <Chip color="accent" size="sm" variant="primary">
                                    {chat.unreadCount}
                                  </Chip>
                                ) : chat.typing ? (
                                  <Chip color="success" size="sm" variant="soft">
                                    typing
                                  </Chip>
                                ) : chat.presence ? (
                                  <Chip size="sm" variant="soft">
                                    {chat.presence}
                                  </Chip>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Surface>

              <Surface
                className="grid min-h-[78vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[34px] border border-default-200/80 bg-content1/90 backdrop-blur"
                variant="secondary"
              >
                <div className="border-default-200/80 border-b px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-content2 text-sm font-semibold text-default-700">
                        {selectedChatJid
                          ? getChatInitials(
                              chatMetaQuery.data?.name ?? activeSidebarChat?.name,
                              selectedChatJid
                            )
                          : "WA"}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-base">
                            {selectedChatJid
                              ? getChatDisplayName(
                                  chatMetaQuery.data?.name ?? activeSidebarChat?.name,
                                  selectedChatJid
                                )
                              : "Selecciona un chat"}
                          </h2>
                          {selectedChatJid ? (
                            <Chip
                              color={chatMetaQuery.data?.isBlocked ? "danger" : "default"}
                              size="sm"
                              variant="soft"
                            >
                              {chatMetaQuery.data?.isBlocked ? "Bloqueado" : "Activo"}
                            </Chip>
                          ) : null}
                          {activeSidebarChat?.typing ? (
                            <Chip color="success" size="sm" variant="soft">
                              typing…
                            </Chip>
                          ) : chatMetaQuery.data?.statusText ? (
                            <Chip size="sm" variant="soft">
                              {chatMetaQuery.data.statusText}
                            </Chip>
                          ) : null}
                        </div>

                        <Description className="text-default-500 text-xs">
                          {selectedChatJid ?? "Sin conversación activa"}
                        </Description>

                        {chatMetaQuery.data?.disappearingDuration ? (
                          <Chip color="warning" size="sm" variant="soft">
                            Temporales {chatMetaQuery.data.disappearingDuration}s
                          </Chip>
                        ) : null}
                      </div>
                    </div>

                    {selectedChatJid ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onPress={() =>
                            archiveChatMutation.mutate({
                              archive: !(activeSidebarChat?.isArchived ?? false),
                              jid: selectedChatJid,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {activeSidebarChat?.isArchived ? "Desarchivar" : "Archivar"}
                        </Button>
                        <Button
                          onPress={() =>
                            muteChatMutation.mutate({
                              jid: selectedChatJid,
                              until: activeSidebarChat?.isMuted
                                ? null
                                : dayjs().add(8, "hour").toDate(),
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {activeSidebarChat?.isMuted ? "Quitar mute" : "Silenciar 8h"}
                        </Button>
                        <Button
                          onPress={() =>
                            markChatReadMutation.mutate({
                              jid: selectedChatJid,
                              markRead: (activeSidebarChat?.unreadCount ?? 0) > 0,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {(activeSidebarChat?.unreadCount ?? 0) > 0
                            ? "Marcar leído"
                            : "Marcar no leído"}
                        </Button>
                        <Button
                          onPress={() =>
                            disappearingChatMutation.mutate({
                              duration: chatMetaQuery.data?.disappearingDuration ? 0 : 86400,
                              jid: selectedChatJid,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {chatMetaQuery.data?.disappearingDuration
                            ? "Quitar temporales"
                            : "Temporales 24h"}
                        </Button>
                        <Button
                          onPress={() =>
                            blockChatMutation.mutate({
                              action: chatMetaQuery.data?.isBlocked ? "unblock" : "block",
                              jid: selectedChatJid,
                            })
                          }
                          size="sm"
                          variant={chatMetaQuery.data?.isBlocked ? "secondary" : "danger-soft"}
                        >
                          {chatMetaQuery.data?.isBlocked ? "Desbloquear" : "Bloquear"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 overflow-hidden bg-content2/30">
                  {chatThreadQuery.isPending ? (
                    <div className="space-y-3 px-6 py-6">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <Skeleton className="h-20 rounded-3xl" key={index} />
                      ))}
                    </div>
                  ) : !selectedChatJid ? (
                    <div className="flex h-full items-center justify-center px-6 text-center text-default-500 text-sm">
                      Elige una conversación para abrir la vista tipo chat.
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto px-5 py-5">
                      {oldestThreadMessage ? (
                        <div className="sticky top-0 z-10 mb-4 flex justify-center bg-transparent pb-2">
                          <Button
                            isDisabled={loadOlderMutation.isPending}
                            onPress={() =>
                              loadOlderMutation.mutate({
                                count: 40,
                                jid: selectedChatJid,
                                oldestMessageId: oldestThreadMessage.messageId,
                                oldestTimestamp:
                                  oldestThreadMessage.createdAt ??
                                  oldestThreadMessage.messageTimestamp ??
                                  new Date(),
                              })
                            }
                            size="sm"
                            variant="secondary"
                          >
                            Cargar anteriores
                          </Button>
                        </div>
                      ) : null}

                      <div className="space-y-4">
                        {activeThread.map((message, index) => {
                          const currentDay = dayjs(
                            message.createdAt ?? message.messageTimestamp ?? new Date()
                          ).format("DD/MM/YYYY");
                          const previousDay =
                            index > 0
                              ? dayjs(
                                  activeThread[index - 1]?.createdAt ??
                                    activeThread[index - 1]?.messageTimestamp ??
                                    new Date()
                                ).format("DD/MM/YYYY")
                              : null;

                          return (
                            <Fragment key={message.messageId}>
                              {currentDay !== previousDay ? (
                                <div className="flex justify-center py-1">
                                  <span className="rounded-full border border-default-200/80 bg-content1/90 px-3 py-1 text-[11px] text-default-500">
                                    {currentDay}
                                  </span>
                                </div>
                              ) : null}

                              <div
                                className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}
                              >
                                <div className="max-w-[min(68%,42rem)]">
                                  <div
                                    className={`rounded-[24px] px-4 py-3 shadow-sm ${
                                      message.fromMe
                                        ? "bg-accent text-accent-foreground"
                                        : "border border-default-200/70 bg-content1 text-foreground"
                                    }`}
                                  >
                                    {message.quotedPreview ? (
                                      <div className="mb-3 rounded-2xl border border-black/10 bg-black/10 px-3 py-2 text-[11px] leading-relaxed">
                                        {message.quotedPreview}
                                      </div>
                                    ) : null}

                                    <div className="space-y-2">
                                      <div className="text-[15px] leading-7">
                                        {message.deletedForEveryone || message.deletedForMe
                                          ? "Mensaje eliminado"
                                          : message.textPreview || message.messageType}
                                      </div>

                                      {message.reactions.filter((reaction) => !reaction.removed)
                                        .length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {message.reactions
                                            .filter((reaction) => !reaction.removed)
                                            .map((reaction) => (
                                              <Chip
                                                key={`${reaction.messageId}-${reaction.actorJid}-${reaction.emoji}`}
                                                size="sm"
                                                variant="soft"
                                              >
                                                {reaction.emoji}
                                              </Chip>
                                            ))}
                                        </div>
                                      ) : null}

                                      <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-80">
                                        <span>
                                          {dayjs(
                                            message.createdAt ??
                                              message.messageTimestamp ??
                                              new Date()
                                          ).format("HH:mm")}
                                        </span>
                                        <span>{message.status}</span>
                                        {message.receipts.length > 0 ? (
                                          <span>{message.receipts[0]?.receiptType}</span>
                                        ) : null}
                                        <span className="rounded-full bg-black/10 px-2 py-0.5">
                                          {message.messageType}
                                        </span>
                                        {message.starred ? <span>★</span> : null}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 px-2 pt-2 text-[12px] text-default-500">
                                    <Button
                                      onPress={() => {
                                        setComposerKind("contextual_text");
                                        setComposerPhone(message.phone ?? composerPhone);
                                        setComposerQuotedMessageId(message.messageId);
                                        setChatReplyMessageId(message.messageId);
                                      }}
                                      size="sm"
                                      variant="ghost"
                                    >
                                      Responder
                                    </Button>
                                    <Button
                                      onPress={() => {
                                        setComposerKind("reaction");
                                        if (message.phone) {
                                          setComposerPhone(message.phone);
                                        }
                                        setComposerMessageId(message.messageId);
                                      }}
                                      size="sm"
                                      variant="ghost"
                                    >
                                      Reaccionar
                                    </Button>
                                    <Button
                                      onPress={() =>
                                        starMessageMutation.mutate({
                                          fromMe: message.fromMe,
                                          id: message.messageId,
                                          jid: message.remoteJid,
                                          star: !message.starred,
                                        })
                                      }
                                      size="sm"
                                      variant="ghost"
                                    >
                                      {message.starred ? "Quitar estrella" : "Destacar"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-default-200/80 border-t px-5 py-4">
                  {selectedChatJid ? (
                    <Form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (composerValidationError) {
                          showError(composerValidationError);
                          return;
                        }
                        composerMutation.mutate(buildComposerPayload());
                        setChatReplyMessageId("");
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Select
                          onChange={(value) =>
                            setComposerKind(value as WhatsappCustomMessageInput["kind"])
                          }
                          value={composerKind}
                        >
                          <Label>Tipo</Label>
                          <Select.Trigger className="min-w-42.5">
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {COMPOSER_KIND_OPTIONS.map((option) => (
                                <ListBox.Item id={option.value} key={option.value}>
                                  {option.label}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        <div className="rounded-full border border-default-200/80 bg-content2/70 px-3 py-2 text-default-500 text-xs">
                          Destino: {activeSidebarChat?.name || composerPhone || selectedChatJid}
                        </div>

                        {chatReplyMessageId ? (
                          <Chip color="accent" size="sm" variant="soft">
                            Reply listo: {chatReplyMessageId}
                          </Chip>
                        ) : null}
                      </div>

                      {activeSidebarChat?.isGroup ? (
                        <Alert status="warning">
                          La vista de grupos ya muestra historial y estado, pero el envío embebido
                          sigue orientado a 1:1.
                        </Alert>
                      ) : null}

                      {!selectedChatJid || activeSidebarChat?.isGroup ? null : (
                        <TextField onChange={setComposerPhone} value={composerPhone}>
                          <Label>Teléfono / target</Label>
                          <Input />
                        </TextField>
                      )}

                      {composerKind === "contextual_text" || composerKind === "edit" ? (
                        <TextField onChange={setComposerBody} value={composerBody}>
                          <Label>Mensaje</Label>
                          <TextArea placeholder="Escribe una respuesta clara y breve…" />
                        </TextField>
                      ) : null}

                      {["image", "audio", "document", "video", "sticker"].includes(composerKind) ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField onChange={setComposerLink} value={composerLink}>
                            <Label>URL pública</Label>
                            <Input />
                          </TextField>
                          <TextField onChange={setComposerCaption} value={composerCaption}>
                            <Label>Caption</Label>
                            <Input />
                          </TextField>
                          {composerKind === "document" ? (
                            <TextField onChange={setComposerFilename} value={composerFilename}>
                              <Label>Nombre de archivo</Label>
                              <Input />
                            </TextField>
                          ) : null}
                        </div>
                      ) : null}

                      {["reaction", "mark_read", "forward", "delete"].includes(composerKind) ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField onChange={setComposerMessageId} value={composerMessageId}>
                            <Label>messageId</Label>
                            <Input />
                          </TextField>
                          {composerKind === "reaction" ? (
                            <TextField onChange={setComposerEmoji} value={composerEmoji}>
                              <Label>Emoji</Label>
                              <Input />
                            </TextField>
                          ) : null}
                        </div>
                      ) : null}

                      {composerKind === "edit" ? (
                        <TextField onChange={setComposerMessageId} value={composerMessageId}>
                          <Label>messageId</Label>
                          <Input />
                        </TextField>
                      ) : null}

                      {composerKind === "location" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField onChange={setLocationLatitude} value={locationLatitude}>
                            <Label>Latitud</Label>
                            <Input />
                          </TextField>
                          <TextField onChange={setLocationLongitude} value={locationLongitude}>
                            <Label>Longitud</Label>
                            <Input />
                          </TextField>
                          <TextField onChange={setLocationName} value={locationName}>
                            <Label>Nombre</Label>
                            <Input />
                          </TextField>
                          <TextField onChange={setLocationAddress} value={locationAddress}>
                            <Label>Dirección</Label>
                            <Input />
                          </TextField>
                        </div>
                      ) : null}

                      {composerKind === "contacts" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField onChange={setContactCardName} value={contactCardName}>
                            <Label>Display name</Label>
                            <Input />
                          </TextField>
                          <TextField onChange={setContactCardPhone} value={contactCardPhone}>
                            <Label>Teléfono del contacto</Label>
                            <Input />
                          </TextField>
                          <TextField
                            onChange={setContactCardFirstName}
                            value={contactCardFirstName}
                          >
                            <Label>Nombre</Label>
                            <Input />
                          </TextField>
                          <TextField
                            onChange={setContactCardOrganization}
                            value={contactCardOrganization}
                          >
                            <Label>Organización</Label>
                            <Input />
                          </TextField>
                        </div>
                      ) : null}

                      {composerKind === "disappearing_messages" ? (
                        <Select
                          onChange={(value) =>
                            setDisappearingMode(value as "off" | "1d" | "7d" | "30d")
                          }
                          value={disappearingMode}
                        >
                          <Label>Duración</Label>
                          <Select.Trigger className="min-w-55">
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="off">Desactivar</ListBox.Item>
                              <ListBox.Item id="1d">1 día</ListBox.Item>
                              <ListBox.Item id="7d">7 días</ListBox.Item>
                              <ListBox.Item id="30d">30 días</ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      ) : null}

                      {composerValidationError ? (
                        <Alert status="warning">{composerValidationError}</Alert>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          isDisabled={
                            !selectedChatJid ||
                            composerMutation.isPending ||
                            Boolean(activeSidebarChat?.isGroup)
                          }
                          type="submit"
                          variant="primary"
                        >
                          <Send className="h-4 w-4" />
                          Enviar
                        </Button>
                      </div>
                    </Form>
                  ) : (
                    <div className="text-default-500 text-sm">
                      Selecciona una conversación para habilitar el composer.
                    </div>
                  )}
                </div>
              </Surface>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="channel">
          <div className="mt-4 space-y-4">
            <Surface className="flex items-center justify-between rounded-2xl border border-default-200 px-5 py-4">
              <div className="flex items-center gap-3">
                {connected ? (
                  <Wifi className="h-5 w-5 text-success" />
                ) : (
                  <WifiOff className="h-5 w-5 text-default-400" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {socketReady
                      ? "WhatsApp listo"
                      : connected
                        ? "Conectado, sincronizando..."
                        : enabled && connecting
                          ? "Conectando..."
                          : enabled
                            ? "Esperando vinculación"
                            : "WhatsApp desactivado"}
                  </p>
                  <Description className="text-default-500 text-xs">
                    {socketReady
                      ? "Socket estable, notificaciones pendientes recibidas"
                      : "Conexión directa vía Baileys"}
                  </Description>
                </div>
              </div>
              <Switch
                isDisabled={toggleMutation.isPending}
                isSelected={enabled}
                onChange={() => toggleMutation.mutate()}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </Surface>

            <Alert status="accent">
              Esta pantalla concentra sesión Baileys, composer manual, trazabilidad e historial
              persistido. El flujo Doctoralia sigue usando `WhatsappNotification`, pero el historial
              real ya sale desde el store canónico de mensajes.
            </Alert>

            {enabled && !connected ? (
              <Card>
                <Card.Content className="flex flex-col items-center gap-4 py-8">
                  {connectionStatus?.qrDataUrl ? (
                    <>
                      <img
                        alt="QR code para vincular WhatsApp"
                        className="h-64 w-64 rounded-xl border border-default-200"
                        src={connectionStatus.qrDataUrl}
                      />
                      <Description className="max-w-xs text-center text-default-500 text-xs">
                        Abre WhatsApp → Configuración → Dispositivos vinculados → Vincular un
                        dispositivo.
                      </Description>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-64 w-64 rounded-xl" />
                      <Description className="text-default-400 text-xs">
                        Esperando código QR...
                      </Description>
                    </>
                  )}
                </Card.Content>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              {overview ? (
                <Card>
                  <Card.Header>
                    <h2 className="font-semibold text-sm">Canal y automatización</h2>
                  </Card.Header>
                  <Card.Content className="flex flex-wrap gap-2">
                    <Chip color={socketReady ? "success" : "warning"} size="sm" variant="soft">
                      {socketReady ? "Socket ready" : "Socket no listo"}
                    </Chip>
                    <Chip
                      color={overview.connected ? "success" : "default"}
                      size="sm"
                      variant="soft"
                    >
                      WhatsApp {overview.connected ? "OK" : "pendiente"}
                    </Chip>
                    <Chip
                      color={overview.automaticNotificationsEnabled ? "success" : "default"}
                      size="sm"
                      variant="soft"
                    >
                      Automatización {overview.automaticNotificationsEnabled ? "ON" : "OFF"}
                    </Chip>
                    <Chip
                      color={overview.sessionReplaced ? "danger" : "default"}
                      size="sm"
                      variant="soft"
                    >
                      {overview.sessionReplaced ? "Sesión reemplazada" : "Sesión estable"}
                    </Chip>
                  </Card.Content>
                </Card>
              ) : null}

              <Card>
                <Card.Header className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  <h2 className="font-semibold text-sm">Panel técnico</h2>
                </Card.Header>
                <Card.Content className="space-y-3">
                  {connectionStatus?.isReconnectLooping ? (
                    <Alert status="warning">
                      El socket viene en loop de reconnect (`{connectionStatus.reconnectAttempts}`
                      intentos).
                    </Alert>
                  ) : null}
                  {connectionStatus?.sessionReplaced ? (
                    <Alert status="danger">
                      La sesión fue reemplazada por otro dispositivo. Requiere reconexión manual.
                    </Alert>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricPill
                      subtitle="último open"
                      title="ConnectedAt"
                      tone="success"
                      value={
                        connectionStatus?.connectedAt
                          ? dayjs(connectionStatus.connectedAt).format("DD/MM HH:mm:ss")
                          : "—"
                      }
                    />
                    <MetricPill
                      subtitle="motivo"
                      title="Disconnect"
                      tone="warning"
                      value={connectionStatus?.lastDisconnectReason ?? "—"}
                    />
                    <MetricPill
                      subtitle="attempts"
                      title="Reconnects"
                      tone="accent"
                      value={connectionStatus?.reconnectAttempts ?? 0}
                    />
                    <MetricPill
                      subtitle="delay ms"
                      title="Backoff"
                      tone="primary"
                      value={connectionStatus?.lastReconnectDelayMs ?? "—"}
                    />
                  </div>
                  <Surface
                    className="rounded-2xl border border-default-200 p-4"
                    variant="secondary"
                  >
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="font-medium">Browser:</span>{" "}
                        {connectionStatus?.browser ?? "—"}
                      </div>
                      <div>
                        <span className="font-medium">Version:</span>{" "}
                        {connectionStatus?.version ?? "—"}
                      </div>
                      <div>
                        <span className="font-medium">receivedPendingNotifications:</span>{" "}
                        {String(connectionStatus?.receivedPendingNotifications ?? false)}
                      </div>
                      <div>
                        <span className="font-medium">connectionState:</span>{" "}
                        {connectionStatus?.connectionState ?? "—"}
                      </div>
                    </div>
                  </Surface>
                </Card.Content>
              </Card>

              <Card className="xl:col-span-2">
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-sm">Mensaje automático</h2>
                  <Description className="text-default-500 text-xs">
                    Se usa para reservas de Doctoralia. Variables disponibles: {"{{patientName}}"},{" "}
                    {"{{appointmentDate}}"}, {"{{appointmentDoctor}}"}, {"{{appointmentService}}"} y{" "}
                    {"{{clinicAddress}}"}.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <TextField value={messageTemplate} onChange={setMessageTemplate}>
                    <Label>Mensaje automático</Label>
                    <TextArea
                      className="w-full"
                      placeholder="Escribe el mensaje que se enviará por WhatsApp..."
                      rows={14}
                      variant="secondary"
                    />
                    <Description>
                      Usa formato de WhatsApp como *negrita* y saltos de línea.
                    </Description>
                  </TextField>
                  <Surface
                    className="space-y-3 rounded-2xl border border-default-200 p-4"
                    variant="secondary"
                  >
                    <div className="font-semibold text-default-700 text-xs uppercase tracking-wide">
                      Vista previa
                    </div>
                    <Surface
                      className="rounded-[24px] border border-default-200 bg-default-50 px-4 py-3 shadow-sm"
                      variant="secondary"
                    >
                      <div className="mb-2 text-default-500 text-[11px]">WhatsApp</div>
                      <div className="space-y-1 whitespace-pre-wrap wrap-break-word text-foreground text-sm leading-6">
                        {renderWhatsappPreview(
                          fillWhatsappTemplatePreview(
                            messageTemplate.trim() ||
                              "Se usará el mensaje por defecto del sistema si este campo queda vacío."
                          )
                        )}
                      </div>
                    </Surface>
                  </Surface>
                  <div className="flex justify-end">
                    <Button
                      isDisabled={messageTemplateMutation.isPending}
                      isPending={messageTemplateMutation.isPending}
                      onPress={() => messageTemplateMutation.mutate()}
                      size="sm"
                      variant="primary"
                    >
                      Guardar mensaje
                    </Button>
                  </div>
                </Card.Content>
              </Card>

              {stats ? (
                <Card>
                  <Card.Header>
                    <h2 className="font-semibold text-sm">Mensajes automatizados</h2>
                  </Card.Header>
                  <Card.Content className="grid grid-cols-2 gap-3">
                    <MetricPill
                      subtitle="notif."
                      title="Enviados"
                      tone="primary"
                      value={stats.sent}
                    />
                    <MetricPill
                      subtitle="notif."
                      title="Entregados"
                      tone="success"
                      value={stats.delivered}
                    />
                    <MetricPill subtitle="notif." title="Leídos" tone="accent" value={stats.read} />
                    <MetricPill
                      subtitle="notif."
                      title="Fallidos"
                      tone="warning"
                      value={stats.failed}
                    />
                  </Card.Content>
                </Card>
              ) : null}

              <Card className="xl:col-span-2">
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-sm">Envíos recientes</h2>
                  <Description className="text-default-500 text-xs">
                    Últimos registros legacy en `WhatsappNotification`.
                  </Description>
                </Card.Header>
                <Card.Content>
                  <Table variant="secondary">
                    <Table.ScrollContainer className="max-h-90">
                      <Table.Content aria-label="Envíos recientes de WhatsApp">
                        <Table.Header>
                          <Table.Column isRowHeader>Paciente</Table.Column>
                          <Table.Column>Teléfono</Table.Column>
                          <Table.Column>Estado</Table.Column>
                          <Table.Column>WA ID</Table.Column>
                          <Table.Column>Enviado</Table.Column>
                        </Table.Header>
                        <Table.Body
                          items={notificationsData?.notifications ?? []}
                          renderEmptyState={() => (
                            <div className="px-3 py-6 text-center text-default-500 text-sm">
                              {notificationsPending
                                ? "Cargando envíos..."
                                : "Aún no hay mensajes registrados."}
                            </div>
                          )}
                        >
                          {(notification) => (
                            <Table.Row id={notification.id}>
                              <Table.Cell>
                                <div className="min-w-0">
                                  <div className="font-medium">{notification.patientName}</div>
                                  <div className="truncate text-default-500 text-xs">
                                    {notification.appointmentService ?? "Sin servicio"}
                                  </div>
                                </div>
                              </Table.Cell>
                              <Table.Cell>{notification.patientPhone || "—"}</Table.Cell>
                              <Table.Cell>
                                {renderWhatsappNotificationStatus(notification.status)}
                              </Table.Cell>
                              <Table.Cell>{notification.waMessageId ?? "—"}</Table.Cell>
                              <Table.Cell>
                                {notification.sentAt
                                  ? dayjs(notification.sentAt).format("DD/MM HH:mm")
                                  : "—"}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </Card.Content>
              </Card>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="composer">
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Composer avanzado</h2>
                <Description className="text-default-500 text-xs">
                  Usa el backend existente de Baileys. Para media el flujo sigue siendo URL-first.
                </Description>
              </Card.Header>
              <Card.Content>
                <Form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!socketReady) {
                      showError("WhatsApp no está listo para enviar.");
                      return;
                    }
                    if (composerValidationError) {
                      showError(composerValidationError);
                      return;
                    }
                    composerMutation.mutate(buildComposerPayload());
                  }}
                  validationBehavior="aria"
                >
                  <Select
                    onChange={(value) =>
                      setComposerKind(value as WhatsappCustomMessageInput["kind"])
                    }
                    value={composerKind}
                  >
                    <Label>Tipo de mensaje</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {COMPOSER_KIND_OPTIONS.map((option) => (
                          <ListBox.Item id={option.value} key={option.value}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <TextField onChange={setComposerPhone} value={composerPhone}>
                    <Label>Teléfono destino</Label>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>

                  {renderComposerFields({
                    composerBody,
                    composerCaption,
                    composerEmoji,
                    composerFilename,
                    composerKind,
                    composerLink,
                    composerMessageId,
                    composerQuotedMessageId,
                    contactCardFirstName,
                    contactCardName,
                    contactCardOrganization,
                    contactCardPhone,
                    disappearingMode,
                    locationAddress,
                    locationLatitude,
                    locationLongitude,
                    locationName,
                    setComposerBody,
                    setComposerCaption,
                    setComposerEmoji,
                    setComposerFilename,
                    setComposerLink,
                    setComposerMessageId,
                    setComposerQuotedMessageId,
                    setContactCardFirstName,
                    setContactCardName,
                    setContactCardOrganization,
                    setContactCardPhone,
                    setDisappearingMode,
                    setLocationAddress,
                    setLocationLatitude,
                    setLocationLongitude,
                    setLocationName,
                  })}

                  {composerValidationError ? (
                    <Alert status="warning">{composerValidationError}</Alert>
                  ) : null}
                  {!socketReady ? (
                    <Alert status="danger">
                      El socket no está listo. Debe estar `open` y haber recibido pending
                      notifications.
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      isDisabled={composerMutation.isPending || !socketReady}
                      isPending={composerMutation.isPending}
                      size="sm"
                      type="submit"
                      variant="primary"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Button>
                    <Chip color={socketReady ? "success" : "danger"} size="sm" variant="soft">
                      {socketReady ? "Socket ready" : "Socket no listo"}
                    </Chip>
                    <Chip color="default" size="sm" variant="soft">
                      messageId: visible en Historial
                    </Chip>
                  </div>

                  {composerMutation.data ? (
                    <Alert status={composerMutation.data.status === "ok" ? "success" : "danger"}>
                      {composerMutation.data.message}
                    </Alert>
                  ) : null}
                </Form>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Notas operativas</h2>
                <Description className="text-default-500 text-xs">
                  Algunos tipos requieren un `messageId` previo del historial persistido.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <Surface className="rounded-2xl border border-default-200 p-4" variant="secondary">
                  <div className="font-medium text-sm">Tipos soportados ahora</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COMPOSER_KIND_OPTIONS.map((option) => (
                      <Chip key={option.value} size="sm" variant="soft">
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </Surface>

                <Alert status="default">
                  `reaction`, `mark_read`, `forward`, `delete` y `edit` necesitan `messageId` de
                  destino.
                </Alert>
                <Alert status="default">
                  `contextual_text` puede citar un mensaje si cargas `quotedMessageId`.
                </Alert>
                <Alert status="default">
                  `image`, `video`, `audio`, `document` y `sticker` requieren URL pública accesible
                  por el servidor.
                </Alert>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="history">
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Chats sincronizados</h2>
                  <Description className="text-default-500 text-xs">
                    Chats persistidos desde history sync y eventos live.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  {chatsPending ? (
                    <Skeleton className="h-64 w-full rounded-2xl" />
                  ) : chatsData?.records.length ? (
                    chatsData.records.map((chat) => (
                      <Button
                        key={chat.jid}
                        className={`h-auto justify-start rounded-2xl border px-4 py-3 ${
                          selectedChatJid === chat.jid
                            ? "border-primary bg-primary/5"
                            : "border-default-200"
                        }`}
                        onPress={() => setSelectedChatJid(chat.jid)}
                        variant="ghost"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-sm">{chat.name || chat.jid}</div>
                            <Description className="text-default-500 text-xs">
                              {chat.jid}
                            </Description>
                            <Description className="text-default-500 text-xs">
                              Última conversación:{" "}
                              {chat.conversationTimestamp
                                ? dayjs(chat.conversationTimestamp).format("DD/MM/YYYY HH:mm")
                                : "—"}
                            </Description>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Chip size="sm" variant="soft">
                              unread {chat.unreadCount ?? 0}
                            </Chip>
                            {chat.pinned ? (
                              <Chip color="accent" size="sm" variant="soft">
                                pinned
                              </Chip>
                            ) : null}
                          </div>
                        </div>
                      </Button>
                    ))
                  ) : (
                    <Alert status="default">Todavía no hay chats persistidos.</Alert>
                  )}
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Thread</h2>
                  <Description className="text-default-500 text-xs">
                    Selecciona un chat o filtra por teléfono para ver la conversación.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  <TextField onChange={setHistoryPhoneFilter} value={historyPhoneFilter}>
                    <Label>Filtrar por teléfono</Label>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>

                  {threadQuery.isPending ? (
                    <Skeleton className="h-64 w-full rounded-2xl" />
                  ) : threadQuery.data?.length ? (
                    <div className="max-h-135 space-y-3 overflow-y-auto pr-1">
                      {threadQuery.data.map((record) => (
                        <Surface
                          key={`${record.remoteJid}-${record.messageId}-${record.createdAt.toISOString()}`}
                          className="rounded-2xl border border-default-200 p-4"
                          variant="secondary"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {renderDirection(record.direction)}
                            {renderHistoryStatus(record.status)}
                            <Chip size="sm" variant="soft">
                              {record.messageType}
                            </Chip>
                            <span className="text-default-500 text-xs">
                              {dayjs(record.createdAt).format("DD/MM HH:mm:ss")}
                            </span>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm">
                            {record.textPreview || "Sin preview textual"}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              onPress={() => copyToClipboard(record.messageId, "messageId copiado")}
                              size="sm"
                              variant="secondary"
                            >
                              <ClipboardCopy className="h-4 w-4" />
                              Copiar ID
                            </Button>
                            <Button
                              onPress={() =>
                                prefillComposerFromHistory({
                                  kind: "reaction",
                                  messageId: record.messageId,
                                  phone: record.phone ?? null,
                                })
                              }
                              size="sm"
                              variant="secondary"
                            >
                              Reacción
                            </Button>
                            <Button
                              onPress={() =>
                                prefillComposerFromHistory({
                                  kind: "mark_read",
                                  messageId: record.messageId,
                                  phone: record.phone ?? null,
                                })
                              }
                              size="sm"
                              variant="secondary"
                            >
                              Marcar leído
                            </Button>
                            <Button
                              onPress={() =>
                                prefillComposerFromHistory({
                                  kind: "contextual_text",
                                  messageId: record.messageId,
                                  phone: record.phone ?? null,
                                })
                              }
                              size="sm"
                              variant="secondary"
                            >
                              Citar
                            </Button>
                          </div>
                        </Surface>
                      ))}
                    </div>
                  ) : (
                    <Alert status="default">
                      {selectedChatJid || historyPhoneFilter.trim()
                        ? "No hay mensajes en ese thread."
                        : "Selecciona un chat o ingresa un teléfono."}
                    </Alert>
                  )}
                </Card.Content>
              </Card>
            </div>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Historial canónico inbound / outbound</h2>
                <Description className="text-default-500 text-xs">
                  Fuente: `whatsapp_messages`. Aquí vive la trazabilidad real de Baileys.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-4">
                  <Select
                    onChange={(value) => setHistoryDirection(value as typeof historyDirection)}
                    value={historyDirection}
                  >
                    <Label>Dirección</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {HISTORY_DIRECTION_OPTIONS.map((option) => (
                          <ListBox.Item id={option.value} key={option.value}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <Select
                    onChange={(value) => setHistoryStatus(value as typeof historyStatus)}
                    value={historyStatus}
                  >
                    <Label>Estado</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {HISTORY_STATUS_OPTIONS.map((option) => (
                          <ListBox.Item id={option.value} key={option.value}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <TextField onChange={setHistoryTypeFilter} value={historyTypeFilter}>
                    <Label>Tipo</Label>
                    <Input placeholder="image, conversation, reaction..." type="text" />
                  </TextField>

                  <TextField onChange={setHistoryPhoneFilter} value={historyPhoneFilter}>
                    <Label>Teléfono</Label>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>
                </div>

                <Table variant="secondary">
                  <Table.ScrollContainer className="max-h-105">
                    <Table.Content aria-label="Historial real de WhatsApp">
                      <Table.Header>
                        <Table.Column isRowHeader>Mensaje</Table.Column>
                        <Table.Column>Dir.</Table.Column>
                        <Table.Column>Tipo</Table.Column>
                        <Table.Column>Estado</Table.Column>
                        <Table.Column>Teléfono</Table.Column>
                        <Table.Column>Creado</Table.Column>
                        <Table.Column>Acciones</Table.Column>
                      </Table.Header>
                      <Table.Body
                        items={historyQuery.data?.records ?? []}
                        renderEmptyState={() => (
                          <div className="px-3 py-6 text-center text-default-500 text-sm">
                            {historyQuery.isPending
                              ? "Cargando historial..."
                              : "No hay mensajes con esos filtros."}
                          </div>
                        )}
                      >
                        {(record) => (
                          <Table.Row id={`${record.remoteJid}-${record.messageId}`}>
                            <Table.Cell>
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {record.textPreview || record.messageId}
                                </div>
                                <div className="truncate text-default-500 text-xs">
                                  {record.messageId}
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell>{renderDirection(record.direction)}</Table.Cell>
                            <Table.Cell>
                              <Chip size="sm" variant="soft">
                                {record.messageType}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell>{renderHistoryStatus(record.status)}</Table.Cell>
                            <Table.Cell>{record.phone ?? "—"}</Table.Cell>
                            <Table.Cell>{dayjs(record.createdAt).format("DD/MM HH:mm")}</Table.Cell>
                            <Table.Cell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  onPress={() =>
                                    copyToClipboard(record.messageId, "messageId copiado")
                                  }
                                  size="sm"
                                  variant="secondary"
                                >
                                  <ClipboardCopy className="h-4 w-4" />
                                </Button>
                                <Button
                                  onPress={() =>
                                    prefillComposerFromHistory({
                                      kind: "reaction",
                                      messageId: record.messageId,
                                      phone: record.phone ?? null,
                                    })
                                  }
                                  size="sm"
                                  variant="secondary"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  onPress={() =>
                                    prefillComposerFromHistory({
                                      kind: "mark_read",
                                      messageId: record.messageId,
                                      phone: record.phone ?? null,
                                    })
                                  }
                                  size="sm"
                                  variant="secondary"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="business">
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Business profile</h2>
                  <Description className="text-default-500 text-xs">
                    Perfil comercial del canal: descripción, contacto, sitios y horario.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  {!socketReady ? (
                    <Alert status="warning">
                      El socket debe estar listo para leer o actualizar el business profile.
                    </Alert>
                  ) : null}

                  <TextField onChange={setBusinessDescription} value={businessDescription}>
                    <Label>Descripción</Label>
                    <TextArea
                      placeholder="Atención clínica, alergología, contacto..."
                      rows={4}
                      variant="secondary"
                    />
                  </TextField>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField onChange={setBusinessEmail} value={businessEmail}>
                      <Label>Email</Label>
                      <Input placeholder="contacto@bioalergia.cl" type="email" />
                    </TextField>

                    <TextField onChange={setBusinessTimezone} value={businessTimezone}>
                      <Label>Timezone</Label>
                      <Input placeholder="America/Santiago" type="text" />
                    </TextField>
                  </div>

                  <TextField onChange={setBusinessAddress} value={businessAddress}>
                    <Label>Dirección</Label>
                    <Input placeholder="Av. Ejemplo 123, Providencia" type="text" />
                  </TextField>

                  <TextField onChange={setBusinessWebsites} value={businessWebsites}>
                    <Label>Websites</Label>
                    <TextArea
                      placeholder={"https://bioalergia.cl\nhttps://agenda.bioalergia.cl"}
                      rows={3}
                      variant="secondary"
                    />
                    <Description>Una URL por línea.</Description>
                  </TextField>

                  <Surface
                    className="space-y-3 rounded-2xl border border-default-200 p-4"
                    variant="secondary"
                  >
                    <div className="font-medium text-sm">Horario</div>
                    <div className="grid gap-3">
                      {BUSINESS_DAYS.map((day) => {
                        const entry = businessHoursForm.find((item) => item.day === day.day);
                        if (!entry) return null;

                        return (
                          <div
                            key={day.day}
                            className="grid gap-3 rounded-2xl border border-default-200 p-3 md:grid-cols-[0.9fr_1.1fr_0.7fr_0.7fr]"
                          >
                            <div className="font-medium text-sm">{day.label}</div>
                            <Select
                              onChange={(value) =>
                                updateBusinessDay(day.day, "mode", value as BusinessDayForm["mode"])
                              }
                              value={entry.mode}
                            >
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  <ListBox.Item id="specific_hours">
                                    Horario específico
                                  </ListBox.Item>
                                  <ListBox.Item id="open_24h">24 horas</ListBox.Item>
                                  <ListBox.Item id="appointment_only">Solo cita</ListBox.Item>
                                </ListBox>
                              </Select.Popover>
                            </Select>
                            <TextField
                              isDisabled={entry.mode !== "specific_hours"}
                              onChange={(value) =>
                                updateBusinessDay(day.day, "openTimeInMinutes", value)
                              }
                              value={entry.openTimeInMinutes}
                            >
                              <Input placeholder="540" type="number" />
                            </TextField>
                            <TextField
                              isDisabled={entry.mode !== "specific_hours"}
                              onChange={(value) =>
                                updateBusinessDay(day.day, "closeTimeInMinutes", value)
                              }
                              value={entry.closeTimeInMinutes}
                            >
                              <Input placeholder="1080" type="number" />
                            </TextField>
                          </div>
                        );
                      })}
                    </div>
                  </Surface>

                  <div className="flex justify-end">
                    <Button
                      isDisabled={!socketReady || businessProfileMutation.isPending}
                      isPending={businessProfileMutation.isPending}
                      onPress={submitBusinessProfile}
                      size="sm"
                      variant="primary"
                    >
                      Guardar profile
                    </Button>
                  </div>
                </Card.Content>
              </Card>

              <div className="space-y-4">
                <Card>
                  <Card.Header className="flex flex-col items-start gap-1">
                    <h2 className="font-semibold text-base">Cover photo</h2>
                    <Description className="text-default-500 text-xs">
                      Baileys expone `updateCoverPhoto` y `removeCoverPhoto`. Se conserva el último
                      ID usado.
                    </Description>
                  </Card.Header>
                  <Card.Content className="space-y-4">
                    <TextField onChange={setCoverPhotoLink} value={coverPhotoLink}>
                      <Label>URL pública de imagen</Label>
                      <Input placeholder="https://..." type="url" />
                    </TextField>
                    <div className="flex gap-2">
                      <Button
                        isDisabled={
                          !socketReady || !coverPhotoLink.trim() || coverPhotoMutation.isPending
                        }
                        isPending={coverPhotoMutation.isPending}
                        onPress={() => coverPhotoMutation.mutate(coverPhotoLink.trim())}
                        size="sm"
                        variant="primary"
                      >
                        Actualizar cover
                      </Button>
                    </div>
                    <TextField onChange={setCoverPhotoIdToRemove} value={coverPhotoIdToRemove}>
                      <Label>Cover photo ID</Label>
                      <Input placeholder="ID retornado por Baileys" type="text" />
                    </TextField>
                    <Button
                      isDisabled={
                        !socketReady ||
                        !coverPhotoIdToRemove.trim() ||
                        removeCoverPhotoMutation.isPending
                      }
                      isPending={removeCoverPhotoMutation.isPending}
                      onPress={() => removeCoverPhotoMutation.mutate(coverPhotoIdToRemove.trim())}
                      size="sm"
                      variant="secondary"
                    >
                      Eliminar cover
                    </Button>
                  </Card.Content>
                </Card>

                <Card>
                  <Card.Header className="flex flex-col items-start gap-1">
                    <h2 className="font-semibold text-base">Quick replies</h2>
                    <Description className="text-default-500 text-xs">
                      Gestión local + write-through a Baileys para respuestas rápidas del canal.
                    </Description>
                  </Card.Header>
                  <Card.Content className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField onChange={setQuickReplyShortcut} value={quickReplyShortcut}>
                        <Label>Shortcut</Label>
                        <Input placeholder="/hola" type="text" />
                      </TextField>
                      <TextField onChange={setQuickReplyTimestamp} value={quickReplyTimestamp}>
                        <Label>Timestamp</Label>
                        <Input placeholder="auto si está vacío" type="text" />
                      </TextField>
                    </div>
                    <TextField onChange={setQuickReplyMessage} value={quickReplyMessage}>
                      <Label>Mensaje</Label>
                      <TextArea
                        placeholder="Hola, ¿cómo podemos ayudarte?"
                        rows={4}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField onChange={setQuickReplyKeywords} value={quickReplyKeywords}>
                      <Label>Keywords</Label>
                      <Input placeholder="hola, recepción, agenda" type="text" />
                    </TextField>
                    <Button
                      isDisabled={
                        !socketReady ||
                        !quickReplyShortcut.trim() ||
                        !quickReplyMessage.trim() ||
                        quickReplyMutation.isPending
                      }
                      isPending={quickReplyMutation.isPending}
                      onPress={() =>
                        quickReplyMutation.mutate({
                          keywords: quickReplyKeywords
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                          message: quickReplyMessage.trim(),
                          shortcut: quickReplyShortcut.trim(),
                          timestamp: quickReplyTimestamp.trim() || undefined,
                        })
                      }
                      size="sm"
                      variant="primary"
                    >
                      Guardar quick reply
                    </Button>

                    <div className="space-y-3">
                      {businessQuickRepliesQuery.isPending ? (
                        <Skeleton className="h-36 w-full rounded-2xl" />
                      ) : businessQuickRepliesQuery.data?.records.length ? (
                        businessQuickRepliesQuery.data.records.map((record) => (
                          <Surface
                            key={record.timestamp}
                            className="rounded-2xl border border-default-200 p-4"
                            variant="secondary"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-medium text-sm">{record.shortcut}</div>
                                <Description className="text-default-500 text-xs">
                                  {record.timestamp} ·{" "}
                                  {record.keywords.join(", ") || "sin keywords"}
                                </Description>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onPress={() => {
                                    setQuickReplyTimestamp(record.timestamp);
                                    setQuickReplyShortcut(record.shortcut);
                                    setQuickReplyMessage(record.message);
                                    setQuickReplyKeywords(record.keywords.join(", "));
                                  }}
                                  size="sm"
                                  variant="secondary"
                                >
                                  Editar
                                </Button>
                                <Button
                                  isDisabled={deleteQuickReplyMutation.isPending}
                                  onPress={() => deleteQuickReplyMutation.mutate(record.timestamp)}
                                  size="sm"
                                  variant="secondary"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm">{record.message}</div>
                          </Surface>
                        ))
                      ) : (
                        <Alert status="default">Todavía no hay quick replies registradas.</Alert>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Labels</h2>
                  <Description className="text-default-500 text-xs">
                    Labels del canal y asociaciones locales sincronizadas cuando Baileys emite
                    eventos.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextField onChange={setLabelId} value={labelId}>
                      <Label>ID</Label>
                      <Input placeholder="auto si está vacío" type="text" />
                    </TextField>
                    <TextField onChange={setLabelName} value={labelName}>
                      <Label>Nombre</Label>
                      <Input placeholder="Paciente nuevo" type="text" />
                    </TextField>
                    <TextField onChange={setLabelColor} value={labelColor}>
                      <Label>Color (0-19)</Label>
                      <Input placeholder="0" type="number" />
                    </TextField>
                  </div>
                  <Button
                    isDisabled={!socketReady || !labelName.trim() || labelMutation.isPending}
                    isPending={labelMutation.isPending}
                    onPress={() =>
                      labelMutation.mutate({
                        color: labelColor.trim() === "" ? null : Number(labelColor),
                        id: labelId.trim() || undefined,
                        name: labelName.trim(),
                      })
                    }
                    size="sm"
                    variant="primary"
                  >
                    Guardar label
                  </Button>

                  <div className="space-y-3">
                    {businessLabelsQuery.isPending ? (
                      <Skeleton className="h-36 w-full rounded-2xl" />
                    ) : businessLabelsQuery.data?.records.length ? (
                      businessLabelsQuery.data.records.map((record) => (
                        <Surface
                          key={record.id}
                          className="rounded-2xl border border-default-200 p-4"
                          variant="secondary"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium text-sm">{record.name || record.id}</div>
                              <Description className="text-default-500 text-xs">
                                ID: {record.id} · color: {record.color ?? "—"}
                              </Description>
                            </div>
                            <Button
                              onPress={() => {
                                setLabelId(record.id);
                                setLabelName(record.name ?? "");
                                setLabelColor(record.color != null ? String(record.color) : "");
                                setChatLabelId(record.id);
                                setMessageLabelId(record.id);
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              Editar
                            </Button>
                          </div>
                        </Surface>
                      ))
                    ) : (
                      <Alert status="default">Todavía no hay labels registradas.</Alert>
                    )}
                  </div>
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Asignaciones de labels</h2>
                  <Description className="text-default-500 text-xs">
                    Usa el `jid` del chat y, para mensajes, también el `messageId`. Puedes copiarlos
                    desde Historial.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-5">
                  <Surface
                    className="space-y-3 rounded-2xl border border-default-200 p-4"
                    variant="secondary"
                  >
                    <div className="font-medium text-sm">Chat labels</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField onChange={setChatLabelJid} value={chatLabelJid}>
                        <Label>Chat JID</Label>
                        <Input
                          placeholder={selectedChatJid ?? "569...@s.whatsapp.net"}
                          type="text"
                        />
                      </TextField>
                      <TextField onChange={setChatLabelId} value={chatLabelId}>
                        <Label>Label ID</Label>
                        <Input placeholder="label id" type="text" />
                      </TextField>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        isDisabled={
                          !socketReady ||
                          !chatLabelJid.trim() ||
                          !chatLabelId.trim() ||
                          chatLabelMutation.isPending
                        }
                        isPending={chatLabelMutation.isPending}
                        onPress={() =>
                          chatLabelMutation.mutate({
                            chatJid: chatLabelJid.trim(),
                            labelId: chatLabelId.trim(),
                          })
                        }
                        size="sm"
                        variant="primary"
                      >
                        Asignar al chat
                      </Button>
                      <Button
                        isDisabled={
                          !socketReady ||
                          !chatLabelJid.trim() ||
                          !chatLabelId.trim() ||
                          removeChatLabelMutation.isPending
                        }
                        isPending={removeChatLabelMutation.isPending}
                        onPress={() =>
                          removeChatLabelMutation.mutate({
                            chatJid: chatLabelJid.trim(),
                            labelId: chatLabelId.trim(),
                          })
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Remover del chat
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {businessChatLabelsQuery.data?.records.map((record) => (
                        <div
                          key={`${record.chatJid}-${record.labelId}`}
                          className="rounded-xl border border-default-200 px-3 py-2 text-sm"
                        >
                          {record.chatJid} · {record.labelName || record.labelId}
                        </div>
                      )) ?? null}
                    </div>
                  </Surface>

                  <Surface
                    className="space-y-3 rounded-2xl border border-default-200 p-4"
                    variant="secondary"
                  >
                    <div className="font-medium text-sm">Message labels</div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <TextField onChange={setMessageLabelJid} value={messageLabelJid}>
                        <Label>Chat JID</Label>
                        <Input
                          placeholder={selectedChatJid ?? "569...@s.whatsapp.net"}
                          type="text"
                        />
                      </TextField>
                      <TextField onChange={setMessageLabelMessageId} value={messageLabelMessageId}>
                        <Label>Message ID</Label>
                        <Input placeholder="ABGGFl..." type="text" />
                      </TextField>
                      <TextField onChange={setMessageLabelId} value={messageLabelId}>
                        <Label>Label ID</Label>
                        <Input placeholder="label id" type="text" />
                      </TextField>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        isDisabled={
                          !socketReady ||
                          !messageLabelJid.trim() ||
                          !messageLabelId.trim() ||
                          !messageLabelMessageId.trim() ||
                          messageLabelMutation.isPending
                        }
                        isPending={messageLabelMutation.isPending}
                        onPress={() =>
                          messageLabelMutation.mutate({
                            chatJid: messageLabelJid.trim(),
                            labelId: messageLabelId.trim(),
                            messageId: messageLabelMessageId.trim(),
                          })
                        }
                        size="sm"
                        variant="primary"
                      >
                        Asignar al mensaje
                      </Button>
                      <Button
                        isDisabled={
                          !socketReady ||
                          !messageLabelJid.trim() ||
                          !messageLabelId.trim() ||
                          !messageLabelMessageId.trim() ||
                          removeMessageLabelMutation.isPending
                        }
                        isPending={removeMessageLabelMutation.isPending}
                        onPress={() =>
                          removeMessageLabelMutation.mutate({
                            chatJid: messageLabelJid.trim(),
                            labelId: messageLabelId.trim(),
                            messageId: messageLabelMessageId.trim(),
                          })
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Remover del mensaje
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {businessMessageLabelsQuery.data?.records.map((record) => (
                        <div
                          key={`${record.chatJid}-${record.messageId}-${record.labelId}`}
                          className="rounded-xl border border-default-200 px-3 py-2 text-sm"
                        >
                          {record.messageId} · {record.labelName || record.labelId}
                        </div>
                      )) ?? null}
                    </div>
                  </Surface>
                </Card.Content>
              </Card>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="consent">
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Registrar consentimiento</h2>
                <Description className="text-default-500 text-xs">
                  Usa esto para marcar manualmente un número como opt-in u opt-out.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setConsentPhone} value={consentPhone}>
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    isDisabled={consentMutation.isPending || !consentPhone.trim()}
                    isPending={consentMutation.isPending}
                    onPress={() =>
                      consentMutation.mutate({ phone: consentPhone, status: "OPTED_IN" })
                    }
                    size="sm"
                    variant="primary"
                  >
                    Marcar opt-in
                  </Button>
                  <Button
                    isDisabled={consentMutation.isPending || !consentPhone.trim()}
                    onPress={() =>
                      consentMutation.mutate({ phone: consentPhone, status: "OPTED_OUT" })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Marcar opt-out
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricPill
                    subtitle="contactos"
                    title="Opt-in"
                    tone="success"
                    value={overview?.optedInContacts ?? 0}
                  />
                  <MetricPill
                    subtitle="contactos"
                    title="Opt-out"
                    tone="warning"
                    value={overview?.optedOutContacts ?? 0}
                  />
                  <MetricPill
                    subtitle="contactos"
                    title="Sin estado"
                    tone="accent"
                    value={overview?.unknownConsentContacts ?? 0}
                  />
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Contactos conocidos</h2>
                <Description className="text-default-500 text-xs">
                  Estado de consentimiento, última actividad y expiración de ventana por teléfono.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setContactSearch} value={contactSearch}>
                  <Input placeholder="Buscar por teléfono o wa_id" type="search" />
                </TextField>

                {contactsPending ? (
                  <Skeleton className="h-64 w-full rounded-2xl" />
                ) : contactsData?.contacts.length ? (
                  <div className="grid gap-3">
                    {contactsData.contacts.map((contact) => (
                      <Surface
                        key={contact.phone}
                        className="rounded-2xl border border-default-200 px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">{contact.phone}</p>
                              <Chip
                                color={
                                  contact.optInStatus === "OPTED_IN"
                                    ? "success"
                                    : contact.optInStatus === "OPTED_OUT"
                                      ? "danger"
                                      : "warning"
                                }
                                size="sm"
                                variant="soft"
                              >
                                {contact.optInStatus}
                              </Chip>
                            </div>
                            <Description className="text-default-500 text-xs">
                              wa_id: {contact.waId ?? "—"} · fuente: {contact.optInSource ?? "—"}
                            </Description>
                            <Description className="text-default-500 text-xs">
                              Último inbound:{" "}
                              {contact.lastInboundAt
                                ? dayjs(contact.lastInboundAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                              {" · "}Última llamada:{" "}
                              {contact.lastInboundCallAt
                                ? dayjs(contact.lastInboundCallAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                            </Description>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              onPress={() => {
                                setConsentPhone(contact.phone);
                                consentMutation.mutate({
                                  phone: contact.phone,
                                  status: "OPTED_IN",
                                });
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              Opt-in
                            </Button>
                            <Button
                              onPress={() => {
                                setConsentPhone(contact.phone);
                                consentMutation.mutate({
                                  phone: contact.phone,
                                  status: "OPTED_OUT",
                                });
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              Opt-out
                            </Button>
                          </div>
                        </div>
                      </Surface>
                    ))}
                  </div>
                ) : (
                  <Alert status="default">No hay contactos registrados todavía.</Alert>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function renderComposerFields(args: {
  composerBody: string;
  composerCaption: string;
  composerEmoji: string;
  composerFilename: string;
  composerKind: WhatsappCustomMessageInput["kind"];
  composerLink: string;
  composerMessageId: string;
  composerQuotedMessageId: string;
  contactCardFirstName: string;
  contactCardName: string;
  contactCardOrganization: string;
  contactCardPhone: string;
  disappearingMode: "off" | "1d" | "7d" | "30d";
  locationAddress: string;
  locationLatitude: string;
  locationLongitude: string;
  locationName: string;
  setComposerBody: (value: string) => void;
  setComposerCaption: (value: string) => void;
  setComposerEmoji: (value: string) => void;
  setComposerFilename: (value: string) => void;
  setComposerLink: (value: string) => void;
  setComposerMessageId: (value: string) => void;
  setComposerQuotedMessageId: (value: string) => void;
  setContactCardFirstName: (value: string) => void;
  setContactCardName: (value: string) => void;
  setContactCardOrganization: (value: string) => void;
  setContactCardPhone: (value: string) => void;
  setDisappearingMode: (value: "off" | "1d" | "7d" | "30d") => void;
  setLocationAddress: (value: string) => void;
  setLocationLatitude: (value: string) => void;
  setLocationLongitude: (value: string) => void;
  setLocationName: (value: string) => void;
}) {
  switch (args.composerKind) {
    case "contextual_text":
      return (
        <>
          <TextField onChange={args.setComposerBody} value={args.composerBody}>
            <Label>Texto</Label>
            <TextArea placeholder="Escribe el mensaje..." rows={7} variant="secondary" />
          </TextField>
          <TextField
            onChange={args.setComposerQuotedMessageId}
            value={args.composerQuotedMessageId}
          >
            <Label>quotedMessageId opcional</Label>
            <Input placeholder="ABGGFlA5..." type="text" />
            <Description>
              Si existe en historial, Baileys enviará el texto como cita real.
            </Description>
          </TextField>
        </>
      );
    case "image":
    case "audio":
    case "document":
    case "video":
    case "sticker":
      return (
        <>
          <TextField onChange={args.setComposerLink} value={args.composerLink}>
            <Label>URL pública</Label>
            <Input placeholder="https://..." type="url" />
          </TextField>
          {args.composerKind === "document" ? (
            <TextField onChange={args.setComposerFilename} value={args.composerFilename}>
              <Label>Filename</Label>
              <Input placeholder="orden.pdf" type="text" />
            </TextField>
          ) : null}
          <TextField onChange={args.setComposerCaption} value={args.composerCaption}>
            <Label>Caption opcional</Label>
            <TextArea placeholder="Texto opcional..." rows={3} variant="secondary" />
          </TextField>
        </>
      );
    case "reaction":
      return (
        <>
          <TextField onChange={args.setComposerMessageId} value={args.composerMessageId}>
            <Label>messageId objetivo</Label>
            <Input placeholder="ABGGFlA5..." type="text" />
          </TextField>
          <TextField onChange={args.setComposerEmoji} value={args.composerEmoji}>
            <Label>Emoji</Label>
            <Input placeholder="👍" type="text" />
          </TextField>
        </>
      );
    case "mark_read":
    case "forward":
    case "delete":
      return (
        <TextField onChange={args.setComposerMessageId} value={args.composerMessageId}>
          <Label>messageId objetivo</Label>
          <Input placeholder="ABGGFlA5..." type="text" />
          <Description>Usa un ID del historial persistido para la operación destino.</Description>
        </TextField>
      );
    case "edit":
      return (
        <>
          <TextField onChange={args.setComposerMessageId} value={args.composerMessageId}>
            <Label>messageId objetivo</Label>
            <Input placeholder="ABGGFlA5..." type="text" />
          </TextField>
          <TextField onChange={args.setComposerBody} value={args.composerBody}>
            <Label>Nuevo texto</Label>
            <TextArea placeholder="Texto editado..." rows={5} variant="secondary" />
          </TextField>
        </>
      );
    case "typing":
      return (
        <Alert status="default">
          Esta acción sólo envía el estado `composing` al chat seleccionado.
        </Alert>
      );
    case "location":
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField onChange={args.setLocationLatitude} value={args.locationLatitude}>
              <Label>Latitud</Label>
              <Input placeholder="-33.4372" type="number" />
            </TextField>
            <TextField onChange={args.setLocationLongitude} value={args.locationLongitude}>
              <Label>Longitud</Label>
              <Input placeholder="-70.6506" type="number" />
            </TextField>
          </div>
          <TextField onChange={args.setLocationName} value={args.locationName}>
            <Label>Nombre opcional</Label>
            <Input placeholder="Sucursal Providencia" type="text" />
          </TextField>
          <TextField onChange={args.setLocationAddress} value={args.locationAddress}>
            <Label>Dirección opcional</Label>
            <Input placeholder="Av. Ejemplo 123" type="text" />
          </TextField>
        </>
      );
    case "contacts":
      return (
        <>
          <TextField onChange={args.setContactCardName} value={args.contactCardName}>
            <Label>Display name</Label>
            <Input placeholder="Sandra Maldonado" type="text" />
          </TextField>
          <TextField onChange={args.setContactCardPhone} value={args.contactCardPhone}>
            <Label>Teléfono del contacto</Label>
            <Input placeholder="+56912345678" type="tel" />
          </TextField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField onChange={args.setContactCardFirstName} value={args.contactCardFirstName}>
              <Label>Nombre corto opcional</Label>
              <Input placeholder="Sandra" type="text" />
            </TextField>
            <TextField
              onChange={args.setContactCardOrganization}
              value={args.contactCardOrganization}
            >
              <Label>Organización opcional</Label>
              <Input placeholder="Bioalergia" type="text" />
            </TextField>
          </div>
        </>
      );
    case "disappearing_messages":
      return (
        <Select
          onChange={(value) => args.setDisappearingMode(value as "off" | "1d" | "30d" | "7d")}
          value={args.disappearingMode}
        >
          <Label>Expiración</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="off">Desactivar</ListBox.Item>
              <ListBox.Item id="1d">24 horas</ListBox.Item>
              <ListBox.Item id="7d">7 días</ListBox.Item>
              <ListBox.Item id="30d">30 días</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      );
  }
}

function MetricPill({
  subtitle,
  title,
  tone,
  value,
}: {
  subtitle: string;
  title: string;
  tone: "accent" | "primary" | "success" | "warning";
  value: number | string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    accent: "border-accent/20 bg-accent/8 text-accent",
    primary: "border-primary/20 bg-primary/8 text-primary",
    success: "border-success/20 bg-success/8 text-success",
    warning: "border-warning/20 bg-warning/8 text-warning",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <Description className="text-[11px] uppercase tracking-wide opacity-75">{title}</Description>
      <div className="mt-1 truncate font-semibold text-base">{value}</div>
      <Description className="text-[11px] opacity-75">{subtitle}</Description>
    </div>
  );
}
