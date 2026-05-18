/**
 * Tests for `WaCloudWebhookLogsPage` — read-only operator view of the
 * last 100 Meta webhook POSTs.
 *
 * Coverage:
 *  - Skeleton renders while the query is in flight.
 *  - Rows render once data arrives.
 *  - Signature validity Chip swaps color/label.
 *  - "Processed" Chip swaps icon/label.
 *  - Empty `fields[]` collapses to em-dash placeholder.
 *  - `errorMessage` is truncated and shown when present, em-dash
 *    otherwise.
 *
 * The orpc client is mocked at the module boundary so the test never
 * touches the network or `csrfFetch`.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMock = vi.hoisted(() => ({
  listWebhookLogs: vi.fn(),
}));

vi.mock("../orpc", () => ({
  waCloudORPCClient: orpcMock,
}));

const { WaCloudWebhookLogsPage } = await import("./WaCloudWebhookLogsPage");

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("WaCloudWebhookLogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the skeleton header while loading", () => {
    // Pending promise — query never resolves during this assertion.
    orpcMock.listWebhookLogs.mockReturnValue(new Promise(() => {}));
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <WaCloudWebhookLogsPage />
      </Wrapper>
    );
    expect(screen.getByText("Webhook logs")).toBeInTheDocument();
  });

  it("renders rows once data arrives and shows the refresh title", async () => {
    orpcMock.listWebhookLogs.mockResolvedValue({
      logs: [
        {
          id: 1,
          receivedAt: new Date("2026-05-18T12:34:56Z").toISOString(),
          signatureValid: true,
          processed: true,
          eventCount: 2,
          fields: ["messages"],
          errorMessage: null,
          preview: '{"object":"whatsapp_business_account"}',
        },
      ],
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <WaCloudWebhookLogsPage />
      </Wrapper>
    );
    await waitFor(() =>
      expect(screen.getByText(/Webhook logs \(refresh 3s\)/)).toBeInTheDocument()
    );
    expect(screen.getByText("OK")).toBeInTheDocument(); // signatureValid chip
    expect(screen.getByText("messages")).toBeInTheDocument(); // fields chip
  });

  it("renders INVALID signature chip and 'no' processed chip", async () => {
    orpcMock.listWebhookLogs.mockResolvedValue({
      logs: [
        {
          id: 2,
          receivedAt: new Date().toISOString(),
          signatureValid: false,
          processed: false,
          eventCount: 0,
          fields: [],
          errorMessage: "HMAC signature mismatch — secret rotated?",
          preview: "{}",
        },
      ],
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <WaCloudWebhookLogsPage />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByText("INVALID")).toBeInTheDocument());
    expect(screen.getByText("no")).toBeInTheDocument();
    expect(screen.getByText(/HMAC signature mismatch/)).toBeInTheDocument();
  });

  it("collapses empty fields and missing errorMessage to em-dash", async () => {
    orpcMock.listWebhookLogs.mockResolvedValue({
      logs: [
        {
          id: 3,
          receivedAt: new Date().toISOString(),
          signatureValid: true,
          processed: true,
          eventCount: 0,
          fields: [],
          errorMessage: null,
          preview: "{}",
        },
      ],
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <WaCloudWebhookLogsPage />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByText("OK")).toBeInTheDocument());
    // Two em-dashes: one for fields, one for errorMessage. Both rendered.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
