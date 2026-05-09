import { Button, Modal, Skeleton, Spinner } from "@heroui/react";
import { Download, FileText, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  messageId: number;
  type: string;
  caption?: string | null;
  out?: boolean;
};

export function MediaAttachment({ messageId, type, caption, out = false }: Props) {
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

  if (type === "STICKER") {
    return (
      <div ref={ref}>
        {errored ? (
          <div className="flex size-32 items-center justify-center rounded-xl bg-default-100 text-danger text-xs">
            <X size={20} />
          </div>
        ) : visible ? (
          <StickerImage src={url} onError={() => setErrored(true)} />
        ) : (
          <Skeleton className="size-32 rounded-xl" />
        )}
      </div>
    );
  }

  if (type === "IMAGE") {
    return (
      <div ref={ref}>
        {errored ? (
          <ErrorBox label="No se pudo cargar la imagen" />
        ) : visible ? (
          <ImageLightbox src={url} alt={caption ?? "imagen"} onError={() => setErrored(true)} />
        ) : (
          <Skeleton className="h-72 w-full max-w-xs rounded-lg" />
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
        {errored ? (
          <ErrorBox label="No se pudo cargar el video" />
        ) : visible ? (
          <VideoLightbox src={url} onError={() => setErrored(true)} />
        ) : (
          <Skeleton className="h-72 w-full max-w-xs rounded-lg" />
        )}
        {caption && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">{caption}</p>
        )}
      </div>
    );
  }

  if (type === "AUDIO") {
    return (
      <div ref={ref}>
        {errored ? (
          <ErrorBox label="No se pudo cargar el audio" />
        ) : visible ? (
          <AudioPlayer src={url} out={out} onError={() => setErrored(true)} />
        ) : (
          <Skeleton className="h-12 w-64 rounded-full" />
        )}
      </div>
    );
  }

  // DOCUMENT
  return (
    <div
      ref={ref}
      className="flex items-center gap-3 rounded-lg border border-default-200 bg-content2 px-3 py-2"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
        <FileText size={20} />
      </div>
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

function ErrorBox({ label }: { label: string }) {
  return (
    <div className="flex h-40 w-60 items-center justify-center rounded-xl bg-danger-50 text-danger text-xs">
      {label}
    </div>
  );
}

function StickerImage({ src, onError }: { src: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative size-32">
      {!loaded && <Skeleton className="absolute inset-0 size-32 rounded-xl" />}
      <img
        src={src}
        alt="sticker"
        className={`size-32 select-none object-contain transition-opacity ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
        onError={onError}
      />
    </div>
  );
}

function ImageLightbox({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block max-w-xs overflow-hidden rounded-lg"
      >
        {!loaded && <Skeleton className="absolute inset-0 h-72 w-full max-w-xs rounded-lg" />}
        <img
          src={src}
          alt={alt}
          className={`max-h-72 w-full max-w-xs cursor-zoom-in object-cover transition-opacity hover:opacity-95 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      </button>
      <Modal>
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(o) => !o && setOpen(false)}
          isDismissable
          className="bg-black/85 backdrop-blur"
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative max-h-[92vh] max-w-[92vw] bg-transparent p-0 shadow-none">
              <Button
                isIconOnly
                size="sm"
                variant="outline"
                onPress={() => setOpen(false)}
                className="absolute top-2 right-2 z-10 bg-content1/80 backdrop-blur"
                aria-label="Cerrar"
              >
                <X size={16} />
              </Button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-12 z-10"
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="outline"
                  className="bg-content1/80 backdrop-blur"
                  aria-label="Descargar"
                >
                  <Download size={16} />
                </Button>
              </a>
              <img
                src={src}
                alt={alt}
                className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain"
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function VideoLightbox({ src, onError }: { src: string; onError: () => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block w-full max-w-xs overflow-hidden rounded-lg bg-black"
      >
        {!loaded && <Skeleton className="absolute inset-0 h-72 w-full max-w-xs rounded-lg" />}
        <video
          src={src}
          className={`max-h-72 w-full max-w-xs object-cover transition-opacity ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          preload="metadata"
          muted
          onLoadedMetadata={() => setLoaded(true)}
          onError={onError}
        >
          <track kind="captions" />
        </video>
        {loaded && (
          <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
            <Play size={24} className="ml-0.5" />
          </span>
        )}
      </button>
      <Modal>
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(o) => !o && setOpen(false)}
          isDismissable
          className="bg-black/85 backdrop-blur"
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative max-h-[92vh] max-w-[92vw] bg-transparent p-0 shadow-none">
              <Button
                isIconOnly
                size="sm"
                variant="outline"
                onPress={() => setOpen(false)}
                className="absolute top-2 right-2 z-10 bg-content1/80 backdrop-blur"
                aria-label="Cerrar"
              >
                <X size={16} />
              </Button>
              <video src={src} controls autoPlay className="max-h-[92vh] max-w-[92vw] rounded-lg">
                <track kind="captions" />
              </video>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function AudioPlayer({ src, out, onError }: { src: string; out: boolean; onError: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  const trackBg = out ? "bg-success-700/40" : "bg-default-300";
  const fillBg = out ? "bg-success-foreground" : "bg-success";
  const iconBg = out ? "bg-success-foreground text-success" : "bg-success text-success-foreground";

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex w-64 items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        disabled={!loaded}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconBg} transition hover:opacity-90 disabled:opacity-50`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {!loaded ? (
          <Spinner size="sm" />
        ) : playing ? (
          <Pause size={16} />
        ) : (
          <Play size={16} className="ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className={`relative h-1 w-full overflow-hidden rounded-full ${trackBg}`}>
          <div className={`absolute top-0 left-0 h-full ${fillBg}`} style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={seek}
            disabled={!loaded}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Posición"
          />
        </div>
        <p
          className={`mt-0.5 text-[10px] ${out ? "text-success-foreground/80" : "text-default-500"}`}
        >
          {fmt(current)} / {fmt(duration)}
        </p>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setLoaded(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onError={onError}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
