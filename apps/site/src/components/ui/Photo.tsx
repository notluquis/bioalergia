import { type ClinicPhotoName, clinicPhotos, photoSrcSet } from "@/data/photos";

/**
 * Real clinical photo with responsive WebP srcset + focal-point cover crop.
 * The design system mandates authentic photography over stock/infographics.
 */
export function Photo({
  name,
  className = "",
  imgClassName = "",
  sizes = "(min-width: 1024px) 600px, 100vw",
  eager = false,
  rounded = "rounded-md",
}: {
  name: ClinicPhotoName;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  eager?: boolean;
  rounded?: string;
}) {
  const photo = clinicPhotos[name];
  const { src, srcSet } = photoSrcSet(photo.stem);
  return (
    <div className={`overflow-hidden ${rounded} ${className}`}>
      <img
        alt={photo.alt}
        className={`size-full object-cover ${imgClassName}`}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        sizes={sizes}
        src={src}
        srcSet={srcSet}
        style={{ objectPosition: photo.position }}
      />
    </div>
  );
}
