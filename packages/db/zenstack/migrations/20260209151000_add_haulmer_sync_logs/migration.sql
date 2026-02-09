-- Create haulmer_sync_logs table
-- ZenStack migration

CREATE TABLE IF NOT EXISTS public.haulmer_sync_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(6) NOT NULL,
  rut VARCHAR(20) NOT NULL,
  doc_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  rows_created INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  csv_size INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT haulmer_sync_logs_period_rut_doc_type_key UNIQUE (period, rut, doc_type)
);

CREATE INDEX haulmer_sync_logs_period_idx ON public.haulmer_sync_logs (period);
CREATE INDEX haulmer_sync_logs_rut_idx ON public.haulmer_sync_logs (rut);
CREATE INDEX haulmer_sync_logs_status_idx ON public.haulmer_sync_logs (status);
CREATE INDEX haulmer_sync_logs_created_at_idx ON public.haulmer_sync_logs (created_at DESC);
