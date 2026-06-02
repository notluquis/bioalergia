-- AlterTable: variante AVIF (mejor compresión) para <picture>
ALTER TABLE "product_images" ADD COLUMN "avif_srcset" TEXT;
