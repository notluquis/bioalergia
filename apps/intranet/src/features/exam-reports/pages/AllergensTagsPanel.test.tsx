/**
 * Tests for AllergensTagsPanel — the admin UI that edits
 * ClinicalAllergen.tags inside `/exam-reports?tab=allergens`.
 *
 * Covers:
 * - Module helpers `parseTagsDraft` + `findInvalidTags`.
 * - Render: list loads via mocked oRPC client and shows rows.
 * - Search: typing into the SearchField triggers a refetch with the
 *   `search` param set.
 * - Save mutation: typing a new tag + clicking Guardar calls
 *   `updateAllergenTags` with the parsed, deduped tags array.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const orpcMocks = vi.hoisted(() => ({
  listAllergensWithTags: vi.fn(),
  updateAllergenTags: vi.fn(),
}));

vi.mock("@/features/exam-reports/orpc", () => ({
  examReportsORPCClient: orpcMocks,
  toExamReportsApiError: (e: unknown) => e,
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { AllergensTagsPanel, parseTagsDraft, findInvalidTags } =
  await import("./AllergensTagsPanel");

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleRow = {
  id: "alg_1",
  commonName: "Abedul",
  scientificName: "Betula verrucosa",
  category: "polen",
  pollenType: null,
  tags: ["pr-10"],
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  orpcMocks.listAllergensWithTags.mockResolvedValue({
    items: [sampleRow],
    total: 1,
  });
});

describe("parseTagsDraft", () => {
  it("trims, lowercases, dedupes, drops blanks", () => {
    expect(parseTagsDraft(" PR-10 , profilin,, profilin, LTP")).toEqual([
      "pr-10",
      "profilin",
      "ltp",
    ]);
  });

  it("splits on newlines as well as commas", () => {
    expect(parseTagsDraft("pr-10\nprofilin\n\nLTP")).toEqual(["pr-10", "profilin", "ltp"]);
  });

  it("returns empty array when the draft is empty or whitespace only", () => {
    expect(parseTagsDraft("")).toEqual([]);
    expect(parseTagsDraft("   ,  , ")).toEqual([]);
  });
});

describe("findInvalidTags", () => {
  it("flags tags with capitals, spaces, or trailing dashes", () => {
    expect(findInvalidTags(["pr-10", "PR-10", "pr_10", "pr-10-", "ok-tag"])).toEqual([
      "PR-10",
      "pr_10",
      "pr-10-",
    ]);
  });
});

describe("AllergensTagsPanel", () => {
  it("renders rows fetched from the listAllergensWithTags endpoint", async () => {
    wrap(<AllergensTagsPanel />);
    expect(await screen.findByText("Abedul")).toBeInTheDocument();
    expect(screen.getByText("Betula verrucosa")).toBeInTheDocument();
    expect(orpcMocks.listAllergensWithTags).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    );
  });

  it("filters by search: typing forwards `search` to the query", async () => {
    const user = userEvent.setup();
    wrap(<AllergensTagsPanel />);
    await screen.findByText("Abedul");

    const searchInput = screen.getByLabelText("Buscar alérgenos");
    await user.type(searchInput, "bet");

    await waitFor(() => {
      const calls = orpcMocks.listAllergensWithTags.mock.calls;
      expect(calls.some((c) => c[0]?.search === "bet")).toBe(true);
    });
  });

  it("Save button fires updateAllergenTags with deduped + parsed tags", async () => {
    const user = userEvent.setup();
    orpcMocks.updateAllergenTags.mockResolvedValue({
      ...sampleRow,
      tags: ["pr-10", "profilin"],
    });
    wrap(<AllergensTagsPanel />);

    // Wait for hydrated draft (Save button is initially disabled
    // because draft === server state).
    await screen.findByText("Abedul");
    const textarea = await screen.findByPlaceholderText("pr-10, profilin");

    // The textarea is inside a HeroUI compound TextField; React Aria
    // sometimes routes focus through the wrapper. Click to focus,
    // then select all + type the replacement.
    await user.click(textarea);
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard("{Delete}");
    await user.type(textarea, "pr-10, profilin, profilin");

    const saveBtn = screen.getByRole("button", { name: /guardar/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);

    await waitFor(() => {
      expect(orpcMocks.updateAllergenTags).toHaveBeenCalledWith({
        id: "alg_1",
        tags: ["pr-10", "profilin"],
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Etiquetas guardadas");
  });
});
