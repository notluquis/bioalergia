import { beforeEach, describe, expect, it, vi } from "vitest";

// The transactional order emails delegate to `sendEmail` (index.ts). We mock it
// so nothing touches Resend / config / the DB — we only inspect the EmailMessage
// each helper hands off (subject / html / text / idempotencyKey). Mocking
// index.ts also keeps `resendApiKey` and the provider out of the module graph, so
// no RESEND_API_KEY / db setup is needed.
const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

vi.mock("../index.ts", () => ({
  sendEmail: sendEmailMock,
}));

const {
  sendOrderConfirmationEmail,
  sendOrderDispatchedEmail,
  sendOrderDeliveredEmail,
  sendOrderRefundEmail,
  sendOrderCancelledEmail,
  sendPaymentFailedEmail,
} = await import("../transactional.ts");

type CapturedMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

function lastMessage(): CapturedMessage {
  const call = sendEmailMock.mock.calls.at(-1);
  if (!call) throw new Error("sendEmail was never called");
  return call[0] as CapturedMessage;
}

const ORDER = "BA-2026-0007";
const TO = "cliente@correo.cl";
const TOKEN = "tok-secret-abc123";

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ id: "resend-test-id", to: [TO], ok: true });
});

describe("order lifecycle emails", () => {
  it("confirmation: includes items, total, DTE, and a token status link", async () => {
    await sendOrderConfirmationEmail({
      to: TO,
      orderNumber: ORDER,
      totalClp: 23980,
      items: [
        { name: "Crema Hidratante", qty: 2, unitPriceClp: 8990 },
        { name: "Spray Nasal", qty: 1, unitPriceClp: 6000 },
      ],
      billingType: "BOLETA",
      dteFolio: "10042",
      accessToken: TOKEN,
    });

    const msg = lastMessage();
    expect(msg.to).toBe(TO);
    expect(msg.subject).toContain(ORDER);
    // Order number in both renderings.
    expect(msg.html).toContain(ORDER);
    expect(msg.text).toContain(ORDER);
    // Line items + folio surfaced.
    expect(msg.html).toContain("Crema Hidratante");
    expect(msg.text).toContain("Spray Nasal");
    expect(msg.html).toContain("10042");
    // Total formatted CLP.
    expect(msg.html).toMatch(/23\.980/);
    // Token link (no PII) — never the legacy ?email= form when a token is present.
    expect(msg.html).toContain(`?token=${TOKEN}`);
    expect(msg.html).not.toContain("?email=");
    expect(msg.idempotencyKey).toBe(`order-confirmation/${ORDER}`);
  });

  it("dispatched: mentions the destination comuna + token link + idempotency prefix", async () => {
    await sendOrderDispatchedEmail({
      to: TO,
      orderNumber: ORDER,
      shippedToComuna: "Providencia",
      accessToken: TOKEN,
    });

    const msg = lastMessage();
    expect(msg.subject).toContain(ORDER);
    expect(msg.html).toContain(ORDER);
    expect(msg.text).toContain(ORDER);
    expect(msg.html).toContain("Providencia");
    expect(msg.html).toContain(`?token=${TOKEN}`);
    expect(msg.idempotencyKey).toBe(`order-dispatched/${ORDER}`);
  });

  it("delivered: renders the order number + token link + idempotency prefix", async () => {
    await sendOrderDeliveredEmail({ to: TO, orderNumber: ORDER, accessToken: TOKEN });

    const msg = lastMessage();
    expect(msg.html).toContain(ORDER);
    expect(msg.text).toContain(ORDER);
    expect(msg.html).toContain(`?token=${TOKEN}`);
    expect(msg.idempotencyKey).toBe(`order-delivered/${ORDER}`);
  });

  it("refund: includes the refunded CLP amount + idempotency prefix", async () => {
    await sendOrderRefundEmail({
      to: TO,
      orderNumber: ORDER,
      totalClp: 50000,
      accessToken: TOKEN,
    });

    const msg = lastMessage();
    expect(msg.html).toContain(ORDER);
    // The refunded amount must appear (CLP-formatted) in both html + text.
    expect(msg.html).toMatch(/50\.000/);
    expect(msg.text).toMatch(/50\.000/);
    expect(msg.html).toContain(`?token=${TOKEN}`);
    expect(msg.idempotencyKey).toBe(`order-refund/${ORDER}`);
  });

  it("cancelled: falls back to the ?email= link when no access token is passed", async () => {
    await sendOrderCancelledEmail({ to: TO, orderNumber: ORDER });

    const msg = lastMessage();
    expect(msg.html).toContain(ORDER);
    expect(msg.text).toContain(ORDER);
    // No token → legacy email-scoped link, and definitely no ?token=.
    expect(msg.html).toContain(`?email=${encodeURIComponent(TO)}`);
    expect(msg.html).not.toContain("?token=");
    expect(msg.idempotencyKey).toBe(`order-cancelled/${ORDER}`);
  });

  it("payment failed: keys idempotency by payment id when provided (else order)", async () => {
    await sendPaymentFailedEmail({
      to: TO,
      orderNumber: ORDER,
      accessToken: TOKEN,
      paymentId: "pay-99887766",
    });
    expect(lastMessage().idempotencyKey).toBe("payment-failed/pay-99887766");
    expect(lastMessage().html).toContain(`?token=${TOKEN}`);

    await sendPaymentFailedEmail({ to: TO, orderNumber: ORDER });
    expect(lastMessage().idempotencyKey).toBe(`payment-failed/${ORDER}`);
  });
});

describe("HTML escaping", () => {
  it("escapes an order number with angle brackets (esc is not bypassed)", async () => {
    const evil = "BA-<b>xss</b>-1";
    await sendOrderConfirmationEmail({
      to: TO,
      orderNumber: evil,
      totalClp: 1000,
      items: [{ name: "Item", qty: 1, unitPriceClp: 1000 }],
      accessToken: TOKEN,
    });

    const msg = lastMessage();
    // The escaped form is present; the raw injected markup is not.
    expect(msg.html).toContain("BA-&lt;b&gt;xss&lt;/b&gt;-1");
    expect(msg.html).not.toContain("BA-<b>xss</b>-1");
  });
});
