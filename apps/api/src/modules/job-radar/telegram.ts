// Notificación vía Telegram Bot API. Elegido sobre WhatsApp porque WA Cloud
// bloquea texto libre fuera de la ventana 24h (un cron casi siempre cae fuera),
// lo que forzaría plantillas aprobadas por Meta. Telegram: gratis, instantáneo,
// sin ventana, sin plantilla.
//
// Setup (one-time): @BotFather → /newbot → TELEGRAM_BOT_TOKEN; mandar un mensaje
// al bot y leer chat.id desde https://api.telegram.org/bot<TOKEN>/getUpdates →
// TELEGRAM_CHAT_ID.

import { logWarn } from "../../lib/logger.ts";

const TIMEOUT_MS = 10_000;

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Envía un mensaje (HTML) al chat configurado. Devuelve true si se envió.
 * No lanza: ante fallo loguea warn y devuelve false, para que el sync no se
 * caiga por un problema de notificación.
 */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logWarn("job_radar.telegram.not_configured", {});
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logWarn("job_radar.telegram.send_failed", { status: res.status, body: body.slice(0, 300) });
      return false;
    }
    return true;
  } catch (err) {
    logWarn("job_radar.telegram.send_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
