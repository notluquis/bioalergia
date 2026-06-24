import { Button, Modal, Spinner } from "@heroui/react";
import { Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * In-app PDF preview modal (golden 2026).
 *
 * Renders the generated PDF Blob inline via <iframe src=blob:>. Avoids
 * the popup-blocked / external-tab flow other corners of the app still
 * use (`window.open` + dataUri). The iframe's blob URL is revoked the
 * moment the modal closes so we don't leak memory across previews.
 *
 * Caller passes:
 *   - `getBlob`: async factory invoked when the modal opens; lets the
 *     parent lazy-import jspdf only when the user actually wants a
 *     preview.
 *   - `onDownload`: optional explicit download handler. When omitted we
 *     wire a fallback anchor click against the same blob URL.
 *   - `filename`: download filename (used by the fallback anchor).
 *   - extra footer slot via `footerExtra` so edit-mode can inject
 *     "Guardar y descargar".
 */
export interface ExamReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Async factory that produces the PDF Blob on demand. */
  getBlob: () => Promise<Blob>;
  /** Filename used by the default Descargar button. */
  filename: string;
  /** Optional override for the download action. */
  onDownload?: (blob: Blob) => void | Promise<void>;
  /** Extra footer slot (e.g. "Guardar y descargar" in edit-mode). */
  footerExtra?: React.ReactNode;
}

export function ExamReportPreviewModal({
  isOpen,
  onClose,
  getBlob,
  filename,
  onDownload,
  footerExtra,
}: ExamReportPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Hold the current blob URL in a ref so the cleanup effect can revoke
  // it without re-running on every render. setBlobUrl still drives the
  // iframe src binding.
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const next = await getBlob();
        if (cancelled) return;
        const url = URL.createObjectURL(next);
        blobUrlRef.current = url;
        setBlob(next);
        setBlobUrl(url);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error generando vista previa");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, getBlob]);

  // Revoke the blob URL whenever the modal closes OR a new preview
  // replaces an older one. Single source of truth: blobUrlRef.
  useEffect(() => {
    if (isOpen) return;
    const url = blobUrlRef.current;
    if (url) {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
      setBlobUrl(null);
      setBlob(null);
    }
  }, [isOpen]);

  // Final unmount safety net — covers the case where the parent unmounts
  // the modal entirely without flipping isOpen first.
  useEffect(() => {
    return () => {
      const url = blobUrlRef.current;
      if (url) {
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleDownload = async (): Promise<void> => {
    if (!blob) return;
    if (onDownload) {
      await onDownload(blob);
      return;
    }
    const url = blobUrl ?? URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/50 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog
            className="relative flex h-[92dvh] w-full max-w-5xl flex-col rounded-[28px] bg-background p-0 shadow-2xl"
            data-testid="exam-report-preview-modal"
          >
            <Modal.Header className="border-default-100 border-b px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <Modal.Heading className="font-bold text-primary text-lg">
                  Vista previa del informe
                </Modal.Heading>
                <Button
                  aria-label="Cerrar vista previa"
                  isIconOnly
                  onPress={onClose}
                  size="sm"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </Modal.Header>
            <Modal.Body className="flex-1 overflow-hidden bg-default-100/40 p-0">
              {isLoading && (
                <div
                  className="flex h-full items-center justify-center gap-2 text-default-600"
                  data-testid="exam-report-preview-loading"
                >
                  <Spinner size="sm" />
                  Generando vista previa…
                </div>
              )}
              {!isLoading && error && (
                <div
                  className="flex h-full items-center justify-center px-6 text-center text-danger text-sm"
                  data-testid="exam-report-preview-error"
                >
                  {error}
                </div>
              )}
              {!isLoading && !error && blobUrl && (
                <iframe
                  className="size-full"
                  data-testid="exam-report-preview-iframe"
                  src={blobUrl}
                  title="Vista previa del informe en PDF"
                />
              )}
            </Modal.Body>
            <Modal.Footer className="border-default-100 border-t px-6 py-3">
              <div className="flex w-full items-center justify-end gap-2">
                <Button
                  data-testid="exam-report-preview-cancel"
                  onPress={onClose}
                  variant="outline"
                >
                  Cancelar
                </Button>
                {footerExtra}
                <Button
                  data-testid="exam-report-preview-download"
                  isDisabled={!blob || isLoading}
                  onPress={() => {
                    void handleDownload();
                  }}
                >
                  <Download className="size-4" />
                  Descargar PDF
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
