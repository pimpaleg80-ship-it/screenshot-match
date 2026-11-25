-- Migration: 20261107010000_update_drive_policies_for_superadmin.sql
-- Description: Allow both admin and superadmin to view, manage, and backup Google Drive connections.

BEGIN;

DROP POLICY IF EXISTS "drive_connection: admin only" ON public.drive_connection;
DROP POLICY IF EXISTS "drive_connection: admin or superadmin" ON public.drive_connection;

CREATE POLICY "drive_connection: admin or superadmin" ON public.drive_connection
FOR ALL TO authenticated
USING (public.is_admin_or_superadmin())
WITH CHECK (public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "drive_backups: admin only" ON public.drive_backups;
DROP POLICY IF EXISTS "drive_backups: admin or superadmin" ON public.drive_backups;

CREATE POLICY "drive_backups: admin or superadmin" ON public.drive_backups
FOR ALL TO authenticated
USING (public.is_admin_or_superadmin())
WITH CHECK (public.is_admin_or_superadmin());

COMMIT;
