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

  // DOCUMENT — PDF gets a richer preview tile + Vista/Descargar; others
  // fall back to a labelled icon link.
  return (
    <div ref={ref}>
      <DocumentPreview url={url} caption={caption ?? null} />
    </div>
  );
}

function DocumentPreview({ url, caption }: { url: string; caption: string | null }) {
  const [open, setOpen] = useState(false);
  const filename = caption ?? "Documento";
  const isLikelyPdf = /\.pdf(\?|$)/i.test(filename) || filename.toLowerCase().includes("pdf");

  return (
    <>
      <div className="flex w-72 max-w-full flex-col overflow-hidden rounded-lg border border-default-200 bg-content2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-content3"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <FileText size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{filename}</p>
            <p className="text-default-500 text-xs">
              {isLikelyPdf ? "PDF · click para vista previa" : "Click para abrir"}
            </p>
          </div>
        </button>
        <div className="flex border-default-200 border-t">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 items-center justify-center gap-1 py-2 text-accent text-xs hover:bg-content3"
          >
            <FileText size={12} /> Vista previa
          </button>
          <a
            href={`${url}?download=1`}
            download={filename}
            className="flex flex-1 items-center justify-center gap-1 border-default-200 border-l py-2 text-default-700 text-xs hover:bg-content3"
          >
            <Download size={12} /> Descargar
          </a>
        </div>
      </div>

      <Modal>
        <Modal.Backdrop
          isOpen={open}
          onOpenChange={(o) => !o && setOpen(false)}
          isDismissable
          className="bg-black/85 backdrop-blur"
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative h-[92vh] w-[92vw] max-w-5xl bg-background p-0 shadow-2xl">
              <div className="flex items-center justify-between border-default-200 border-b bg-content1 px-3 py-2">
                <p className="truncate font-medium text-sm">{filename}</p>
                <div className="flex items-center gap-1">
                  <a href={`${url}?download=1`} download={filename}>
                    <Button isIconOnly size="sm" variant="outline" aria-label="Descargar">
                      <Download size={14} />
                    </Button>
                  </a>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      Abrir en pestaña
                    </Button>
                  </a>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="outline"
                    onPress={() => setOpen(false)}
                    aria-label="Cerrar"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
              <iframe src={`${url}#toolbar=1&view=FitH`} title={filename} className="size-full" />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
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

const SPEED_CYCLE = [1, 1.5, 2] as const;
type Speed = (typeof SPEED_CYCLE)[number];

function AudioPlayer({ src, out, onError }: { src: string; out: boolean; onError: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const probedRef = useRef(false);

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Chrome bug: opus/webm audio may report duration === Infinity until you
  // force a seek. Workaround: seek to a huge value, then back to 0.
  const probeDuration = () => {
    const a = audioRef.current;
    if (!a || probedRef.current) return;
    probedRef.current = true;
    const onDurChange = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setDuration(a.duration);
        setLoaded(true);
        a.currentTime = 0;
        a.removeEventListener("durationchange", onDurChange);
      }
    };
    a.addEventListener("durationchange", onDurChange);
    try {
      a.currentTime = 1e10;
    } catch {
      // ignore
    }
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

  const cycleSpeed = () => {
    const idx = SPEED_CYCLE.indexOf(speed);
    const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length]!;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const trackBg = out ? "bg-success-700/40" : "bg-default-300";
  const fillBg = out ? "bg-success-foreground" : "bg-success";
  const iconBg = out ? "bg-success-foreground text-success" : "bg-success text-success-foreground";
  const speedBg = out
    ? "bg-success-700/40 text-success-foreground hover:bg-success-700/60"
    : "bg-default-200 text-default-700 hover:bg-default-300";

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex w-64 items-center gap-2 py-1">
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
        <p className={`mt-0.5 text-xs ${out ? "text-success-foreground/80" : "text-default-500"}`}>
          {fmt(current)} / {fmt(duration)}
        </p>
      </div>
      <button
        type="button"
        onClick={cycleSpeed}
        disabled={!loaded}
        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs tabular-nums transition disabled:opacity-50 ${speedBg}`}
        aria-label={`Velocidad ${speed}×`}
        title="Cambiar velocidad"
      >
        {speed}×
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
            setLoaded(true);
          } else {
            // Trigger Chrome opus duration workaround
            probeDuration();
          }
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
            setLoaded(true);
          }
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onError={onError}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
