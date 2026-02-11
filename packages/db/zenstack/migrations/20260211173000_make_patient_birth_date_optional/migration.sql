-- Make patient birth date optional
ALTER TABLE public.patients
  ALTER COLUMN birth_date DROP NOT NULL;
