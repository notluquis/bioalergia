import { Spinner } from "@heroui/react";
import { Download, FileText, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  messageId: number;
  type: string;
  caption?: string | null;
};

// Lazy: only fetch the proxied media when the bubble actually scrolls into
// view. Avoids hitting Meta + our DB for every old message in the history.
export function MediaAttachment({ messageId, type, caption }: Props) {
  const [visible, setVisible] = useState(false);
  const [errored, setErrored] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  const url = `/api/wa-cloud/media/${messageId}`;

  const placeholder = (
    <div className="flex h-40 w-60 items-center justify-center rounded-xl bg-default-100">
      {errored ? (
        <span className="text-danger text-xs">No se pudo cargar</span>
      ) : visible ? (
        <Spinner size="sm" />
      ) : (
        <PlaceholderIcon type={type} />
      )}
    </div>
  );

  if (type === "STICKER") {
    return (
      <div ref={ref} className="p-2">
        {visible && !errored ? (
          <img
            src={url}
            alt="sticker"
            className="h-40 w-40 object-contain"
            onError={() => setErrored(true)}
          />
        ) : (
          placeholder
        )}
      </div>
    );
  }

  if (type === "IMAGE") {
    return (
      <div ref={ref}>
        {visible && !errored ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt={caption ?? "imagen"}
              className="max-h-80 w-full max-w-sm rounded-lg object-cover"
              onError={() => setErrored(true)}
            />
          </a>
        ) : (
          placeholder
        )}
        {caption && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">{caption}</p>
        )}
      </div>
    );
  }

  if (type === "VIDEO") {
    return (
      <div ref={ref}>
        {visible && !errored ? (
          <video
            src={url}
            controls
            className="max-h-80 w-full max-w-sm rounded-lg"
            onError={() => setErrored(true)}
          >
            <track kind="captions" />
          </video>
        ) : (
          placeholder
        )}
        {caption && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">{caption}</p>
        )}
      </div>
    );
  }

  if (type === "AUDIO") {
    return (
      <div ref={ref} className="min-w-[240px]">
        {visible && !errored ? (
          <audio src={url} controls className="w-full" onError={() => setErrored(true)}>
            <track kind="captions" />
          </audio>
        ) : (
          placeholder
        )}
      </div>
    );
  }

  // DOCUMENT
  return (
    <div ref={ref} className="flex items-center gap-2 rounded-lg bg-default-50 px-3 py-2">
      <FileText size={20} className="shrink-0 text-default-500" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 truncate text-sm underline-offset-2 hover:underline"
      >
        {caption ?? "Documento"}
      </a>
      <Download size={16} className="text-default-500" />
    </div>
  );
}

function PlaceholderIcon({ type }: { type: string }) {
  const cls = "size-8 text-default-400";
  if (type === "VIDEO") return <VideoIcon className={cls} />;
  if (type === "DOCUMENT") return <FileText className={cls} />;
  return <ImageIcon className={cls} />;
}
