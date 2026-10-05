-- Fresh projects only. Existing installations need an audited data/Auth migration.
-- No DROP statements: a legacy schema causes this migration to fail safely.
do $$ begin
  if to_regclass('public.users') is not null then
    raise exception 'EduTrack tables already exist. Back up and migrate the existing installation separately.';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  timetable_type text not null default '5-day' check (timetable_type in ('5-day','10-day')),
  periods_per_day integer not null default 8 check (periods_per_day between 1 and 15),
  logo_url text, school_start time, school_end time,
  created_at timestamptz not null default now()
);
-- Passwords live only in Supabase Auth. Deactivated profiles retain historical attribution.
create table public.users (
  id uuid primary key references auth.users(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  username text not null unique check (username = lower(trim(username)) and length(username) between 1 and 100),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  role text not null check (role in ('admin','admin-teacher','smt','teacher','monitor-guardian')),
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['admin','admin-teacher','smt','teacher','monitor-guardian']::text[] and role = any(roles)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create function private.current_school_id() returns uuid language sql stable security definer set search_path = '' as $$
  select school_id from public.users where id = (select auth.uid()) and active;
$$;
create function private.has_role(variadic required text[]) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select roles && required from public.users where id = (select auth.uid()) and active), false);
$$;
revoke all on function private.current_school_id(), private.has_role(text[]) from public;
grant execute on function private.current_school_id(), private.has_role(text[]) to authenticated, service_role;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, surname text not null, student_number text, grade integer check (grade between 0 and 12), photo_url text, register_class text
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, grade integer check (grade between 0 and 12)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, grade integer check (grade between 0 and 12), is_caps boolean not null default false
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (true),
  user_id uuid not null references public.users(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  unique nulls not distinct (user_id,class_id,subject_id)
);

create table public.class_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (true),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  unique(student_id,class_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, period integer not null check (period between 1 and 15), status text not null check (status in ('present','absent','late','sport')), note text,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  marked_by uuid not null references public.users(id) on delete restrict,
  unique(student_id,class_id,date,period)
);

create table public.demerit_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, points integer not null check (points > 0)
);

create table public.demerits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, notes text, grade integer check (grade between 0 and 12),
  student_id uuid not null references public.students(id) on delete cascade,
  demerit_type_id uuid not null references public.demerit_types(id) on delete restrict,
  given_by uuid not null references public.users(id) on delete restrict
);

create table public.merit_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, points integer not null check (points > 0)
);

create table public.merits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, notes text, grade integer check (grade between 0 and 12),
  student_id uuid not null references public.students(id) on delete cascade,
  merit_type_id uuid not null references public.merit_types(id) on delete restrict,
  given_by uuid not null references public.users(id) on delete restrict
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  type text not null check (type in ('batting','demerit','merit','leave','announcement')), title text not null, message text not null, data_json jsonb, read boolean not null default false, created_by uuid not null default auth.uid() references public.users(id),
  user_id uuid not null references public.users(id) on delete cascade
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  batting boolean not null default true, demerit boolean not null default true, merit boolean not null default true, leave boolean not null default true, announcement boolean not null default true,
  user_id uuid not null references public.users(id) on delete cascade,
  unique(user_id)
);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  day_number integer not null check (day_number between 1 and 10), period_number integer not null check (period_number between 1 and 15),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid not null references public.users(id) on delete restrict,
  unique(school_id,day_number,period_number,class_id)
);

create table public.period_config (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  day_number integer check (day_number between 1 and 10), period_number integer not null check (period_number between 1 and 15), start_time time, end_time time, custom_name text,
  unique nulls not distinct(school_id,day_number,period_number)
);

create table public.batting (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, period_number integer not null check (period_number between 1 and 15), status text not null default 'pending' check (status in ('pending','allocated')),
  absent_teacher_id uuid not null references public.users(id) on delete restrict,
  replacement_teacher_id uuid references public.users(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  subject text not null, body text not null, is_announcement boolean not null default false,
  sender_id uuid not null references public.users(id) on delete restrict,
  recipient_id uuid references public.users(id) on delete restrict,
  check (is_announcement or recipient_id is not null)
);

create table public.leave_register (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null default current_date, period integer check (period between 1 and 15), reason text, time_out timestamptz not null default now(), time_in timestamptz, arrived_at timestamptz, departed_at timestamptz,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  to_teacher_id uuid references public.users(id) on delete restrict,
  recorded_by uuid not null references public.users(id) on delete restrict
);

create table public.community_service (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  activity text not null, breaks integer not null check (breaks > 0), service_date date not null,
  student_id uuid not null references public.students(id) on delete cascade,
  recorded_by uuid not null references public.users(id) on delete restrict
);

create table public.community_service_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  start_date date, end_date date, required_breaks integer check (required_breaks >= 0),
  unique(school_id), check (start_date <= end_date)
);

create table public.community_service_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null
);

create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, photo_url text, grade integer check (grade between 0 and 12),
  student_id uuid references public.students(id) on delete cascade,
  unique(student_id)
);

create table public.hand_in_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, paper_count integer not null default 0 check (paper_count >= 0), handed_in text, notes text, on_duty boolean not null default false,
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  recorded_by uuid not null references public.users(id) on delete restrict
);

create table public.on_duty_register (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, break1 boolean not null default false, break2 boolean not null default false,
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  unique(date,monitor_id)
);

create table public.monitor_demerits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  date date not null, reason text not null, points integer not null check (points > 0),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  recorded_by uuid not null references public.users(id) on delete restrict
);

create table public.monitor_demerit_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references public.schools(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null, points integer not null check (points > 0)
);

-- References must belong to the same school, even when the parent is hidden by RLS.
-- Preserve simple FK names for the application's PostgREST joins.
create function private.enforce_school_links() returns trigger language plpgsql security definer set search_path = '' as $$
declare i integer; parent_school uuid; parent_id uuid;
begin
  if tg_op = 'UPDATE' and new.school_id is distinct from old.school_id then
    raise exception 'School ownership is immutable' using errcode = '23514';
  end if;
  if tg_nargs > 0 then
    for i in 0..tg_nargs-1 by 2 loop
      parent_id := (to_jsonb(new)->>tg_argv[i])::uuid;
      if parent_id is not null then
        execute format('select school_id from public.%I where id = $1', tg_argv[i+1]) into parent_school using parent_id;
        if parent_school is distinct from new.school_id then
          raise exception 'Related record belongs to another school or does not exist' using errcode = '23503';
        end if;
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.enforce_school_links() from public;

create trigger enforce_school_links before insert or update on public.users for each row execute function private.enforce_school_links();
create index users_school_idx on public.users(school_id);
create trigger enforce_school_links before insert or update on public.students for each row execute function private.enforce_school_links();
create index students_school_idx on public.students(school_id);
create trigger enforce_school_links before insert or update on public.classes for each row execute function private.enforce_school_links();
create index classes_school_idx on public.classes(school_id);
create trigger enforce_school_links before insert or update on public.subjects for each row execute function private.enforce_school_links();
create index subjects_school_idx on public.subjects(school_id);
create trigger enforce_school_links before insert or update on public.allocations for each row execute function private.enforce_school_links('user_id', 'users', 'class_id', 'classes', 'subject_id', 'subjects');
create index allocations_school_idx on public.allocations(school_id);
create index allocations_user_id_idx on public.allocations(user_id);
create index allocations_class_id_idx on public.allocations(class_id);
create index allocations_subject_id_idx on public.allocations(subject_id);
create trigger enforce_school_links before insert or update on public.class_students for each row execute function private.enforce_school_links('student_id', 'students', 'class_id', 'classes');
create index class_students_school_idx on public.class_students(school_id);
create index class_students_student_id_idx on public.class_students(student_id);
create index class_students_class_id_idx on public.class_students(class_id);
create trigger enforce_school_links before insert or update on public.attendance for each row execute function private.enforce_school_links('student_id', 'students', 'class_id', 'classes', 'marked_by', 'users');
create index attendance_school_idx on public.attendance(school_id);
create index attendance_student_id_idx on public.attendance(student_id);
create index attendance_class_id_idx on public.attendance(class_id);
create index attendance_marked_by_idx on public.attendance(marked_by);
create trigger enforce_school_links before insert or update on public.demerit_types for each row execute function private.enforce_school_links();
create index demerit_types_school_idx on public.demerit_types(school_id);
create trigger enforce_school_links before insert or update on public.demerits for each row execute function private.enforce_school_links('student_id', 'students', 'demerit_type_id', 'demerit_types', 'given_by', 'users');
create index demerits_school_idx on public.demerits(school_id);
create index demerits_student_id_idx on public.demerits(student_id);
create index demerits_demerit_type_id_idx on public.demerits(demerit_type_id);
create index demerits_given_by_idx on public.demerits(given_by);
create trigger enforce_school_links before insert or update on public.merit_types for each row execute function private.enforce_school_links();
create index merit_types_school_idx on public.merit_types(school_id);
create trigger enforce_school_links before insert or update on public.merits for each row execute function private.enforce_school_links('student_id', 'students', 'merit_type_id', 'merit_types', 'given_by', 'users');
create index merits_school_idx on public.merits(school_id);
create index merits_student_id_idx on public.merits(student_id);
create index merits_merit_type_id_idx on public.merits(merit_type_id);
create index merits_given_by_idx on public.merits(given_by);
create trigger enforce_school_links before insert or update on public.notifications for each row execute function private.enforce_school_links('user_id', 'users', 'created_by', 'users');
create index notifications_school_idx on public.notifications(school_id);
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_created_by_idx on public.notifications(created_by);
create trigger enforce_school_links before insert or update on public.notification_preferences for each row execute function private.enforce_school_links('user_id', 'users');
create index notification_preferences_school_idx on public.notification_preferences(school_id);
create index notification_preferences_user_id_idx on public.notification_preferences(user_id);
create trigger enforce_school_links before insert or update on public.timetable_entries for each row execute function private.enforce_school_links('class_id', 'classes', 'subject_id', 'subjects', 'teacher_id', 'users');
create index timetable_entries_school_idx on public.timetable_entries(school_id);
create index timetable_entries_class_id_idx on public.timetable_entries(class_id);
create index timetable_entries_subject_id_idx on public.timetable_entries(subject_id);
create index timetable_entries_teacher_id_idx on public.timetable_entries(teacher_id);
create trigger enforce_school_links before insert or update on public.period_config for each row execute function private.enforce_school_links();
create index period_config_school_idx on public.period_config(school_id);
create trigger enforce_school_links before insert or update on public.batting for each row execute function private.enforce_school_links('absent_teacher_id', 'users', 'replacement_teacher_id', 'users', 'class_id', 'classes');
create index batting_school_idx on public.batting(school_id);
create index batting_absent_teacher_id_idx on public.batting(absent_teacher_id);
create index batting_replacement_teacher_id_idx on public.batting(replacement_teacher_id);
create index batting_class_id_idx on public.batting(class_id);
create trigger enforce_school_links before insert or update on public.messages for each row execute function private.enforce_school_links('sender_id', 'users', 'recipient_id', 'users');
create index messages_school_idx on public.messages(school_id);
create index messages_sender_id_idx on public.messages(sender_id);
create index messages_recipient_id_idx on public.messages(recipient_id);
create trigger enforce_school_links before insert or update on public.leave_register for each row execute function private.enforce_school_links('student_id', 'students', 'class_id', 'classes', 'to_teacher_id', 'users', 'recorded_by', 'users');
create index leave_register_school_idx on public.leave_register(school_id);
create index leave_register_student_id_idx on public.leave_register(student_id);
create index leave_register_class_id_idx on public.leave_register(class_id);
create index leave_register_to_teacher_id_idx on public.leave_register(to_teacher_id);
create index leave_register_recorded_by_idx on public.leave_register(recorded_by);
create trigger enforce_school_links before insert or update on public.community_service for each row execute function private.enforce_school_links('student_id', 'students', 'recorded_by', 'users');
create index community_service_school_idx on public.community_service(school_id);
create index community_service_student_id_idx on public.community_service(student_id);
create index community_service_recorded_by_idx on public.community_service(recorded_by);
create trigger enforce_school_links before insert or update on public.community_service_settings for each row execute function private.enforce_school_links();
create index community_service_settings_school_idx on public.community_service_settings(school_id);
create trigger enforce_school_links before insert or update on public.community_service_types for each row execute function private.enforce_school_links();
create index community_service_types_school_idx on public.community_service_types(school_id);
create trigger enforce_school_links before insert or update on public.monitors for each row execute function private.enforce_school_links('student_id', 'students');
create index monitors_school_idx on public.monitors(school_id);
create index monitors_student_id_idx on public.monitors(student_id);
create trigger enforce_school_links before insert or update on public.hand_in_log for each row execute function private.enforce_school_links('monitor_id', 'monitors', 'recorded_by', 'users');
create index hand_in_log_school_idx on public.hand_in_log(school_id);
create index hand_in_log_monitor_id_idx on public.hand_in_log(monitor_id);
create index hand_in_log_recorded_by_idx on public.hand_in_log(recorded_by);
create trigger enforce_school_links before insert or update on public.on_duty_register for each row execute function private.enforce_school_links('monitor_id', 'monitors');
create index on_duty_register_school_idx on public.on_duty_register(school_id);
create index on_duty_register_monitor_id_idx on public.on_duty_register(monitor_id);
create trigger enforce_school_links before insert or update on public.monitor_demerits for each row execute function private.enforce_school_links('monitor_id', 'monitors', 'recorded_by', 'users');
create index monitor_demerits_school_idx on public.monitor_demerits(school_id);
create index monitor_demerits_monitor_id_idx on public.monitor_demerits(monitor_id);
create index monitor_demerits_recorded_by_idx on public.monitor_demerits(recorded_by);
create trigger enforce_school_links before insert or update on public.monitor_demerit_types for each row execute function private.enforce_school_links();
create index monitor_demerit_types_school_idx on public.monitor_demerit_types(school_id);

-- All browser traffic is authorized by a real Supabase Auth identity.
alter table public.schools enable row level security;
revoke all on public.schools from anon, authenticated;
grant all on public.schools to service_role;
alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;
alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;
grant all on public.students to service_role;
alter table public.classes enable row level security;
revoke all on public.classes from anon, authenticated;
grant all on public.classes to service_role;
alter table public.subjects enable row level security;
revoke all on public.subjects from anon, authenticated;
grant all on public.subjects to service_role;
alter table public.allocations enable row level security;
revoke all on public.allocations from anon, authenticated;
grant all on public.allocations to service_role;
alter table public.class_students enable row level security;
revoke all on public.class_students from anon, authenticated;
grant all on public.class_students to service_role;
alter table public.attendance enable row level security;
revoke all on public.attendance from anon, authenticated;
grant all on public.attendance to service_role;
alter table public.demerit_types enable row level security;
revoke all on public.demerit_types from anon, authenticated;
grant all on public.demerit_types to service_role;
alter table public.demerits enable row level security;
revoke all on public.demerits from anon, authenticated;
grant all on public.demerits to service_role;
alter table public.merit_types enable row level security;
revoke all on public.merit_types from anon, authenticated;
grant all on public.merit_types to service_role;
alter table public.merits enable row level security;
revoke all on public.merits from anon, authenticated;
grant all on public.merits to service_role;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant all on public.notification_preferences to service_role;
alter table public.timetable_entries enable row level security;
revoke all on public.timetable_entries from anon, authenticated;
grant all on public.timetable_entries to service_role;
alter table public.period_config enable row level security;
revoke all on public.period_config from anon, authenticated;
grant all on public.period_config to service_role;
alter table public.batting enable row level security;
revoke all on public.batting from anon, authenticated;
grant all on public.batting to service_role;
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant all on public.messages to service_role;
alter table public.leave_register enable row level security;
revoke all on public.leave_register from anon, authenticated;
grant all on public.leave_register to service_role;
alter table public.community_service enable row level security;
revoke all on public.community_service from anon, authenticated;
grant all on public.community_service to service_role;
alter table public.community_service_settings enable row level security;
revoke all on public.community_service_settings from anon, authenticated;
grant all on public.community_service_settings to service_role;
alter table public.community_service_types enable row level security;
revoke all on public.community_service_types from anon, authenticated;
grant all on public.community_service_types to service_role;
alter table public.monitors enable row level security;
revoke all on public.monitors from anon, authenticated;
grant all on public.monitors to service_role;
alter table public.hand_in_log enable row level security;
revoke all on public.hand_in_log from anon, authenticated;
grant all on public.hand_in_log to service_role;
alter table public.on_duty_register enable row level security;
revoke all on public.on_duty_register from anon, authenticated;
grant all on public.on_duty_register to service_role;
alter table public.monitor_demerits enable row level security;
revoke all on public.monitor_demerits from anon, authenticated;
grant all on public.monitor_demerits to service_role;
alter table public.monitor_demerit_types enable row level security;
revoke all on public.monitor_demerit_types from anon, authenticated;
grant all on public.monitor_demerit_types to service_role;
grant select on public.schools to authenticated;
create policy schools_select on public.schools for select to authenticated using (id = (select private.current_school_id()));
grant update on public.schools to authenticated;
create policy schools_update on public.schools for update to authenticated using (id = (select private.current_school_id()) and private.has_role('admin','admin-teacher')) with check (id = (select private.current_school_id()) and private.has_role('admin','admin-teacher'));
grant select on public.users to authenticated;
create policy users_select on public.users for select to authenticated using (school_id = (select private.current_school_id()));
grant select on public.students to authenticated;
create policy students_select on public.students for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.students to authenticated;
create policy students_insert on public.students for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.students to authenticated;
create policy students_update on public.students for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.students to authenticated;
create policy students_delete on public.students for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.classes to authenticated;
create policy classes_select on public.classes for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.classes to authenticated;
create policy classes_insert on public.classes for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.classes to authenticated;
create policy classes_update on public.classes for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.classes to authenticated;
create policy classes_delete on public.classes for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.subjects to authenticated;
create policy subjects_select on public.subjects for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.subjects to authenticated;
create policy subjects_insert on public.subjects for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.subjects to authenticated;
create policy subjects_update on public.subjects for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.subjects to authenticated;
create policy subjects_delete on public.subjects for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.allocations to authenticated;
create policy allocations_select on public.allocations for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.allocations to authenticated;
create policy allocations_insert on public.allocations for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.allocations to authenticated;
create policy allocations_update on public.allocations for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.allocations to authenticated;
create policy allocations_delete on public.allocations for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.class_students to authenticated;
create policy class_students_select on public.class_students for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.class_students to authenticated;
create policy class_students_insert on public.class_students for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.class_students to authenticated;
create policy class_students_update on public.class_students for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.class_students to authenticated;
create policy class_students_delete on public.class_students for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.attendance to authenticated;
create policy attendance_select on public.attendance for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.attendance to authenticated;
create policy attendance_insert on public.attendance for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and marked_by = (select auth.uid()));
grant update on public.attendance to authenticated;
create policy attendance_update on public.attendance for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and (marked_by = (select auth.uid()) or private.has_role('admin','admin-teacher','smt'))) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and (marked_by = (select auth.uid()) or private.has_role('admin','admin-teacher','smt')));
grant delete on public.attendance to authenticated;
create policy attendance_delete on public.attendance for delete to authenticated using (school_id = (select private.current_school_id()) and (private.has_role('admin','admin-teacher','smt') or (private.has_role('admin','admin-teacher','smt','teacher') and marked_by = (select auth.uid()))));
grant select on public.demerit_types to authenticated;
create policy demerit_types_select on public.demerit_types for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.demerit_types to authenticated;
create policy demerit_types_insert on public.demerit_types for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.demerit_types to authenticated;
create policy demerit_types_update on public.demerit_types for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.demerit_types to authenticated;
create policy demerit_types_delete on public.demerit_types for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.demerits to authenticated;
create policy demerits_select on public.demerits for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.demerits to authenticated;
create policy demerits_insert on public.demerits for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and given_by = (select auth.uid()));
grant delete on public.demerits to authenticated;
create policy demerits_delete on public.demerits for delete to authenticated using (school_id = (select private.current_school_id()) and (private.has_role('admin','admin-teacher','smt')));
grant select on public.merit_types to authenticated;
create policy merit_types_select on public.merit_types for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.merit_types to authenticated;
create policy merit_types_insert on public.merit_types for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant update on public.merit_types to authenticated;
create policy merit_types_update on public.merit_types for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.merit_types to authenticated;
create policy merit_types_delete on public.merit_types for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.merits to authenticated;
create policy merits_select on public.merits for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.merits to authenticated;
create policy merits_insert on public.merits for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and given_by = (select auth.uid()));
grant delete on public.merits to authenticated;
create policy merits_delete on public.merits for delete to authenticated using (school_id = (select private.current_school_id()) and (private.has_role('admin','admin-teacher','smt')));
grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
grant update on public.notifications to authenticated;
create policy notifications_update on public.notifications for update to authenticated using (school_id = (select private.current_school_id()) and user_id = (select auth.uid())) with check (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
grant delete on public.notifications to authenticated;
create policy notifications_delete on public.notifications for delete to authenticated using (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update(read) on public.notifications to authenticated;
grant insert on public.notifications to authenticated;
create policy notifications_insert on public.notifications for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and created_by = (select auth.uid()) and (type <> 'announcement' or private.has_role('admin','admin-teacher')));
grant select on public.notification_preferences to authenticated;
create policy notification_preferences_select on public.notification_preferences for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.notification_preferences to authenticated;
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated with check (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
grant update on public.notification_preferences to authenticated;
create policy notification_preferences_update on public.notification_preferences for update to authenticated using (school_id = (select private.current_school_id()) and user_id = (select auth.uid())) with check (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
grant delete on public.notification_preferences to authenticated;
create policy notification_preferences_delete on public.notification_preferences for delete to authenticated using (school_id = (select private.current_school_id()) and user_id = (select auth.uid()));
grant select on public.timetable_entries to authenticated;
create policy timetable_entries_select on public.timetable_entries for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.timetable_entries to authenticated;
create policy timetable_entries_insert on public.timetable_entries for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.timetable_entries to authenticated;
create policy timetable_entries_update on public.timetable_entries for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.timetable_entries to authenticated;
create policy timetable_entries_delete on public.timetable_entries for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.period_config to authenticated;
create policy period_config_select on public.period_config for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.period_config to authenticated;
create policy period_config_insert on public.period_config for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.period_config to authenticated;
create policy period_config_update on public.period_config for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.period_config to authenticated;
create policy period_config_delete on public.period_config for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.batting to authenticated;
create policy batting_select on public.batting for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.batting to authenticated;
create policy batting_insert on public.batting for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and absent_teacher_id = (select auth.uid()) and replacement_teacher_id is null and status = 'pending');
grant update on public.batting to authenticated;
create policy batting_update on public.batting for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.batting to authenticated;
create policy batting_delete on public.batting for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.messages to authenticated;
create policy messages_select on public.messages for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and (is_announcement or sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));
grant insert on public.messages to authenticated;
create policy messages_insert on public.messages for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and sender_id = (select auth.uid()) and (not is_announcement or private.has_role('admin','admin-teacher')));
grant delete on public.messages to authenticated;
create policy messages_delete on public.messages for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher'));
grant select on public.leave_register to authenticated;
create policy leave_register_select on public.leave_register for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.leave_register to authenticated;
create policy leave_register_insert on public.leave_register for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and recorded_by = (select auth.uid()));
grant update on public.leave_register to authenticated;
create policy leave_register_update on public.leave_register for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and (recorded_by = (select auth.uid()) or to_teacher_id = (select auth.uid()) or private.has_role('admin','admin-teacher','smt'))) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and (recorded_by = (select auth.uid()) or to_teacher_id = (select auth.uid()) or private.has_role('admin','admin-teacher','smt')));
grant delete on public.leave_register to authenticated;
create policy leave_register_delete on public.leave_register for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.community_service to authenticated;
create policy community_service_select on public.community_service for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.community_service to authenticated;
create policy community_service_insert on public.community_service for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher') and recorded_by = (select auth.uid()));
grant delete on public.community_service to authenticated;
create policy community_service_delete on public.community_service for delete to authenticated using (school_id = (select private.current_school_id()) and (private.has_role('admin','admin-teacher','smt') or (private.has_role('admin','admin-teacher','smt','teacher') and recorded_by = (select auth.uid()))));
grant select on public.community_service_settings to authenticated;
create policy community_service_settings_select on public.community_service_settings for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.community_service_settings to authenticated;
create policy community_service_settings_insert on public.community_service_settings for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.community_service_settings to authenticated;
create policy community_service_settings_update on public.community_service_settings for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.community_service_settings to authenticated;
create policy community_service_settings_delete on public.community_service_settings for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.community_service_types to authenticated;
create policy community_service_types_select on public.community_service_types for select to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','teacher'));
grant insert on public.community_service_types to authenticated;
create policy community_service_types_insert on public.community_service_types for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant update on public.community_service_types to authenticated;
create policy community_service_types_update on public.community_service_types for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant delete on public.community_service_types to authenticated;
create policy community_service_types_delete on public.community_service_types for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt'));
grant select on public.monitors to authenticated;
create policy monitors_select on public.monitors for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.monitors to authenticated;
create policy monitors_insert on public.monitors for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant update on public.monitors to authenticated;
create policy monitors_update on public.monitors for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant delete on public.monitors to authenticated;
create policy monitors_delete on public.monitors for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant select on public.hand_in_log to authenticated;
create policy hand_in_log_select on public.hand_in_log for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.hand_in_log to authenticated;
create policy hand_in_log_insert on public.hand_in_log for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian') and recorded_by = (select auth.uid()));
grant update on public.hand_in_log to authenticated;
create policy hand_in_log_update on public.hand_in_log for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant delete on public.hand_in_log to authenticated;
create policy hand_in_log_delete on public.hand_in_log for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant select on public.on_duty_register to authenticated;
create policy on_duty_register_select on public.on_duty_register for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.on_duty_register to authenticated;
create policy on_duty_register_insert on public.on_duty_register for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant update on public.on_duty_register to authenticated;
create policy on_duty_register_update on public.on_duty_register for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant delete on public.on_duty_register to authenticated;
create policy on_duty_register_delete on public.on_duty_register for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant select on public.monitor_demerits to authenticated;
create policy monitor_demerits_select on public.monitor_demerits for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.monitor_demerits to authenticated;
create policy monitor_demerits_insert on public.monitor_demerits for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian') and recorded_by = (select auth.uid()));
grant update on public.monitor_demerits to authenticated;
create policy monitor_demerits_update on public.monitor_demerits for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant delete on public.monitor_demerits to authenticated;
create policy monitor_demerits_delete on public.monitor_demerits for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant select on public.monitor_demerit_types to authenticated;
create policy monitor_demerit_types_select on public.monitor_demerit_types for select to authenticated using (school_id = (select private.current_school_id()));
grant insert on public.monitor_demerit_types to authenticated;
create policy monitor_demerit_types_insert on public.monitor_demerit_types for insert to authenticated with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant update on public.monitor_demerit_types to authenticated;
create policy monitor_demerit_types_update on public.monitor_demerit_types for update to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian')) with check (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));
grant delete on public.monitor_demerit_types to authenticated;
create policy monitor_demerit_types_delete on public.monitor_demerit_types for delete to authenticated using (school_id = (select private.current_school_id()) and private.has_role('admin','admin-teacher','smt','monitor-guardian'));

create function private.preserve_actor() returns trigger language plpgsql set search_path = '' as $$
begin
  if to_jsonb(new)->tg_argv[0] is distinct from to_jsonb(old)->tg_argv[0] then
    -- Management can re-mark an existing register, attributing it to themselves.
    if tg_table_name = 'attendance' and private.has_role('admin','admin-teacher','smt')
       and (to_jsonb(new)->>'marked_by')::uuid = auth.uid() then return new; end if;
    raise exception 'Record author is immutable' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.preserve_actor() from public;
create trigger preserve_actor before update on public.attendance for each row execute function private.preserve_actor('marked_by');
create trigger preserve_actor before update on public.leave_register for each row execute function private.preserve_actor('recorded_by');
create trigger preserve_actor before update on public.hand_in_log for each row execute function private.preserve_actor('recorded_by');
create trigger preserve_actor before update on public.monitor_demerits for each row execute function private.preserve_actor('recorded_by');
revoke update on public.leave_register from authenticated;
grant update(time_in,arrived_at,departed_at) on public.leave_register to authenticated;

-- Atomic school/profile creation; only the trusted provisioning route may call it.
create function public.bootstrap_school(admin_id uuid, school_name text, admin_username text, admin_display_name text, timetable text, periods integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare school public.schools; profile public.users;
begin
  insert into public.schools(name,timetable_type,periods_per_day) values(school_name,timetable,periods) returning * into school;
  insert into public.users(id,school_id,username,display_name,role,roles)
    values(admin_id,school.id,admin_username,admin_display_name,'admin',array['admin']) returning * into profile;
  return jsonb_build_object('school',to_jsonb(school),'admin',to_jsonb(profile));
end $$;
revoke all on function public.bootstrap_school(uuid,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.bootstrap_school(uuid,text,text,text,text,integer) to service_role;

-- Photos are private. A school folder and a real student ID are both required.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create function private.own_student_photo(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.students s where s.school_id = private.current_school_id()
    and split_part(object_name,'/',1) = s.school_id::text
    and split_part(object_name,'/',2) ~ ('^' || s.id::text || '\.(jpg|jpeg|png|webp|gif)$')
    and array_length(string_to_array(object_name,'/'),1) = 2);
$$;
revoke all on function private.own_student_photo(text) from public;
grant execute on function private.own_student_photo(text) to authenticated;
create policy student_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'student-photos' and private.own_student_photo(name));
create policy student_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos' and private.own_student_photo(name) and private.has_role('admin','admin-teacher','smt'));
create policy student_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'student-photos' and private.own_student_photo(name) and private.has_role('admin','admin-teacher','smt'))
  with check (bucket_id = 'student-photos' and private.own_student_photo(name) and private.has_role('admin','admin-teacher','smt'));
create policy student_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos' and private.own_student_photo(name) and private.has_role('admin','admin-teacher','smt'));
