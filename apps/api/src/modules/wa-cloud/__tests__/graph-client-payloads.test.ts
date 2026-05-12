import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @finanzas/db before importing graph-client
const fakePhone = {
  id: 1,
  phoneNumberId: "PHONE123",
  account: {
    id: 1,
    systemUserToken: "TOKEN_ABC",
    graphApiVersion: "v22.0",
    appId: "APP_ID",
  },
};

vi.mock("@finanzas/db", () => ({
  db: {
    waPhoneNumber: {
      findUnique: vi.fn(async () => fakePhone),
    },
    waBusinessAccount: {
      findUnique: vi.fn(async () => fakePhone.account),
    },
  },
}));

vi.mock("../../../lib/logger.ts", () => ({
  logWarn: vi.fn(),
  logEvent: vi.fn(),
  logError: vi.fn(),
}));

import {
  sendAddressMessage,
  sendInteractiveListMessage,
  sendLocationMessage,
  sendTextMessage,
} from "../graph-client.ts";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ok({ messages: [{ id: "wamid.123" }] }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: url as string,
    init: init as RequestInit,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
};

describe("sendTextMessage", () => {
  it("strips leading + from to and uses correct endpoint + token", async () => {
    await sendTextMessage({ phoneNumberId: 1, toE164: "+56912345678", body: "hi" });
    const { url, init, body } = lastCall();
    expect(url).toBe("https://graph.facebook.com/v22.0/PHONE123/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN_ABC");
    expect(body.to).toBe("56912345678");
    expect(body.type).toBe("text");
    expect((body.text as { body: string }).body).toBe("hi");
    expect((body.text as { preview_url: boolean }).preview_url).toBe(false);
  });

  it("includes context.message_id when contextMessageId given", async () => {
    await sendTextMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      body: "reply",
      contextMessageId: "wamid.original",
    });
    const { body } = lastCall();
    expect(body.context).toEqual({ message_id: "wamid.original" });
  });

  it("includes biz_opaque_callback_data when provided", async () => {
    await sendTextMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      body: "tracked",
      bizOpaqueCallbackData: "campaign:42",
    });
    const { body } = lastCall();
    expect(body.biz_opaque_callback_data).toBe("campaign:42");
  });

  it("omits context + callback_data when not given", async () => {
    await sendTextMessage({ phoneNumberId: 1, toE164: "+56912345678", body: "plain" });
    const { body } = lastCall();
    expect(body.context).toBeUndefined();
    expect(body.biz_opaque_callback_data).toBeUndefined();
  });
});

describe("sendLocationMessage", () => {
  it("shapes location payload", async () => {
    await sendLocationMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      latitude: -36.83,
      longitude: -73.05,
      name: "Bioalergia",
      address: "Arturo Prat 199",
    });
    const { body } = lastCall();
    expect(body.type).toBe("location");
    expect(body.location).toEqual({
      latitude: -36.83,
      longitude: -73.05,
      name: "Bioalergia",
      address: "Arturo Prat 199",
    });
  });

  it("omits optional name/address", async () => {
    await sendLocationMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      latitude: 1,
      longitude: 2,
    });
    const { body } = lastCall();
    expect(body.location).toEqual({ latitude: 1, longitude: 2 });
  });
});

describe("sendInteractiveListMessage", () => {
  it("shapes interactive type=list payload per Meta spec", async () => {
    await sendInteractiveListMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      bodyText: "Pick one",
      buttonText: "Ver",
      sections: [
        {
          title: "Opt",
          rows: [
            { id: "a", title: "A", description: "alpha" },
            { id: "b", title: "B" },
          ],
        },
      ],
      headerText: "Header",
      footerText: "Footer",
    });
    const { body } = lastCall();
    expect(body.type).toBe("interactive");
    const inter = body.interactive as Record<string, unknown>;
    expect(inter.type).toBe("list");
    expect(inter.body).toEqual({ text: "Pick one" });
    expect(inter.header).toEqual({ type: "text", text: "Header" });
    expect(inter.footer).toEqual({ text: "Footer" });
    const action = inter.action as { button: string; sections: unknown[] };
    expect(action.button).toBe("Ver");
    expect(action.sections).toHaveLength(1);
  });

  it("omits header/footer when not provided", async () => {
    await sendInteractiveListMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      bodyText: "x",
      buttonText: "y",
      sections: [{ rows: [{ id: "1", title: "one" }] }],
    });
    const { body } = lastCall();
    const inter = body.interactive as Record<string, unknown>;
    expect(inter.header).toBeUndefined();
    expect(inter.footer).toBeUndefined();
  });
});

describe("sendAddressMessage", () => {
  it("shapes interactive type=address_message with country", async () => {
    await sendAddressMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      bodyText: "Comparte tu dirección",
      country: "CL",
    });
    const { body } = lastCall();
    const inter = body.interactive as Record<string, unknown>;
    expect(inter.type).toBe("address_message");
    expect(inter.body).toEqual({ text: "Comparte tu dirección" });
    const action = inter.action as {
      name: string;
      parameters: { country: string };
    };
    expect(action.name).toBe("address_message");
    expect(action.parameters.country).toBe("CL");
  });

  it("includes save_address.label when provided", async () => {
    await sendAddressMessage({
      phoneNumberId: 1,
      toE164: "+56912345678",
      bodyText: "x",
      country: "CL",
      saveAddressLabel: "Casa",
    });
    const { body } = lastCall();
    const params = (body.interactive as { action: { parameters: Record<string, unknown> } }).action
      .parameters;
    expect(params.save_address).toEqual({ label: "Casa" });
  });
});
