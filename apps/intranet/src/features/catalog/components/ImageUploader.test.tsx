/**
 * Tests for `ImageUploader` — R2 presign → PUT → confirm flow plus
 * setPrimary / delete mutations. Mocks at module boundaries only:
 * `../orpc-images` (orpc client), `@/components/ui/ConfirmDialog`
 * (confirmAction), `@/context/ToastContext`, and global fetch (the R2
 * presigned PUT is raw fetch, not orpc).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const imagesMocks = vi.hoisted(() => ({
  presignUpload: vi.fn(),
  confirmUpload: vi.fn(),
  setPrimary: vi.fn(),
  deleteImage: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const confirmActionMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("../orpc-images", () => ({
  imagesORPCClient: imagesMocks,
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  confirmAction: confirmActionMock,
}));

const { ImageUploader } = await import("./ImageUploader");

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const sampleImage = {
  id: 1,
  cdn_url: "https://cdn.example/img-1.jpg",
  is_primary: true,
  alt: "Alt 1",
};

describe("ImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no images", async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader productId={42} images={[]} />
      </Wrapper>
    );
    expect(await screen.findByText(/Sin imágenes todavía/i)).toBeInTheDocument();
  });

  it("renders existing images with primary badge", async () => {
    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <ImageUploader
          productId={42}
          images={[
            sampleImage,
            { id: 2, cdn_url: "https://cdn.example/img-2.jpg", is_primary: false, alt: "Alt 2" },
          ]}
        />
      </Wrapper>
    );

    expect(await screen.findByText(/Principal/)).toBeInTheDocument();
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "https://cdn.example/img-1.jpg");
  });

  it("setPrimary button is disabled for the current primary image", async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader
          productId={42}
          images={[
            sampleImage,
            { id: 2, cdn_url: "https://cdn.example/img-2.jpg", is_primary: false, alt: null },
          ]}
        />
      </Wrapper>
    );
    // First star button (for primary image #1) should be disabled.
    const buttons = await screen.findAllByRole("button");
    // First button is "Subir imagen", then per-image pairs (star, trash).
    // Find by checking disabled state of star slots.
    const starButtons = buttons.filter((b) => b.querySelector("svg.lucide-star"));
    expect(starButtons).toHaveLength(2);
    expect(starButtons[0]).toBeDisabled();
    expect(starButtons[1]).not.toBeDisabled();
  });

  it("setPrimary mutation fires on click of non-primary star", async () => {
    const user = userEvent.setup();
    imagesMocks.setPrimary.mockResolvedValue({ data: { ok: true } });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader
          productId={42}
          images={[
            sampleImage,
            { id: 2, cdn_url: "https://cdn.example/img-2.jpg", is_primary: false, alt: null },
          ]}
        />
      </Wrapper>
    );

    const buttons = await screen.findAllByRole("button");
    const starButtons = buttons.filter((b) => b.querySelector("svg.lucide-star"));
    await user.click(starButtons[1]!);
    await waitFor(() => expect(imagesMocks.setPrimary).toHaveBeenCalledWith({ id: 2 }));
  });

  it("delete button triggers confirmAction; cancel → no delete", async () => {
    const user = userEvent.setup();
    confirmActionMock.mockResolvedValue(false);
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader productId={42} images={[sampleImage]} />
      </Wrapper>
    );

    const buttons = await screen.findAllByRole("button");
    const trash = buttons.find((b) => b.querySelector("svg.lucide-trash2"));
    expect(trash).toBeDefined();
    await user.click(trash!);

    await waitFor(() => expect(confirmActionMock).toHaveBeenCalled());
    expect(imagesMocks.deleteImage).not.toHaveBeenCalled();
  });

  it("delete confirms → deleteImage called", async () => {
    const user = userEvent.setup();
    confirmActionMock.mockResolvedValue(true);
    imagesMocks.deleteImage.mockResolvedValue({ data: { ok: true } });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader productId={42} images={[sampleImage]} />
      </Wrapper>
    );

    const buttons = await screen.findAllByRole("button");
    const trash = buttons.find((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(trash!);

    await waitFor(() => expect(imagesMocks.deleteImage).toHaveBeenCalledWith({ id: 1 }));
  });

  it("delete: surfaces error via toast when mutation rejects", async () => {
    const user = userEvent.setup();
    confirmActionMock.mockResolvedValue(true);
    imagesMocks.deleteImage.mockRejectedValue(new Error("R2 down"));
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ImageUploader productId={42} images={[sampleImage]} />
      </Wrapper>
    );

    const buttons = await screen.findAllByRole("button");
    const trash = buttons.find((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(trash!);

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("R2 down"));
  });

  it("rejects files with unsupported MIME type (no presign call)", async () => {
    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <ImageUploader productId={42} images={[]} />
      </Wrapper>
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["x"], "x.gif", { type: "image/gif" });
    // bypass `accept` filter from userEvent — fireEvent.change directly.
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(expect.stringContaining("Tipo no permitido"))
    );
    expect(imagesMocks.presignUpload).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5MB", async () => {
    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <ImageUploader productId={42} images={[]} />
      </Wrapper>
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    // Build a 6MB file without allocating: stub `size`.
    const file = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });

    const user = userEvent.setup();
    await user.upload(input, file);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(expect.stringContaining(">5MB"))
    );
    expect(imagesMocks.presignUpload).not.toHaveBeenCalled();
  });

  it("happy path: presign → fetch PUT → confirmUpload → toastSuccess", async () => {
    imagesMocks.presignUpload.mockResolvedValue({
      data: {
        url: "https://r2.example/presigned",
        r2_key: "products/42/abc.jpg",
        cdn_url: "https://cdn.example/products/42/abc.jpg",
      },
    });
    imagesMocks.confirmUpload.mockResolvedValue({ data: { id: 99 } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    // jsdom Image doesn't auto-fire onload; stub to resolve dimensions.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 800;
      naturalHeight = 600;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:fake",
      revokeObjectURL: () => undefined,
    });

    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <ImageUploader productId={42} images={[]} />
      </Wrapper>
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["binary"], "foo.jpg", { type: "image/jpeg" });
    const user = userEvent.setup();
    await user.upload(input, file);

    await waitFor(() =>
      expect(imagesMocks.presignUpload).toHaveBeenCalledWith({
        product_id: 42,
        filename: "foo.jpg",
        content_type: "image/jpeg",
      })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [putUrl, putInit] = fetchMock.mock.calls[0]!;
    expect(putUrl).toBe("https://r2.example/presigned");
    expect((putInit as RequestInit).method).toBe("PUT");

    await waitFor(() =>
      expect(imagesMocks.confirmUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 42,
          r2_key: "products/42/abc.jpg",
          cdn_url: "https://cdn.example/products/42/abc.jpg",
        })
      )
    );
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Imagen subida"));
    vi.unstubAllGlobals();
  });

  it("PUT failure → toastError, no confirmUpload call", async () => {
    imagesMocks.presignUpload.mockResolvedValue({
      data: {
        url: "https://r2.example/presigned",
        r2_key: "k",
        cdn_url: "https://cdn.example/k",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const Wrapper = buildWrapper();
    const { container } = render(
      <Wrapper>
        <ImageUploader productId={42} images={[]} />
      </Wrapper>
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["x"], "foo.png", { type: "image/png" });
    const user = userEvent.setup();
    await user.upload(input, file);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(expect.stringContaining("R2 PUT falló"))
    );
    expect(imagesMocks.confirmUpload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
