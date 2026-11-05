-- ===== Google Drive Integration Schema =====

create table if not exists public.drive_connection (
  id uuid primary key default gen_random_uuid(),
  google_email text not null,
  refresh_token_encrypted text not null,
  root_folder_id text,
  auto_backup_on_pdf boolean not null default true,
  daily_backup_enabled boolean not null default true,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.drive_connection to authenticated;
grant all on public.drive_connection to service_role;
alter table public.drive_connection enable row level security;

create policy "drive_connection: admin only"
on public.drive_connection for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ===== Google Drive Backups Log =====

create table if not exists public.drive_backups (
  id uuid primary key default gen_random_uuid(),
  file_type text not null check (file_type in ('report', 'attendance')),
  file_name text not null,
  drive_file_id text,
  drive_link text,
  period_start date,
  period_end date,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  error_message text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.drive_backups to authenticated;
grant all on public.drive_backups to service_role;
alter table public.drive_backups enable row level security;

create policy "drive_backups: admin only"
on public.drive_backups for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

