import { getAccountForPhoneNumber, graphGet, graphPost } from "./_http.ts";

// Conversational Automation (Meta 2026): ice breakers + commands +
// welcome-message toggle, exposed at /{phone-number-id}/conversational_automation.
// Configured once per phone, persisted by Meta and rendered natively in
// the patient's WhatsApp client (chips + slash menu).

export type ConversationalCommand = {
  command_name: string; // letters/numbers/underscore, no leading slash
  command_description: string;
};

export type ConversationalAutomationConfig = {
  enable_welcome_message?: boolean;
  prompts?: string[]; // ice breakers, max 4, 80 chars each
  commands?: ConversationalCommand[]; // max 30
};

export async function getConversationalAutomation(phoneNumberId: number) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  type Resp = {
    conversational_automation?: {
      enable_welcome_message?: boolean;
      prompts?: string[];
      commands?: ConversationalCommand[];
    };
  };
  const data = await graphGet<Resp>(
    `/${phone.phoneNumberId}?fields=conversational_automation`,
    token,
    v
  );
  return (
    data.conversational_automation ?? {
      enable_welcome_message: false,
      prompts: [],
      commands: [],
    }
  );
}

export async function updateConversationalAutomation(
  phoneNumberId: number,
  config: ConversationalAutomationConfig
) {
  const phone = await getAccountForPhoneNumber(phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  // Meta expects all three fields when updating; missing fields revert
  // to the persisted value but commands array must be passed in full
  // (PATCH-style merge for that array doesn't exist).
  return graphPost<{ success: boolean }>(
    `/${phone.phoneNumberId}/conversational_automation`,
    {
      enable_welcome_message: config.enable_welcome_message ?? false,
      prompts: config.prompts ?? [],
      commands: config.commands ?? [],
    },
    token,
    v
  );
}
