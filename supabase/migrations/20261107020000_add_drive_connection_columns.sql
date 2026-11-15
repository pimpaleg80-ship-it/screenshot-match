-- Migration: 20261107020000_add_drive_connection_columns.sql
-- Description: Add missing updated_at and daily_backup_enabled columns to public.drive_connection.

BEGIN;

ALTER TABLE public.drive_connection 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS daily_backup_enabled boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';

COMMIT;
