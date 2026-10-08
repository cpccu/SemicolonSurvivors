begin;

create schema if not exists campus_private;
revoke all on schema campus_private from public, anon, authenticated;
grant usage on schema campus_private to authenticated, service_role;
alter default privileges in schema campus_private revoke execute on functions from public;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  status text not null default 'pending' check (status in ('pending','active','suspended','deactivated')),
  student_id text unique check (student_id is null or student_id ~ '^[A-Z0-9-]{3,40}$'),
  department text check (department is null or length(department) between 1 and 100),
  batch text check (batch is null or length(batch) between 1 and 40)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null,
  scope_kind text not null,
  scope_id uuid not null,
  unique (user_id, role, scope_kind, scope_id),
  check (
    (role = 'club_organizer' and scope_kind = 'club') or
    (role = 'academic_publisher' and scope_kind in ('department','course','section')) or
    (role = 'transport_editor' and scope_kind = 'route') or
    (role = 'support_staff' and scope_kind = 'office') or
    (role in ('moderator','enrollment_admin','system_admin') and scope_kind = 'institution')
  )
);
create index role_assignments_user_idx on public.role_assignments(user_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_type text not null check (length(target_type) between 1 and 80),
  target_id uuid,
  action text not null check (length(action) between 1 and 80),
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create table public.enrollment_roster (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique check (student_id ~ '^[A-Z0-9-]{3,40}$'),
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254 and position('@' in email) > 1),
  full_name text not null check (length(full_name) between 2 and 120),
  department text not null check (length(department) between 1 and 100),
  batch text not null check (length(batch) between 1 and 40),
  approved boolean not null default true,
  user_id uuid unique references auth.users(id) on delete set null,
  activated_at timestamptz,
  auth_status text not null default 'pending' check (auth_status in ('pending','provisioned','already_active','conflict')),
  email_status text not null default 'not_requested' check (email_status in ('not_requested','in_flight','sent','failed','uncertain','not_required')),
  invitation_attempts integer not null default 0 check (invitation_attempts between 0 and 3),
  invitation_lease uuid,
  invitation_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollment_imports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  scope_id uuid not null,
  state text not null default 'staged' check (state in ('staged','confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create table public.enrollment_import_rows (
  batch_id uuid not null references public.enrollment_imports(id) on delete cascade,
  row_number integer not null check (row_number between 1 and 50),
  student_id text not null,
  email text not null,
  full_name text not null,
  department text not null,
  batch text not null,
  result text not null check (result in ('new','unchanged','conflict')),
  reason text check (reason in ('identity_conflict','duplicate_in_batch')),
  roster_id uuid references public.enrollment_roster(id),
  primary key (batch_id, row_number)
);

create table campus_private.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hits integer not null
);

create function campus_private.is_active() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.status = 'active'); $$;

create function campus_private.has_scope(required_role text, required_kind text, required_id uuid, require_mfa boolean default true)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select required_id is not null and campus_private.is_active()
    and (not require_mfa or coalesce(auth.jwt()->>'aal','') = 'aal2')
    and (
      (required_role = 'club_organizer' and required_kind = 'club') or
      (required_role = 'academic_publisher' and required_kind in ('department','course','section')) or
      (required_role = 'transport_editor' and required_kind = 'route') or
      (required_role = 'support_staff' and required_kind = 'office') or
      (required_role in ('moderator','enrollment_admin','system_admin') and required_kind = 'institution')
    )
    and exists(select 1 from public.role_assignments a where a.user_id = auth.uid()
      and a.role = required_role and a.scope_kind = required_kind and a.scope_id = required_id);
$$;

alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.audit_events enable row level security;
alter table public.enrollment_roster enable row level security;
alter table public.enrollment_imports enable row level security;
alter table public.enrollment_import_rows enable row level security;
alter table campus_private.rate_limit_buckets enable row level security;
create policy profile_self_read on public.profiles for select to authenticated using (user_id = auth.uid());
create policy assignments_self_read on public.role_assignments for select to authenticated using (user_id = auth.uid() and campus_private.is_active());
-- Audit, roster, and import records have no browser-facing table policy, including for system admins.
revoke all on public.profiles, public.role_assignments, public.audit_events, public.enrollment_roster,
  public.enrollment_imports, public.enrollment_import_rows from public, anon, authenticated;
grant select on public.profiles, public.role_assignments to authenticated;
grant select, insert, update, delete on public.profiles, public.role_assignments, public.audit_events,
  public.enrollment_roster, public.enrollment_imports, public.enrollment_import_rows to service_role;

create function public.campus_access() returns jsonb
language sql stable security definer set search_path = pg_catalog
as $$
  select jsonb_build_object('userId',p.user_id,'status',p.status,'assignments',coalesce((
    select jsonb_agg(jsonb_build_object('role',a.role,'scope',jsonb_build_object('kind',a.scope_kind,'id',a.scope_id)))
    from public.role_assignments a where a.user_id = p.user_id
  ),'[]'::jsonb)) from public.profiles p where p.user_id = auth.uid();
$$;

create function public.identity_health() returns text
language sql stable security definer set search_path = pg_catalog
as $$ select '202610070001'::text; $$;

create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare current_hits integer;
begin
  if p_key is null or p_key !~ '^[a-z-]{3,20}:([a-f0-9]{64}|global)$' or p_limit is null or p_limit not between 1 and 5000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then raise exception using errcode = '22023', message = 'validation'; end if;
  insert into campus_private.rate_limit_buckets as b(bucket_key,window_started_at,hits)
    values(p_key,clock_timestamp(),1)
  on conflict(bucket_key) do update set
    hits = case when b.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp() then 1 else least(b.hits+1,p_limit+1) end,
    window_started_at = case when b.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp() then clock_timestamp() else b.window_started_at end
  returning hits into current_hits;
  return current_hits <= p_limit;
end;
$$;

create function campus_private.import_report(p_batch_id uuid) returns jsonb
language sql volatile security definer set search_path = pg_catalog
as $$
  select jsonb_build_object('batchId',b.id,'state',b.state,'records',coalesce((
    select jsonb_agg(jsonb_build_object('rowNumber',r.row_number,'studentId',r.student_id,
      'email',r.email,'fullName',r.full_name,'department',r.department,'batch',r.batch,
      'result',r.result,'reason',r.reason,'rosterId',r.roster_id,
      'authStatus',coalesce(s.auth_status,'pending'),'emailStatus',coalesce(s.email_status,'not_requested')) order by r.row_number)
    from public.enrollment_import_rows r left join public.enrollment_roster s on s.id = r.roster_id where r.batch_id = b.id
  ),'[]'::jsonb)) from public.enrollment_imports b where b.id = p_batch_id;
$$;

create function public.enrollment_import_report(p_batch_id uuid, p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare b public.enrollment_imports;
begin
  select * into b from public.enrollment_imports where id = p_batch_id;
  if b.id is null or b.scope_id is distinct from p_scope_id or b.actor_id <> auth.uid() or not campus_private.has_scope('enrollment_admin','institution',b.scope_id) then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  return campus_private.import_report(b.id);
end;
$$;

create function public.enrollment_recent_imports(p_scope_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if not campus_private.has_scope('enrollment_admin','institution',p_scope_id) then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('batchId',b.id,'state',b.state,'createdAt',b.created_at) order by b.created_at desc),'[]'::jsonb)
    from (select id,state,created_at from public.enrollment_imports
      where actor_id = auth.uid() and scope_id = p_scope_id order by created_at desc limit 10) b);
end;
$$;

create function public.enrollment_stage_import(p_scope_id uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_batch_id uuid; item jsonb; n integer := 0; existing public.enrollment_roster; result text; reason text;
  sid text; mail text; name text; dept text; cohort text;
begin
  if not campus_private.has_scope('enrollment_admin','institution',p_scope_id) then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'validation';
  end if;
  insert into public.enrollment_imports(actor_id,scope_id) values(auth.uid(),p_scope_id) returning id into v_batch_id;
  for item in select value from jsonb_array_elements(p_rows) loop
    n := n+1; sid := upper(btrim(item->>'studentId')); mail := lower(btrim(item->>'email'));
    name := btrim(item->>'fullName'); dept := btrim(item->>'department'); cohort := btrim(item->>'batch');
    if jsonb_typeof(item) is distinct from 'object' or sid is null or sid !~ '^[A-Z0-9-]{3,40}$'
      or mail is null or length(mail) not between 3 and 254 or position('@' in mail) <= 1
      or name is null or length(name) not between 2 and 120 or dept is null or length(dept) not between 1 and 100
      or cohort is null or length(cohort) not between 1 and 40 then
      raise exception using errcode = '22023', message = 'validation';
    end if;
    select * into existing from public.enrollment_roster where student_id = sid;
    result := 'new'; reason := null;
    if existing.id is not null then
      result := case when existing.email = mail and existing.full_name = name and existing.department = dept and existing.batch = cohort and existing.approved then 'unchanged' else 'conflict' end;
    elsif exists(select 1 from public.enrollment_roster where email = mail) then result := 'conflict'; end if;
    if result = 'conflict' then reason := 'identity_conflict'; end if;
    if exists(select 1 from public.enrollment_import_rows where batch_id = v_batch_id and (student_id = sid or email = mail)) then
      result := 'conflict'; reason := 'duplicate_in_batch';
      update public.enrollment_import_rows set result = 'conflict',reason = 'duplicate_in_batch'
        where batch_id = v_batch_id and (student_id = sid or email = mail);
    end if;
    insert into public.enrollment_import_rows values(v_batch_id,n,sid,mail,name,dept,cohort,result,reason,existing.id);
  end loop;
  insert into public.audit_events(actor_id,target_type,target_id,action,details)
    values(auth.uid(),'enrollment_import',v_batch_id,'enrollment.preview',jsonb_build_object('recordCount',n));
  return campus_private.import_report(v_batch_id);
end;
$$;

create function public.enrollment_confirm_import(p_batch_id uuid, p_scope_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare b public.enrollment_imports; r public.enrollment_import_rows; existing public.enrollment_roster; v_roster_id uuid;
begin
  select * into b from public.enrollment_imports where id = p_batch_id for update;
  if b.id is null or b.scope_id is distinct from p_scope_id or b.actor_id <> auth.uid() or not campus_private.has_scope('enrollment_admin','institution',b.scope_id) then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  if b.state = 'confirmed' then return campus_private.import_report(b.id); end if;
  if b.created_at < now() - interval '1 hour' or exists(select 1 from public.enrollment_import_rows where batch_id = b.id and result = 'conflict') then
    raise exception using errcode = '23505', message = 'conflict';
  end if;
  -- Serialize imports and revalidate preview identities inside the confirmation transaction.
  perform pg_advisory_xact_lock(7001001);
  for r in select * from public.enrollment_import_rows where batch_id = b.id order by row_number loop
    select * into existing from public.enrollment_roster where student_id = r.student_id for update;
    if existing.id is not null then
      if existing.email <> r.email or existing.full_name <> r.full_name or existing.department <> r.department or existing.batch <> r.batch or not existing.approved then
        raise exception using errcode = '23505', message = 'conflict';
      end if;
      update public.enrollment_import_rows set result = 'unchanged',roster_id = existing.id where batch_id = b.id and row_number = r.row_number;
    else
      insert into public.enrollment_roster(student_id,email,full_name,department,batch)
        values(r.student_id,r.email,r.full_name,r.department,r.batch) returning id into v_roster_id;
      update public.enrollment_import_rows set roster_id = v_roster_id where batch_id = b.id and row_number = r.row_number;
    end if;
  end loop;
  update public.enrollment_imports set state = 'confirmed',confirmed_at = now() where id = b.id;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'enrollment_import',b.id,'enrollment.confirm');
  return campus_private.import_report(b.id);
end;
$$;

create function public.enrollment_begin_invitation(p_student_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare r public.enrollment_roster; existing_user uuid; lease uuid;
begin
  if p_student_id is null or p_student_id !~ '^[A-Z0-9-]{3,40}$' then raise exception using errcode = '22023', message = 'validation'; end if;
  select * into r from public.enrollment_roster where student_id = p_student_id and approved for update;
  if r.id is null or r.activated_at is not null then return null; end if;
  if r.email_status = 'in_flight' and r.invitation_started_at < now() - interval '10 minutes' then
    update public.enrollment_roster set email_status = 'uncertain',updated_at = now() where id = r.id;
    return null;
  end if;
  -- Never automatically retry a possibly delivered invitation or overwrite an existing managed account.
  if r.user_id is not null or r.email_status in ('sent','in_flight','uncertain','not_required') or r.invitation_attempts >= 3 then return null; end if;
  if r.invitation_started_at > now() - interval '15 minutes' then return null; end if;
  select id into existing_user from auth.users where lower(email) = r.email limit 1;
  if existing_user is not null then
    update public.enrollment_roster set
      auth_status = case when exists(select 1 from public.profiles where user_id = existing_user and status = 'active') then 'already_active' else 'conflict' end,
      email_status = 'not_required',updated_at = now() where id = r.id;
    return null;
  end if;
  lease := gen_random_uuid();
  update public.enrollment_roster set invitation_lease = lease,invitation_started_at = now(),
    invitation_attempts = invitation_attempts+1,email_status = 'in_flight',updated_at = now() where id = r.id;
  return jsonb_build_object('rosterId',r.id,'leaseId',lease,'email',r.email);
end;
$$;

create function public.enrollment_finish_invitation(p_roster_id uuid, p_lease_id uuid, p_user_id uuid, p_outcome text) returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare r public.enrollment_roster;
begin
  select * into r from public.enrollment_roster where id = p_roster_id for update;
  if r.id is null or r.invitation_lease is distinct from p_lease_id or r.email_status <> 'in_flight' then return false; end if;
  if p_outcome is null or p_outcome not in ('sent','failed','uncertain') then raise exception using errcode = '22023', message = 'validation'; end if;
  if p_outcome = 'sent' then
    if p_user_id is null or not exists(select 1 from auth.users where id = p_user_id and lower(email) = r.email)
      or exists(select 1 from public.profiles where user_id = p_user_id and (status <> 'pending' or student_id is distinct from r.student_id)) then
      update public.enrollment_roster set auth_status = 'conflict',email_status = 'uncertain',updated_at = now() where id = r.id;
      insert into public.audit_events(target_type,target_id,action,details)
        values('enrollment_roster',r.id,'enrollment.invitation_outcome',jsonb_build_object('outcome','uncertain','identityConflict',true));
      return false;
    end if;
    insert into public.profiles(user_id,full_name,student_id,department,batch)
      values(p_user_id,r.full_name,r.student_id,r.department,r.batch) on conflict(user_id) do nothing;
    update public.enrollment_roster set user_id = p_user_id,auth_status = 'provisioned' where id = r.id;
  end if;
  update public.enrollment_roster set email_status = p_outcome,updated_at = now() where id = r.id;
  insert into public.audit_events(target_type,target_id,action,details)
    values('enrollment_roster',r.id,'enrollment.invitation_outcome',jsonb_build_object('outcome',p_outcome));
  return true;
end;
$$;

create function public.enrollment_bind_identity() returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare r public.enrollment_roster; verified_mail text;
begin
  select lower(email) into verified_mail from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if verified_mail is null then raise exception using errcode = '42501', message = 'authorization'; end if;
  select * into r from public.enrollment_roster where email = verified_mail and approved for update;
  if r.id is null or r.activated_at is not null or (r.user_id is not null and r.user_id <> auth.uid())
    or exists(select 1 from public.profiles where user_id = auth.uid() and (status <> 'pending' or student_id is distinct from r.student_id)) then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  insert into public.profiles(user_id,full_name,student_id,department,batch)
    values(auth.uid(),r.full_name,r.student_id,r.department,r.batch) on conflict(user_id) do nothing;
  update public.enrollment_roster set user_id = auth.uid(),auth_status = 'provisioned',updated_at = now() where id = r.id;
  return true;
end;
$$;

create function public.enrollment_complete_activation() returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare r public.enrollment_roster;
begin
  select * into r from public.enrollment_roster where user_id = auth.uid() and approved for update;
  if r.id is null or not exists(select 1 from auth.users where id = auth.uid() and lower(email) = r.email
    and email_confirmed_at is not null and coalesce(encrypted_password,'') <> '') then
    raise exception using errcode = '42501', message = 'authorization';
  end if;
  if r.activated_at is not null and exists(select 1 from public.profiles where user_id = auth.uid() and status = 'active') then return true; end if;
  update public.profiles set status = 'active' where user_id = auth.uid() and status = 'pending' and student_id = r.student_id;
  if not found then raise exception using errcode = '42501', message = 'authorization'; end if;
  update public.enrollment_roster set activated_at = now(),updated_at = now() where id = r.id;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'profile',auth.uid(),'enrollment.activate');
  return true;
end;
$$;

revoke all on function campus_private.is_active(), campus_private.has_scope(text,text,uuid,boolean), campus_private.import_report(uuid)
  from public, anon, authenticated, service_role;
grant execute on function campus_private.is_active(), campus_private.has_scope(text,text,uuid,boolean) to authenticated, service_role;
revoke all on function public.campus_access(), public.identity_health(), public.consume_rate_limit(text,integer,integer),
  public.enrollment_stage_import(uuid,jsonb), public.enrollment_confirm_import(uuid,uuid), public.enrollment_import_report(uuid,uuid),
  public.enrollment_recent_imports(uuid),
  public.enrollment_begin_invitation(text), public.enrollment_finish_invitation(uuid,uuid,uuid,text),
  public.enrollment_bind_identity(), public.enrollment_complete_activation() from public, anon, authenticated, service_role;
grant execute on function public.campus_access(), public.enrollment_stage_import(uuid,jsonb), public.enrollment_confirm_import(uuid,uuid),
  public.enrollment_import_report(uuid,uuid), public.enrollment_recent_imports(uuid), public.enrollment_bind_identity(), public.enrollment_complete_activation() to authenticated;
grant execute on function public.identity_health(), public.consume_rate_limit(text,integer,integer),
  public.enrollment_begin_invitation(text), public.enrollment_finish_invitation(uuid,uuid,uuid,text) to service_role;

commit;
