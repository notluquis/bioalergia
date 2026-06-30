import { describe, expect, it } from "vitest";
import { buildRecipient } from "../graph/messages.ts";

describe("buildRecipient", () => {
  it("uses a real phone as `to` (strips leading +)", () => {
    expect(buildRecipient("+56973446641", null)).toEqual({ to: "56973446641" });
    expect(buildRecipient("56973446641", "BR.abc")).toEqual({ to: "56973446641" });
  });

  it("falls back to BSUID `recipient` when phoneE164 is a malformed BSUID-like value", () => {
    // username-only contact: wa_id (the BSUID) ended up stored in phoneE164
    expect(buildRecipient("BR.1A2B3C", "BR.1A2B3C")).toEqual({ recipient: "BR.1A2B3C" });
  });

  it("uses BSUID when there is no phone", () => {
    expect(buildRecipient("", "BR.xyz")).toEqual({ recipient: "BR.xyz" });
    expect(buildRecipient(null, "BR.xyz")).toEqual({ recipient: "BR.xyz" });
  });

  it("throws when neither a valid phone nor a BSUID is available", () => {
    expect(() => buildRecipient("not-a-phone", null)).toThrow();
    expect(() => buildRecipient("", "")).toThrow();
  });
});
