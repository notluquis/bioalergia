const LOCAL_AGENT_TOKEN_KEY = "bioalergia_local_mail_agent_token";
const LOCAL_AGENT_URL_KEY = "bioalergia_local_mail_agent_url";
const TRAILING_SLASHES = /\/+$/;

function getDefaultUrl(): string {
  if (import.meta.env.VITE_LOCAL_MAIL_AGENT_URL) {
    return import.meta.env.VITE_LOCAL_MAIL_AGENT_URL;
  }
  if (typeof window !== "undefined" && window.location.protocol === "http:") {
    return "http://127.0.0.1:3333";
  }
  return "https://127.0.0.1:3333";
}

export function getLocalAgentToken(): string | null {
  return localStorage.getItem(LOCAL_AGENT_TOKEN_KEY);
}

export function getLocalAgentUrl(): string {
  return localStorage.getItem(LOCAL_AGENT_URL_KEY) ?? getDefaultUrl();
}

export function setLocalAgentConfig(url: string, token: string) {
  localStorage.setItem(LOCAL_AGENT_URL_KEY, url);
  localStorage.setItem(LOCAL_AGENT_TOKEN_KEY, token);
}

export type SendEmailPayload = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendOutreachEmailViaAgent(payload: SendEmailPayload): Promise<void> {
  const token = getLocalAgentToken();
  if (!token) throw new Error("Token del agente local no configurado");

  const baseUrl = getLocalAgentUrl().trim().replace(TRAILING_SLASHES, "");
  const res = await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Local-Agent-Token": token,
    },
    body: JSON.stringify({
      to: payload.to,
      from: payload.from,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
    }),
  });

  if (!res.ok) {
    let msg = `Agente respondió ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) msg = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function checkAgentHealth(): Promise<boolean> {
  const token = getLocalAgentToken();
  if (!token) return false;
  try {
    const baseUrl = getLocalAgentUrl().trim().replace(TRAILING_SLASHES, "");
    const res = await fetch(`${baseUrl}/health/smtp`, {
      headers: { "X-Local-Agent-Token": token },
    });
    return res.ok;
  } catch {
    return false;
  }
}
