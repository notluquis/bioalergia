-- Drop unused legacy tables that are no longer referenced by the application.
DROP TABLE IF EXISTS public.backup_logs;
DROP TABLE IF EXISTS public.user_permission_versions;
