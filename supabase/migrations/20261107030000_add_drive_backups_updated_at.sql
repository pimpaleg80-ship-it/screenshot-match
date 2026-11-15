-- Migration: 20261107030000_add_drive_backups_updated_at.sql
-- Description: Add missing updated_at column to public.drive_backups table.

BEGIN;

ALTER TABLE public.drive_backups 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

NOTIFY pgrst, 'reload schema';

COMMIT;
