-- Multi-schema datasource (public, personal): force search_path so unqualified table refs resolve to public in shadow DB rebuild.
SET search_path TO public, personal;

ALTER TABLE "clinical_series"
  ADD COLUMN "isapre_name" TEXT;

