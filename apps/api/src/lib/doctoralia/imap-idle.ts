// IMAP listener that auto-notified patients via Baileys WhatsApp is currently
// dormant. Baileys was removed in favor of WhatsApp Cloud API. The Doctoralia
// → WhatsApp auto-notification will be reimplemented as a sendTemplate call
// against wa-cloud once the appointment template is approved by Meta.
import { logEvent } from "../logger.ts";

type DoctoraliaImapListenerState =
  | "stopped"
  | "missing_config"
  | "connecting"
  | "connected"
  | "error";

interface DoctoraliaImapListenerStatus {
  enabled: boolean;
  host: null | string;
  lastConnectedAt: null | string;
  lastErrorAt: null | string;
  lastErrorMessage: null | string;
  lastProcessedAt: null | string;
  lastStartedAt: null | string;
  mailbox: null | string;
  reconnectDelayMs: null | number;
  state: DoctoraliaImapListenerState;
  user: null | string;
}

export interface DoctoraliaImapIngestResult {
  alreadyProcessed: number;
  checked: number;
  failed: number;
  saved: number;
  skipped: number;
}

export function startDoctoraliaImapListener(): void {
  logEvent("doctoralia.imap.disabled", {
    reason: "Baileys removed; pending wa-cloud sendTemplate reimplementation",
  });
}

export function getDoctoraliaImapListenerStatus(): DoctoraliaImapListenerStatus {
  return {
    enabled: false,
    host: null,
    lastConnectedAt: null,
    lastErrorAt: null,
    lastErrorMessage: "Baileys removed; pending wa-cloud sendTemplate reimplementation",
    lastProcessedAt: null,
    lastStartedAt: null,
    mailbox: null,
    reconnectDelayMs: null,
    state: "stopped",
    user: null,
  };
}

export function runDoctoraliaImapIngestOnce(): Promise<DoctoraliaImapIngestResult> {
  logEvent("doctoralia.imap.ingest_disabled", {
    reason: "Baileys removed; pending wa-cloud sendTemplate reimplementation",
  });
  return Promise.resolve({
    alreadyProcessed: 0,
    checked: 0,
    failed: 0,
    saved: 0,
    skipped: 0,
  });
}
