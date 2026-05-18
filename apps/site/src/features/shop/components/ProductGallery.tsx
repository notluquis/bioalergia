import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Image = { cdn_url: string; alt: string | null; is_primary: boolean };

export function ProductGallery({
  images,
  productName,
}: {
  images: Image[];
  productName: string;
}) {
  const sorted = images.length
    ? [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    : [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-foreground/5 text-foreground/30">
        Sin imagen
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-foreground/5" ref={emblaRef}>
        <div className="flex">
          {sorted.map((img, i) => (
            <div className="min-w-0 flex-[0_0_100%]" key={img.cdn_url}>
              <div className="aspect-square">
                <img
                  alt={img.alt ?? productName}
                  className="h-full w-full object-cover"
                  fetchPriority={i === 0 ? "high" : "auto"}
                  loading={i === 0 ? "eager" : "lazy"}
                  src={img.cdn_url}
                />
              </div>
            </div>
          ))}
        </div>
        {sorted.length > 1 && (
          <>
            <button
              aria-label="Anterior"
              className="-translate-y-1/2 absolute top-1/2 left-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-foreground shadow"
              onClick={() => emblaApi?.scrollPrev()}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Siguiente"
              className="-translate-y-1/2 absolute top-1/2 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-foreground shadow"
              onClick={() => emblaApi?.scrollNext()}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {sorted.map((img, i) => (
            <button
              aria-label={`Imagen ${i + 1}`}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                selectedIdx === i ? "border-foreground" : "border-transparent opacity-60"
              }`}
              key={img.cdn_url}
              onClick={() => scrollTo(i)}
              type="button"
            >
              <img alt="" className="h-full w-full object-cover" loading="lazy" src={img.cdn_url} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
