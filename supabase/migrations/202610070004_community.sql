begin;

-- Configuration is provisioned separately; application metadata never establishes institutional authority.
create table campus_private.community_configuration (
  singleton boolean primary key default true check (singleton), institution_id uuid not null
);
revoke all on campus_private.community_configuration from public, anon, authenticated;
grant select, insert, update on campus_private.community_configuration to service_role;

create table public.community_directory (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('department','club','office','place','guide')),
  title text not null check (length(title) between 2 and 120), description text not null check (length(description) between 10 and 8000),
  location text not null default '' check (length(location) <= 200), contact text not null default '' check (length(contact) <= 400),
  source_label text not null check (length(source_label) between 2 and 200), source_url text not null check (source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 2048),
  reviewed_at timestamptz not null check (reviewed_at <= now()), visibility text not null check (visibility in ('public','campus')),
  state text not null default 'draft' check (state in ('draft','published','archived')), version integer not null default 1,
  updated_at timestamptz not null default now(), updated_by uuid not null references public.profiles(user_id)
);
create table public.community_routes (
  id uuid primary key default gen_random_uuid(), title text not null check (length(title) between 2 and 120),
  stops jsonb not null check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) between 2 and 40),
  schedules jsonb not null check (jsonb_typeof(schedules) = 'array' and jsonb_array_length(schedules) between 1 and 40),
  exceptions jsonb not null default '[]' check (jsonb_typeof(exceptions) = 'array' and jsonb_array_length(exceptions) <= 100),
  notice text not null default '' check (length(notice) <= 1500), source_label text not null check (length(source_label) between 2 and 200),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 2048), reviewed_at timestamptz not null check (reviewed_at <= now()),
  visibility text not null check (visibility in ('public','campus')), state text not null default 'draft' check (state in ('draft','published','archived')),
  version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid not null references public.profiles(user_id)
);
create table public.community_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  interests text[] not null default '{}', courses text[] not null default '{}', section text not null default '' check (length(section) <= 80),
  clubs text[] not null default '{}', saved_route_id uuid references public.community_routes(id) on delete set null,
  updated_at timestamptz not null default now(), check (cardinality(interests) <= 20 and cardinality(courses) <= 20 and cardinality(clubs) <= 20)
);
create table public.community_media (
  id uuid primary key, owner_id uuid not null references public.profiles(user_id), object_path text not null unique,
  mime_type text not null check (mime_type = 'image/png'), byte_size integer not null check (byte_size between 45 and 3145728),
  purpose text not null check (purpose in ('item','complaint')), entity_id uuid,
  state text not null default 'pending' check (state in ('pending','ready','attached','failed')),
  created_at timestamptz not null default now()
);
create table public.community_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(user_id),
  kind text not null check (kind in ('lost','found')), title text not null check (length(title) between 3 and 120),
  description text not null check (length(description) between 15 and 2000), location text not null check (length(location) between 2 and 200),
  occurred_on date not null check (occurred_on <= (now() at time zone 'Asia/Dhaka')::date), photo_id uuid not null unique references public.community_media(id),
  state text not null default 'open' check (state in ('open','handover','resolved','withdrawn','hidden')), version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.community_claims (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.community_items(id),
  claimant_id uuid not null references public.profiles(user_id), evidence text not null check (length(evidence) between 20 and 2000),
  state text not null default 'pending' check (state in ('pending','accepted','rejected','completed','withdrawn')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(item_id,claimant_id)
);
create unique index community_one_handover on public.community_claims(item_id) where state in ('accepted','completed');
create table public.community_offices (
  id uuid primary key default gen_random_uuid(), title text not null check (length(title) between 2 and 120),
  description text not null default '' check (length(description) <= 1000), default_staff_id uuid references public.profiles(user_id), active boolean not null default true
);
create table public.community_complaints (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(user_id), office_id uuid not null references public.community_offices(id),
  assigned_staff_id uuid references public.profiles(user_id), subject text not null check (length(subject) between 3 and 120),
  description text not null check (length(description) between 10 and 3000),
  state text not null default 'received' check (state in ('received','in_review','awaiting_student','resolved','closed','escalated')),
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.community_messages (
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.community_complaints(id),
  author_id uuid not null references public.profiles(user_id), body text not null check (length(body) between 1 and 3000),
  attachment_id uuid unique references public.community_media(id), created_at timestamptz not null default now()
);
create table public.community_history (
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.community_complaints(id),
  actor_id uuid not null references public.profiles(user_id), from_state text, to_state text not null,
  note text not null default '' check (length(note) <= 500), created_at timestamptz not null default now()
);
create index community_items_search on public.community_items(state,created_at desc);
create index community_complaints_owner on public.community_complaints(owner_id,updated_at desc);
create index community_complaints_assigned on public.community_complaints(assigned_staff_id,updated_at desc);

create function campus_private.community_institution() returns uuid
language sql stable security definer set search_path = pg_catalog
as $$ select institution_id from campus_private.community_configuration where singleton; $$;
create function campus_private.community_moderator() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select campus_private.has_scope('moderator','institution',campus_private.community_institution()); $$;
create function campus_private.community_admin() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select campus_private.has_scope('system_admin','institution',campus_private.community_institution()); $$;
create function campus_private.community_case_access(p_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select campus_private.is_active() and exists(select 1 from public.community_complaints c where c.id = p_id
  and (c.owner_id = auth.uid() or (c.assigned_staff_id = auth.uid() and campus_private.has_scope('support_staff','office',c.office_id)))); $$;

-- All invariant-sensitive writes are RPC-only, including preferences and profile administration.
alter table public.community_directory enable row level security;
alter table public.community_routes enable row level security;
alter table public.community_preferences enable row level security;
alter table public.community_media enable row level security;
alter table public.community_items enable row level security;
alter table public.community_claims enable row level security;
alter table public.community_offices enable row level security;
alter table public.community_complaints enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_history enable row level security;
create policy community_directory_read on public.community_directory for select to anon,authenticated using (
  (state = 'published' and ((visibility = 'public' and (auth.uid() is null or campus_private.is_active())) or campus_private.is_active())) or campus_private.community_moderator());
create policy community_routes_read on public.community_routes for select to anon,authenticated using (
  (state = 'published' and ((visibility = 'public' and (auth.uid() is null or campus_private.is_active())) or campus_private.is_active()))
  or campus_private.has_scope('transport_editor','route',id) or campus_private.community_moderator());
create policy community_preferences_read on public.community_preferences for select to authenticated using (user_id = auth.uid() and campus_private.is_active());
create policy community_items_read on public.community_items for select to authenticated using (campus_private.is_active() and (state in ('open','handover','resolved') or owner_id = auth.uid() or campus_private.community_moderator()));
create policy community_claims_read on public.community_claims for select to authenticated using (campus_private.is_active() and (claimant_id = auth.uid() or exists(select 1 from public.community_items i where i.id = item_id and i.owner_id = auth.uid())));
create policy community_offices_read on public.community_offices for select to authenticated using (campus_private.is_active());
create policy community_complaints_read on public.community_complaints for select to authenticated using (campus_private.community_case_access(id));
create policy community_messages_read on public.community_messages for select to authenticated using (campus_private.community_case_access(complaint_id));
create policy community_history_read on public.community_history for select to authenticated using (campus_private.community_case_access(complaint_id));
revoke all on public.community_directory,public.community_routes,public.community_preferences,public.community_media,public.community_items,
  public.community_claims,public.community_offices,public.community_complaints,public.community_messages,public.community_history from public,anon,authenticated;
grant select on public.community_directory,public.community_routes to anon,authenticated;
grant select on public.community_preferences,public.community_items,public.community_claims,public.community_offices,
  public.community_complaints,public.community_messages,public.community_history to authenticated;
grant select,insert,update,delete on public.community_directory,public.community_routes,public.community_preferences,public.community_media,
  public.community_items,public.community_claims,public.community_offices,public.community_complaints,public.community_messages,public.community_history to service_role;

create function public.community_save_preferences(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare route_id uuid; entries text[]; key text;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' or length(coalesce(p_data->>'section','')) > 80 then raise exception using errcode='22023',message='validation'; end if;
  foreach key in array array['interests','courses','clubs'] loop
    if jsonb_typeof(p_data->key) is distinct from 'array' or jsonb_array_length(p_data->key) > 20
      or exists(select 1 from jsonb_array_elements(p_data->key) x where jsonb_typeof(x) <> 'string' or length(x#>>'{}') not between 1 and 80) then
      raise exception using errcode='22023',message='validation'; end if;
  end loop;
  route_id := nullif(p_data->>'savedRouteId','')::uuid;
  if route_id is not null and not exists(select 1 from public.community_routes where id=route_id and state='published') then raise exception using errcode='22023',message='validation'; end if;
  insert into public.community_preferences(user_id,interests,courses,clubs,section,saved_route_id)
    values(auth.uid(),array(select jsonb_array_elements_text(p_data->'interests')),array(select jsonb_array_elements_text(p_data->'courses')),
      array(select jsonb_array_elements_text(p_data->'clubs')),coalesce(p_data->>'section',''),route_id)
    on conflict(user_id) do update set interests=excluded.interests,courses=excluded.courses,clubs=excluded.clubs,section=excluded.section,saved_route_id=excluded.saved_route_id,updated_at=now();
  return (select to_jsonb(p) from public.community_preferences p where user_id=auth.uid());
end; $$;

create function public.community_publish_directory(p_id uuid,p_version integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare result public.community_directory;
begin
  if not campus_private.community_moderator() then raise exception using errcode='42501',message='authorization'; end if;
  if p_id is null then
    insert into public.community_directory(kind,title,description,location,contact,source_label,source_url,reviewed_at,visibility,state,updated_by)
      values(p_data->>'kind',btrim(p_data->>'title'),btrim(p_data->>'description'),coalesce(p_data->>'location',''),coalesce(p_data->>'contact',''),
        p_data->>'sourceLabel',p_data->>'sourceUrl',(p_data->>'reviewedAt')::timestamptz,p_data->>'visibility',p_data->>'state',auth.uid()) returning * into result;
  else
    select * into result from public.community_directory where id=p_id for update;
    if result.id is null then raise exception using errcode='P0002',message='unavailable'; end if;
    if result.version is distinct from p_version then raise exception using errcode='P0001',message='version_conflict'; end if;
    update public.community_directory set kind=p_data->>'kind',title=btrim(p_data->>'title'),description=btrim(p_data->>'description'),
      location=coalesce(p_data->>'location',''),contact=coalesce(p_data->>'contact',''),source_label=p_data->>'sourceLabel',source_url=p_data->>'sourceUrl',
      reviewed_at=(p_data->>'reviewedAt')::timestamptz,visibility=p_data->>'visibility',state=p_data->>'state',version=version+1,updated_at=now(),updated_by=auth.uid()
      where id=p_id returning * into result;
  end if;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'directory',result.id,'directory.review',jsonb_build_object('state',result.state,'version',result.version));
  return to_jsonb(result);
end; $$;

create function public.community_publish_route(p_id uuid,p_version integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare result public.community_routes; entry jsonb; day jsonb;
begin
  if (p_id is null and not campus_private.community_moderator()) or (p_id is not null and not campus_private.has_scope('transport_editor','route',p_id)) then
    raise exception using errcode='42501',message='authorization'; end if;
  if jsonb_typeof(p_data->'stops') is distinct from 'array' or jsonb_array_length(p_data->'stops') not between 2 and 40
    or exists(select 1 from jsonb_array_elements(p_data->'stops') x where jsonb_typeof(x) <> 'string' or length(x#>>'{}') not between 2 and 120)
    or jsonb_typeof(p_data->'schedules') is distinct from 'array' or jsonb_array_length(p_data->'schedules') not between 1 and 40
    or jsonb_typeof(p_data->'exceptions') is distinct from 'array' or jsonb_array_length(p_data->'exceptions') > 100 then raise exception using errcode='22023',message='validation'; end if;
  for entry in select value from jsonb_array_elements(p_data->'schedules') loop
    if coalesce(entry->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(entry->'days') is distinct from 'array'
      or jsonb_array_length(entry->'days') not between 1 and 7 then raise exception using errcode='22023',message='validation'; end if;
    for day in select value from jsonb_array_elements(entry->'days') loop
      if day::text !~ '^[0-6]$' then raise exception using errcode='22023',message='validation'; end if;
    end loop;
  end loop;
  for entry in select value from jsonb_array_elements(p_data->'exceptions') loop
    if coalesce(entry->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(entry->'cancelled') is distinct from 'boolean'
      or length(coalesce(entry->>'note','')) > 500 then raise exception using errcode='22023',message='validation'; end if;
    perform (entry->>'date')::date;
  end loop;
  if p_id is null then
    insert into public.community_routes(title,stops,schedules,exceptions,notice,source_label,source_url,reviewed_at,visibility,state,updated_by)
      values(p_data->>'title',p_data->'stops',p_data->'schedules',p_data->'exceptions',coalesce(p_data->>'notice',''),p_data->>'sourceLabel',p_data->>'sourceUrl',
        (p_data->>'reviewedAt')::timestamptz,p_data->>'visibility',p_data->>'state',auth.uid()) returning * into result;
  else
    select * into result from public.community_routes where id=p_id for update;
    if result.id is null then raise exception using errcode='P0002',message='unavailable'; end if;
    if result.version is distinct from p_version then raise exception using errcode='P0001',message='version_conflict'; end if;
    update public.community_routes set title=p_data->>'title',stops=p_data->'stops',schedules=p_data->'schedules',exceptions=p_data->'exceptions',notice=coalesce(p_data->>'notice',''),
      source_label=p_data->>'sourceLabel',source_url=p_data->>'sourceUrl',reviewed_at=(p_data->>'reviewedAt')::timestamptz,visibility=p_data->>'visibility',state=p_data->>'state',
      version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into result;
  end if;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'transport_route',result.id,'transport.review',jsonb_build_object('state',result.state,'version',result.version));
  return to_jsonb(result);
end; $$;

create function public.community_create_item(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare result public.community_items; media public.community_media;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  select * into media from public.community_media where id=(p_data->>'photoId')::uuid for update;
  if media.owner_id is distinct from auth.uid() or media.state is distinct from 'ready' or media.purpose is distinct from 'item' then raise exception using errcode='42501',message='authorization'; end if;
  insert into public.community_items(owner_id,kind,title,description,location,occurred_on,photo_id)
    values(auth.uid(),p_data->>'kind',btrim(p_data->>'title'),btrim(p_data->>'description'),btrim(p_data->>'location'),(p_data->>'occurredOn')::date,media.id) returning * into result;
  update public.community_media set state='attached',entity_id=result.id where id=media.id;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'lost_found_item',result.id,'item.create');
  return to_jsonb(result);
end; $$;

create function public.community_claim_item(p_item_id uuid,p_evidence text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare item public.community_items; result public.community_claims;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  select * into item from public.community_items where id=p_item_id for update;
  if item.id is null or item.state <> 'open' then raise exception using errcode='P0002',message='unavailable'; end if;
  if item.owner_id=auth.uid() then raise exception using errcode='42501',message='authorization'; end if;
  insert into public.community_claims(item_id,claimant_id,evidence) values(item.id,auth.uid(),btrim(p_evidence)) returning * into result;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'lost_found_claim',result.id,'claim.create');
  return to_jsonb(result);
end; $$;

create function public.community_item_transition(p_item_id uuid,p_version integer,p_action text,p_claim_id uuid default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare item public.community_items; claim public.community_claims;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  -- Lock the parent first for every claim transition: only one claimant can enter handover.
  select * into item from public.community_items where id=p_item_id for update;
  if item.id is null then raise exception using errcode='P0002',message='unavailable'; end if;
  if item.version is distinct from p_version then raise exception using errcode='P0001',message='version_conflict'; end if;
  if p_action='hide' then
    if not campus_private.community_moderator() or item.state='resolved' then raise exception using errcode='42501',message='authorization'; end if;
    update public.community_items set state='hidden',version=version+1,updated_at=now() where id=item.id;
  elsif p_action='withdraw' then
    if item.owner_id<>auth.uid() or item.state<>'open' then raise exception using errcode='42501',message='authorization'; end if;
    update public.community_items set state='withdrawn',version=version+1,updated_at=now() where id=item.id;
    update public.community_claims set state='rejected',updated_at=now() where item_id=item.id and state='pending';
  else
    select * into claim from public.community_claims where id=p_claim_id and item_id=item.id for update;
    if claim.id is null then raise exception using errcode='P0002',message='unavailable'; end if;
    if p_action in ('accept','reject') then
      if item.owner_id<>auth.uid() then raise exception using errcode='42501',message='authorization'; end if;
      if item.state<>'open' or claim.state<>'pending' then raise exception using errcode='P0001',message='transition_conflict'; end if;
      update public.community_claims set state=case when p_action='accept' then 'accepted' else 'rejected' end,updated_at=now() where id=claim.id;
      if p_action='accept' then
        update public.community_claims set state='rejected',updated_at=now() where item_id=item.id and id<>claim.id and state='pending';
        update public.community_items set state='handover' where id=item.id;
      end if;
    elsif p_action='confirm-handover' then
      if claim.claimant_id<>auth.uid() then raise exception using errcode='42501',message='authorization'; end if;
      if item.state<>'handover' or claim.state<>'accepted' then raise exception using errcode='P0001',message='transition_conflict'; end if;
      update public.community_claims set state='completed',updated_at=now() where id=claim.id;
      update public.community_items set state='resolved' where id=item.id;
    else raise exception using errcode='22023',message='validation'; end if;
    update public.community_items set version=version+1,updated_at=now() where id=item.id;
  end if;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'lost_found_item',item.id,'item.'||p_action,jsonb_build_object('claimId',p_claim_id));
  return (select to_jsonb(i) from public.community_items i where id=item.id);
end; $$;

create function public.community_create_complaint(p_office_id uuid,p_subject text,p_description text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare office public.community_offices; result public.community_complaints;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  select * into office from public.community_offices where id=p_office_id and active for share;
  if office.id is null then raise exception using errcode='22023',message='validation'; end if;
  if office.default_staff_id is not null and not exists(select 1 from public.role_assignments a join public.profiles p on p.user_id=a.user_id
    where a.user_id=office.default_staff_id and p.status='active' and role='support_staff' and scope_kind='office' and scope_id=office.id) then
    raise exception using errcode='P0001',message='office_assignment_unavailable'; end if;
  insert into public.community_complaints(owner_id,office_id,assigned_staff_id,subject,description)
    values(auth.uid(),office.id,office.default_staff_id,btrim(p_subject),btrim(p_description)) returning * into result;
  insert into public.community_history(complaint_id,actor_id,to_state,note) values(result.id,auth.uid(),'received','Receipt acknowledged by CampusOS; office response not yet received.');
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'complaint',result.id,'complaint.create');
  return to_jsonb(result);
end; $$;

create function public.community_complaint_message(p_id uuid,p_body text,p_attachment_id uuid default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare complaint public.community_complaints; media public.community_media; result public.community_messages;
begin
  select * into complaint from public.community_complaints where id=p_id for update;
  if not campus_private.community_case_access(p_id) then raise exception using errcode='42501',message='authorization'; end if;
  if complaint.state='closed' then raise exception using errcode='P0001',message='transition_conflict'; end if;
  if p_attachment_id is not null then
    select * into media from public.community_media where id=p_attachment_id for update;
    if media.owner_id is distinct from auth.uid() or media.state is distinct from 'ready' or media.purpose is distinct from 'complaint' then raise exception using errcode='42501',message='authorization'; end if;
  end if;
  insert into public.community_messages(complaint_id,author_id,body,attachment_id) values(p_id,auth.uid(),btrim(p_body),p_attachment_id) returning * into result;
  if p_attachment_id is not null then update public.community_media set state='attached',entity_id=p_id where id=p_attachment_id; end if;
  update public.community_complaints set updated_at=now(),version=version+1 where id=p_id;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'complaint',p_id,'complaint.message');
  return to_jsonb(result);
end; $$;

create function public.community_complaint_transition(p_id uuid,p_version integer,p_state text,p_note text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare complaint public.community_complaints; owner boolean; allowed boolean;
begin
  select * into complaint from public.community_complaints where id=p_id for update;
  if not campus_private.community_case_access(p_id) then raise exception using errcode='42501',message='authorization'; end if;
  if complaint.version is distinct from p_version then raise exception using errcode='P0001',message='version_conflict'; end if;
  owner := complaint.owner_id=auth.uid();
  allowed := case when owner then
    (complaint.state='resolved' and p_state in ('closed','in_review')) or (complaint.state='awaiting_student' and p_state='in_review') or
    (complaint.state in ('received','in_review','awaiting_student') and p_state='escalated')
    else (complaint.state in ('received','escalated') and p_state='in_review') or
      (complaint.state='in_review' and p_state in ('awaiting_student','resolved','escalated')) or
      (complaint.state='awaiting_student' and p_state in ('in_review','resolved','escalated')) end;
  if not coalesce(allowed,false) then raise exception using errcode='P0001',message='transition_conflict'; end if;
  if length(btrim(coalesce(p_note,''))) not between 3 and 500 then raise exception using errcode='22023',message='validation'; end if;
  update public.community_complaints set state=p_state,version=version+1,updated_at=now() where id=p_id;
  insert into public.community_history(complaint_id,actor_id,from_state,to_state,note) values(p_id,auth.uid(),complaint.state,p_state,btrim(p_note));
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'complaint',p_id,'complaint.transition',jsonb_build_object('from',complaint.state,'to',p_state));
  return (select to_jsonb(c) from public.community_complaints c where id=p_id);
end; $$;

create function public.community_media_access(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare media public.community_media;
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  select * into media from public.community_media where id=p_id and state in ('ready','attached');
  if media.id is null or not ((media.state='ready' and media.owner_id=auth.uid()) or
    (media.state='attached' and media.purpose='item' and exists(select 1 from public.community_items i where i.id=media.entity_id and (i.state in ('open','handover','resolved') or i.owner_id=auth.uid()))) or
    (media.state='attached' and media.purpose='complaint' and campus_private.community_case_access(media.entity_id))) then
    raise exception using errcode='P0002',message='unavailable'; end if;
  return jsonb_build_object('objectPath',media.object_path,'mimeType',media.mime_type,'byteSize',media.byte_size);
end; $$;

create function public.community_admin_change(p_scope_id uuid,p_user_id uuid,p_action text,p_data jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare target public.profiles; assignment_id uuid; v_scope_id uuid; institution uuid := campus_private.community_institution();
begin
  if p_scope_id is distinct from institution or not campus_private.community_admin() or p_user_id is null or p_user_id=auth.uid() then
    raise exception using errcode='42501',message='authorization'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 10 and 500 or jsonb_typeof(p_data) is distinct from 'object' then raise exception using errcode='22023',message='validation'; end if;
  select * into target from public.profiles where user_id=p_user_id for update;
  if target.user_id is null then raise exception using errcode='P0002',message='unavailable'; end if;
  if p_action='status' then
    if p_data->>'status' not in ('active','suspended','deactivated') or target.status='pending' then raise exception using errcode='22023',message='validation'; end if;
    update public.profiles set status=p_data->>'status' where user_id=p_user_id;
  elsif p_action='identity' then
    update public.profiles set full_name=btrim(p_data->>'fullName'),student_id=upper(p_data->>'studentId'),department=btrim(p_data->>'department'),batch=btrim(p_data->>'batch') where user_id=p_user_id;
    update public.enrollment_roster set full_name=btrim(p_data->>'fullName'),student_id=upper(p_data->>'studentId'),department=btrim(p_data->>'department'),batch=btrim(p_data->>'batch'),updated_at=now() where user_id=p_user_id;
  elsif p_action in ('grant-role','revoke-role') then
    v_scope_id := (p_data->>'scopeId')::uuid;
    if p_data->>'role' in ('moderator','enrollment_admin','system_admin') and v_scope_id is distinct from institution then raise exception using errcode='42501',message='authorization'; end if;
    if p_data->>'role'='transport_editor' and not exists(select 1 from public.community_routes where id=v_scope_id) then raise exception using errcode='22023',message='validation'; end if;
    if p_data->>'role'='support_staff' and not exists(select 1 from public.community_offices where id=v_scope_id) then raise exception using errcode='22023',message='validation'; end if;
    if p_action='grant-role' then
      if target.status<>'active' then raise exception using errcode='42501',message='authorization'; end if;
      insert into public.role_assignments(user_id,role,scope_kind,scope_id) values(p_user_id,p_data->>'role',p_data->>'scopeKind',v_scope_id) on conflict do nothing;
    else delete from public.role_assignments a where a.user_id=p_user_id and a.role=p_data->>'role' and a.scope_kind=p_data->>'scopeKind' and a.scope_id=v_scope_id; end if;
  else raise exception using errcode='22023',message='validation'; end if;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'profile',p_user_id,'administration.'||p_action,
    jsonb_build_object('reason',btrim(p_reason),'role',p_data->>'role','scopeId',p_data->>'scopeId','status',p_data->>'status'));
  return jsonb_build_object('applied',true,'targetUserId',p_user_id,'action',p_action);
end; $$;

create function public.community_admin_office(p_id uuid,p_title text,p_description text,p_staff_id uuid,p_active boolean) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare result public.community_offices; office_id uuid := coalesce(p_id,gen_random_uuid());
begin
  if not campus_private.community_admin() then raise exception using errcode='42501',message='authorization'; end if;
  if p_staff_id is not null and not exists(select 1 from public.role_assignments a join public.profiles p on p.user_id=a.user_id
    where a.user_id=p_staff_id and p.status='active' and role='support_staff' and scope_kind='office' and scope_id=office_id) then raise exception using errcode='22023',message='validation'; end if;
  insert into public.community_offices(id,title,description,default_staff_id,active) values(office_id,p_title,p_description,p_staff_id,p_active)
    on conflict(id) do update set title=excluded.title,description=excluded.description,default_staff_id=excluded.default_staff_id,active=excluded.active returning * into result;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'support_office',office_id,'office.update',jsonb_build_object('assignedStaffId',p_staff_id,'active',p_active));
  return to_jsonb(result);
end; $$;

-- The bucket has no authenticated object policies: upload/download are bounded, authorized server endpoints only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('campus-community','campus-community',false,3145728,array['image/png'])
  on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/png'];

revoke all on function campus_private.community_institution(),campus_private.community_moderator(),campus_private.community_admin(),campus_private.community_case_access(uuid) from public,anon,authenticated,service_role;
grant execute on function campus_private.community_institution(),campus_private.community_moderator(),campus_private.community_admin() to anon,authenticated;
grant execute on function campus_private.community_case_access(uuid) to authenticated;
grant execute on function campus_private.is_active(),campus_private.has_scope(text,text,uuid,boolean) to anon;
revoke all on function public.community_save_preferences(jsonb),public.community_publish_directory(uuid,integer,jsonb),public.community_publish_route(uuid,integer,jsonb),
  public.community_create_item(jsonb),public.community_claim_item(uuid,text),public.community_item_transition(uuid,integer,text,uuid),
  public.community_create_complaint(uuid,text,text),public.community_complaint_message(uuid,text,uuid),public.community_complaint_transition(uuid,integer,text,text),
  public.community_media_access(uuid),public.community_admin_change(uuid,uuid,text,jsonb,text),public.community_admin_office(uuid,text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.community_save_preferences(jsonb),public.community_publish_directory(uuid,integer,jsonb),public.community_publish_route(uuid,integer,jsonb),
  public.community_create_item(jsonb),public.community_claim_item(uuid,text),public.community_item_transition(uuid,integer,text,uuid),
  public.community_create_complaint(uuid,text,text),public.community_complaint_message(uuid,text,uuid),public.community_complaint_transition(uuid,integer,text,text),
  public.community_media_access(uuid),public.community_admin_change(uuid,uuid,text,jsonb,text),public.community_admin_office(uuid,text,text,uuid,boolean) to authenticated;

commit;
