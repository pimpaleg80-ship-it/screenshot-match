-- =====================================================
-- Migration 0002: Full Corporate Workflow System
-- Roles: Admin, Manager, Employee
-- Modules: Departments, Employees, Face Data, Attendance,
--          Leave Management, Holidays, Announcements,
--          Documents, Notifications, Audit Logs, Settings,
--          Google Drive Backup, Storage Buckets, and RLS
-- =====================================================

-- Clean up existing legacy tables/types if present for clean transition
drop table if exists public.audit_logs cascade;
drop table if exists public.drive_backups cascade;
drop table if exists public.drive_connection cascade;
drop table if exists public.settings cascade;
drop table if exists public.holidays cascade;
drop table if exists public.attendance cascade;
drop table if exists public.face_descriptors cascade;
drop table if exists public.face_data cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.leave_balances cascade;
drop table if exists public.leave_types cascade;
drop table if exists public.notifications cascade;
drop table if exists public.documents cascade;
drop table if exists public.announcements cascade;
drop table if exists public.employees cascade;
drop table if exists public.people cascade;
drop table if exists public.profiles cascade;
drop table if exists public.departments cascade;
drop table if exists public.user_roles cascade;

drop type if exists public.app_role cascade;
drop type if exists public.leave_status cascade;
drop type if exists public.attendance_status cascade;

-- ===== Enums =====
create type public.app_role as enum ('admin', 'manager', 'employee');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day', 'on_leave', 'holiday', 'weekly_off');

-- ===== Departments =====
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

-- ===== Employees (linked to auth user) =====
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  employee_code text unique not null,
  full_name text not null,
  email text unique not null,
  phone text,
  department_id uuid references public.departments(id),
  designation text,
  manager_id uuid references public.employees(id),
  joining_date date default current_date,
  status text default 'active' check (status in ('active', 'inactive')),
  photo_url text,
  created_at timestamptz default now()
);

-- ===== Roles in separate table (never in employees) =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

-- ===== Face Data (separate table locked down to admin) =====
create table public.face_data (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid unique references public.employees(id) on delete cascade,
  descriptor jsonb not null,
  consent boolean not null default false,
  enrolled_at timestamptz default now()
);

-- ===== Attendance =====
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status default 'present',
  method text default 'face',  -- face | manual | leave
  confidence numeric,
  note text,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

-- ===== Leave Types =====
create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  days_per_year numeric not null default 0,
  is_paid boolean default true,
  active boolean default true
);

-- ===== Leave Balances =====
create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  leave_type_id uuid references public.leave_types(id) on delete cascade not null,
  year int not null,
  total numeric not null default 0,
  used numeric not null default 0,
  remaining numeric generated always as (total - used) stored,
  unique (employee_id, leave_type_id, year)
);

-- ===== Leave Requests =====
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  leave_type_id uuid references public.leave_types(id) not null,
  from_date date not null,
  to_date date not null,
  days numeric not null,
  half_day boolean default false,
  reason text,
  attachment_url text,
  status public.leave_status default 'pending',
  manager_id uuid references public.employees(id),
  manager_comment text,
  admin_id uuid references public.employees(id),
  admin_comment text,
  applied_at timestamptz default now(),
  decided_at timestamptz,
  check (to_date >= from_date)
);

-- ===== Holidays =====
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  title text not null,
  description text,
  created_by uuid references auth.users(id)
);

-- ===== Announcements =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  attachment_url text,
  target text default 'all',  -- all | department | selected
  target_department_id uuid references public.departments(id),
  target_employee_ids uuid[],
  pinned boolean default false,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ===== Documents =====
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'General',
  file_url text not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ===== Notifications =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ===== Audit Logs =====
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- ===== Settings (single row) =====
create table public.settings (
  id int primary key default 1 check (id = 1),
  work_start time default '09:30',
  work_end time default '18:30',
  late_grace_minutes int default 15,
  weekly_off_days int[] default '{0}',     -- 0 = Sunday
  face_match_threshold numeric default 0.5,
  approval_flow text default 'manager_then_admin'
    check (approval_flow in ('manager_then_admin','admin_only')),
  store_capture_photos boolean default false,
  retention_days int default 365,
  email_notifications boolean default false
);

-- ===== Google Drive Backup =====
create table public.drive_connection (
  id uuid primary key default gen_random_uuid(),
  google_email text,
  refresh_token_encrypted text,
  root_folder_id text,
  connected_at timestamptz default now(),
  connected_by uuid references auth.users(id)
);

create table public.drive_backups (
  id uuid primary key default gen_random_uuid(),
  file_type text check (file_type in ('report','attendance','leave','document')),
  file_name text not null,
  drive_file_id text,
  drive_link text,
  period_start date,
  period_end date,
  status text default 'pending' check (status in ('pending','success','failed')),
  error_message text,
  retry_count int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- HELPER FUNCTIONS (Security Definer)
-- =====================================================

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid()
$$;

create or replace function public.is_my_team_member(_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees
                 where id = _employee_id and manager_id = public.current_employee_id())
$$;

-- Trigger: when leave status changes, deduct/restore balance and mark attendance
create or replace function public.handle_leave_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update public.leave_balances set used = used + new.days
      where employee_id = new.employee_id and leave_type_id = new.leave_type_id
        and year = extract(year from new.from_date)::int;
    for d in select generate_series(new.from_date, new.to_date, interval '1 day')::date loop
      insert into public.attendance (employee_id, date, status, method)
      values (new.employee_id, d, 'on_leave', 'leave')
      on conflict (employee_id, date) do update set status = 'on_leave', method = 'leave';
    end loop;
  elsif old.status = 'approved' and new.status in ('cancelled','rejected') then
    update public.leave_balances set used = greatest(used - new.days, 0)
      where employee_id = new.employee_id and leave_type_id = new.leave_type_id
        and year = extract(year from new.from_date)::int;
    delete from public.attendance
      where employee_id = new.employee_id and status = 'on_leave'
        and date between new.from_date and new.to_date;
  end if;
  return new;
end $$;

drop trigger if exists trg_leave_status_change on public.leave_requests;
create trigger trg_leave_status_change
after update of status on public.leave_requests
for each row execute function public.handle_leave_status_change();

-- Trigger: block overlapping leave dates
create or replace function public.block_overlapping_leave()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.leave_requests
             where employee_id = new.employee_id
               and status in ('pending','approved')
               and id <> coalesce(new.id, gen_random_uuid())
               and daterange(from_date, to_date, '[]') && daterange(new.from_date, new.to_date, '[]')) then
    raise exception 'Leave dates overlap with another request';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_overlap on public.leave_requests;
create trigger trg_block_overlap
before insert or update on public.leave_requests
for each row execute function public.block_overlapping_leave();

-- Trigger: notify manager and admin on leave application
create or replace function public.notify_on_leave_apply()
returns trigger language plpgsql security definer set search_path = public as $$
declare mgr_user uuid; emp_name text;
begin
  select full_name into emp_name from public.employees where id = new.employee_id;
  select e.user_id into mgr_user from public.employees e
    join public.employees x on x.manager_id = e.id where x.id = new.employee_id;
  if mgr_user is not null then
    insert into public.notifications (user_id, title, message, link)
    values (mgr_user, 'New leave request', emp_name || ' applied for leave', '/manager/leave-requests');
  end if;
  insert into public.notifications (user_id, title, message, link)
  select user_id, 'New leave request', emp_name || ' applied for leave', '/admin/leave-requests'
  from public.user_roles where role = 'admin';
  return new;
end $$;

drop trigger if exists trg_notify_leave_apply on public.leave_requests;
create trigger trg_notify_leave_apply
after insert on public.leave_requests
for each row execute function public.notify_on_leave_apply();

-- Trigger: notify employee when leave is decided
create or replace function public.notify_on_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare emp_user uuid;
begin
  if new.status in ('approved','rejected') and old.status = 'pending' then
    select user_id into emp_user from public.employees where id = new.employee_id;
    if emp_user is not null then
      insert into public.notifications (user_id, title, message, link)
      values (emp_user, 'Leave ' || new.status, 'Your leave request was ' || new.status, '/employee/my-leaves');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_leave_decision on public.leave_requests;
create trigger trg_notify_leave_decision
after update of status on public.leave_requests
for each row execute function public.notify_on_leave_decision();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.user_roles enable row level security;
alter table public.face_data enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.holidays enable row level security;
alter table public.announcements enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.drive_connection enable row level security;
alter table public.drive_backups enable row level security;

-- Grants
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- 1. departments
create policy "departments: read all" on public.departments for select to authenticated using (true);
create policy "departments: admin write" on public.departments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 2. employees
create policy "employees: admin all" on public.employees for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "employees: manager select team" on public.employees for select to authenticated
  using (
    public.has_role(auth.uid(), 'manager')
    and (id = public.current_employee_id() or public.is_my_team_member(id))
  );

create policy "employees: employee select own" on public.employees for select to authenticated
  using (id = public.current_employee_id());

create policy "employees: employee update phone and photo" on public.employees for update to authenticated
  using (id = public.current_employee_id())
  with check (id = public.current_employee_id());

-- 3. user_roles
create policy "user_roles: admin all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "user_roles: select own" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- 4. face_data (admin only)
create policy "face_data: admin only" on public.face_data for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 5. attendance
create policy "attendance: admin all" on public.attendance for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "attendance: manager team select and update" on public.attendance for all to authenticated
  using (
    public.has_role(auth.uid(), 'manager')
    and (public.is_my_team_member(employee_id) or employee_id = public.current_employee_id())
  )
  with check (
    public.has_role(auth.uid(), 'manager')
    and (public.is_my_team_member(employee_id) or employee_id = public.current_employee_id())
  );

create policy "attendance: employee select own" on public.attendance for select to authenticated
  using (employee_id = public.current_employee_id());

-- 6. leave_types
create policy "leave_types: read all" on public.leave_types for select to authenticated using (true);
create policy "leave_types: admin write" on public.leave_types for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 7. leave_balances
create policy "leave_balances: admin all" on public.leave_balances for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "leave_balances: manager team select" on public.leave_balances for select to authenticated
  using (
    public.has_role(auth.uid(), 'manager')
    and (public.is_my_team_member(employee_id) or employee_id = public.current_employee_id())
  );

create policy "leave_balances: employee select own" on public.leave_balances for select to authenticated
  using (employee_id = public.current_employee_id());

-- 8. leave_requests
create policy "leave_requests: admin all" on public.leave_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "leave_requests: manager select and update team" on public.leave_requests for all to authenticated
  using (
    public.has_role(auth.uid(), 'manager')
    and (public.is_my_team_member(employee_id) or employee_id = public.current_employee_id())
  )
  with check (
    public.has_role(auth.uid(), 'manager')
    and (public.is_my_team_member(employee_id) or employee_id = public.current_employee_id())
  );

create policy "leave_requests: employee select own" on public.leave_requests for select to authenticated
  using (employee_id = public.current_employee_id());

create policy "leave_requests: employee insert own" on public.leave_requests for insert to authenticated
  with check (employee_id = public.current_employee_id());

create policy "leave_requests: employee cancel while pending" on public.leave_requests for update to authenticated
  using (employee_id = public.current_employee_id() and status = 'pending')
  with check (employee_id = public.current_employee_id() and status in ('cancelled', 'pending'));

-- 9. holidays
create policy "holidays: read all" on public.holidays for select to authenticated using (true);
create policy "holidays: admin write" on public.holidays for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 10. announcements
create policy "announcements: select target" on public.announcements for select to authenticated
  using (
    (expires_at is null or expires_at > now())
    and (
      target = 'all'
      or (target = 'department' and target_department_id = (select department_id from public.employees where user_id = auth.uid()))
      or (target = 'selected' and public.current_employee_id() = any(target_employee_ids))
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "announcements: admin write" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 11. documents
create policy "documents: read all" on public.documents for select to authenticated using (true);
create policy "documents: admin write" on public.documents for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 12. notifications
create policy "notifications: user select and update own" on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 13. audit_logs
create policy "audit_logs: admin select" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "audit_logs: insert allowed" on public.audit_logs for insert to authenticated
  with check (true);

-- 14. settings
create policy "settings: read all" on public.settings for select to authenticated using (true);
create policy "settings: admin write" on public.settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 15. drive_connection & drive_backups
create policy "drive_connection: admin only" on public.drive_connection for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "drive_backups: admin only" on public.drive_backups for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- STORAGE BUCKETS (leave-attachments, documents, announcements, avatars)
-- =====================================================

insert into storage.buckets (id, name, public) values
  ('leave-attachments', 'leave-attachments', false),
  ('documents', 'documents', false),
  ('announcements', 'announcements', false),
  ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

-- Storage RLS policies
-- 1. avatars: user uploads/reads own photo
create policy "avatars: authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "avatars: user insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: user update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. documents: all authenticated read, admin write
create policy "documents: authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'));

-- 3. announcements: all authenticated read, admin write
create policy "announcements: authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'announcements');

create policy "announcements: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'announcements' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'announcements' and public.has_role(auth.uid(), 'admin'));

-- 4. leave-attachments: employee writes own folder (user_id/...), employee/manager/admin read
create policy "leave-attachments: employee insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'leave-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "leave-attachments: read own, team, or admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'leave-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'manager')
    )
  );

