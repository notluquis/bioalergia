-- Patient source table from DTE sales
-- Keeps source records independent from dte_sale_details and patient lifecycle

CREATE TABLE IF NOT EXISTS public.patient_dte_sale_sources (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER,
  client_rut VARCHAR(20) NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  document_type INTEGER NOT NULL,
  document_date DATE,
  folio VARCHAR(20),
  period VARCHAR(6),
  source_updated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT patient_dte_sale_sources_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL
);

CREATE INDEX patient_dte_sale_sources_patient_id_idx
  ON public.patient_dte_sale_sources (patient_id);
CREATE INDEX patient_dte_sale_sources_document_date_idx
  ON public.patient_dte_sale_sources (document_date);
CREATE INDEX patient_dte_sale_sources_period_idx
  ON public.patient_dte_sale_sources (period);
