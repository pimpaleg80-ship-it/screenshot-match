-- ===== roles =====
create type public.app_role as enum ('admin', 'manager', 'kiosk');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "roles: own or admin"
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===== profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  department text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "profiles: self or admin read"
on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profiles: self update"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles: admin all"
on public.profiles for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- auto-create profile + role on signup (first user = admin, rest = manager)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email);
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'manager');
  end if;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== people =====
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  person_code text not null unique,
  department text not null default 'General',
  email text,
  phone text,
  consent boolean not null default false,
  active boolean not null default true,
  photo_url text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.people to authenticated;
grant all on public.people to service_role;
alter table public.people enable row level security;

create policy "people: admin full"
on public.people for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "people: manager read own department"
on public.people for select to authenticated
using (
  public.has_role(auth.uid(), 'manager')
  and department = (select department from public.profiles where id = auth.uid())
);

create policy "people: kiosk read"
on public.people for select to authenticated
using (public.has_role(auth.uid(), 'kiosk'));

-- ===== face descriptors (separate table: never exposed to managers) =====
create table public.face_descriptors (
  person_id uuid primary key references public.people(id) on delete cascade,
  descriptor jsonb not null,
  samples int not null default 1,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.face_descriptors to authenticated;
grant all on public.face_descriptors to service_role;
alter table public.face_descriptors enable row level security;

create policy "descriptors: admin full"
on public.face_descriptors for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "descriptors: kiosk read for matching"
on public.face_descriptors for select to authenticated
using (public.has_role(auth.uid(), 'kiosk'));

-- ===== attendance =====
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present',
  method text not null default 'face',
  confidence real,
  photo_url text,
  edit_reason text,
  edited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, date)
);

grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

create policy "attendance: admin full"
on public.attendance for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "attendance: manager read own department"
on public.attendance for select to authenticated
using (
  public.has_role(auth.uid(), 'manager')
  and exists (
    select 1 from public.people p
    where p.id = attendance.person_id
      and p.department = (select department from public.profiles where id = auth.uid())
  )
);

create policy "attendance: kiosk read"
on public.attendance for select to authenticated
using (public.has_role(auth.uid(), 'kiosk'));

create policy "attendance: kiosk/manager check-in insert"
on public.attendance for insert to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'manager')
  or public.has_role(auth.uid(), 'kiosk')
);

-- ===== holidays =====
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  title text not null
);

grant select, insert, update, delete on public.holidays to authenticated;
grant all on public.holidays to service_role;
alter table public.holidays enable row level security;

create policy "holidays: all authenticated read"
on public.holidays for select to authenticated
using (true);

create policy "holidays: admin write"
on public.holidays for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ===== settings (single row) =====
create table public.settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default 'My Organization',
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  late_grace_minutes int not null default 10,
  half_day_hours numeric not null default 4,
  weekly_off_days int[] not null default '{0,6}',
  face_match_threshold numeric not null default 0.5,
  store_photos boolean not null default false,
  data_retention_days int not null default 365,
  duplicate_scan_minutes int not null default 5,
  updated_at timestamptz not null default now()
);

grant select, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;

create policy "settings: all authenticated read"
on public.settings for select to authenticated
using (true);

create policy "settings: admin update"
on public.settings for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ===== audit logs =====
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

create policy "audit: app users can insert"
on public.audit_logs for insert to authenticated
with check (true);

create policy "audit: admin read"
on public.audit_logs for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- ===== sample data =====
insert into public.settings (id) values (1) on conflict do nothing;

insert into public.people (name, person_code, department, email, phone, consent) values
('Aarav Sharma', 'EMP001', 'Engineering', 'aarav@example.com', '+91 98100 00001', true),
('Diya Patel', 'EMP002', 'Engineering', 'diya@example.com', '+91 98100 00002', true),
('Rohan Mehta', 'EMP003', 'Sales', 'rohan@example.com', '+91 98100 00003', true),
('Isha Nair', 'EMP004', 'Sales', 'isha@example.com', '+91 98100 00004', true),
('Karan Singh', 'EMP005', 'Marketing', 'karan@example.com', '+91 98100 00005', true),
('Meera Iyer', 'EMP006', 'Marketing', 'meera@example.com', '+91 98100 00006', true),
('Vikram Rao', 'EMP007', 'Operations', 'vikram@example.com', '+91 98100 00007', true),
('Ananya Gupta', 'EMP008', 'Operations', 'ananya@example.com', '+91 98100 00008', true),
('Siddharth Joshi', 'EMP009', 'HR', 'sid@example.com', '+91 98100 00009', true),
('Pooja Desai', 'EMP010', 'HR', 'pooja@example.com', '+91 98100 00010', true),
('Arjun Kapoor', 'EMP011', 'Engineering', 'arjun@example.com', '+91 98100 00011', true),
('Neha Verma', 'EMP012', 'Sales', 'neha@example.com', '+91 98100 00012', true);

insert into public.holidays (date, title) values
(current_date + 15, 'Founders Day'),
(current_date + 40, 'Winter Break');

-- 30 days of sample attendance (skips weekly offs, holidays and a few absences)
with days as (
  select
    p.id as person_id,
    d,
    (530 + floor(random() * 60)::int) as in_mins,
    (1020 + floor(random() * 80)::int) as out_mins
  from public.people p
  cross join generate_series(
    current_date - interval '29 days',
    current_date - interval '1 day',
    interval '1 day'
  ) as d
  where extract(isodow from d) not in (6, 7)
    and d::date not in (select date from public.holidays)
    and random() < 0.92
)
insert into public.attendance (person_id, date, check_in, check_out, status, method, confidence)
select
  person_id,
  d::date,
  d + make_interval(mins => in_mins),
  d + make_interval(mins => out_mins),
  case when in_mins > 550 then 'late' else 'present' end,
  'face',
  round((0.4 + random() * 0.1)::numeric, 2)
from days
on conflict (person_id, date) do nothing;