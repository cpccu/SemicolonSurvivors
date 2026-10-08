begin;
create table public.academic_audiences (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('department','course','section')),
  label text not null check(length(label) between 1 and 120), department_match text unique,
  check((kind = 'department' and length(department_match) between 1 and 100) or (kind <> 'department' and department_match is null))
);
-- Memberships are authoritative, provisioned by institutional operations; preferences never populate them.
create table public.academic_memberships (
  user_id uuid references public.profiles(user_id) on delete cascade, audience_id uuid references public.academic_audiences(id) on delete cascade,
  verified_at timestamptz not null default now(), primary key(user_id,audience_id)
);
create table public.campus_content (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('notice','article','service')),
  audience_id uuid not null references public.academic_audiences(id), publisher_id uuid not null references public.profiles(user_id), publisher_name text not null,
  title text not null check(length(title) between 3 and 180), body text not null check(length(body) between 10 and 12000), category text not null check(length(category) between 1 and 80),
  source_url text not null check(source_url ~ '^https://[^[:space:]@]+$' and length(source_url) <= 2048), owner_label text not null check(length(owner_label) between 2 and 120),
  visibility text not null check(visibility in ('public','campus')), reviewed_at timestamptz not null, expires_at timestamptz,
  opens_at timestamptz, closes_at timestamptz, eligibility text not null default '' check(length(eligibility) <= 2000),
  destination_url text check(destination_url ~ '^https://[^[:space:]@]+$' and length(destination_url) <= 2048),
  notice_type text not null check(notice_type in ('general','class_cancelled','room_change','time_change','exam','deadline')),
  change_before text not null default '' check(length(change_before) <= 1000), change_after text not null default '' check(length(change_after) <= 1000),
  approved_ai boolean not null default false, status text not null check(status in ('draft','published','archived')), version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(closes_at is null or opens_at is null or closes_at > opens_at), check(kind <> 'service' or (destination_url is not null and length(eligibility) > 0))
);
create index content_discovery_idx on public.campus_content(kind,status,updated_at desc);
create table public.content_revisions (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.campus_content(id), version integer not null,
  actor_name text not null, reason text not null check(length(reason) between 3 and 500), created_at timestamptz not null default now(), snapshot jsonb not null,
  unique(content_id,version)
);
create table public.campus_resources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(user_id), publisher_name text not null,
  title text not null check(length(title) between 3 and 180), description text not null check(length(description) between 3 and 2000),
  department text not null default '' check(length(department) <= 100), course text not null default '' check(length(course) <= 80), semester text not null default '' check(length(semester) <= 40),
  category text not null check(length(category) between 1 and 80), visibility text not null check(visibility in ('public','campus','private')),
  upload_state text not null default 'pending' check(upload_state in ('pending','ready','failed','cleanup_pending','removed')),
  mime_type text check(mime_type in ('text/plain','application/pdf')), byte_size integer check(byte_size between 1 and 3145728), approved_ai boolean not null default false,
  version integer not null default 1 check(version > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(not approved_ai or visibility in ('public','campus'))
);
create index resource_discovery_idx on public.campus_resources(upload_state,updated_at desc);
create table campus_private.resource_objects (
  resource_id uuid primary key references public.campus_resources(id), object_path text not null unique,
  expected_mime text not null check(expected_mime in ('text/plain','application/pdf')), preview_text text check(length(preview_text) <= 60000),
  storage_present boolean not null default false
);
create table public.resource_reports (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.campus_resources(id), reporter_id uuid not null references public.profiles(user_id),
  reason text not null check(length(reason) between 3 and 1000), status text not null default 'open' check(status in ('open','reviewed')),
  created_at timestamptz not null default now(), reviewed_at timestamptz, unique(resource_id,reporter_id)
);
create function campus_private.audience_member(p_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select campus_private.is_active() and exists(select 1 from public.academic_audiences a join public.profiles p on p.user_id = auth.uid() where a.id = p_id
    and ((a.kind = 'department' and a.department_match = p.department) or exists(select 1 from public.academic_memberships m where m.user_id = p.user_id and m.audience_id = a.id)));
$$;
create function campus_private.content_publisher(p_id uuid, p_mfa boolean default true) returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.academic_audiences a where a.id = p_id and campus_private.has_scope('academic_publisher',a.kind,a.id,p_mfa));
$$;
create function campus_private.resource_moderator() returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.role_assignments a where a.user_id = auth.uid() and a.role = 'moderator' and campus_private.has_scope('moderator','institution',a.scope_id));
$$;
create function campus_private.content_readable(p_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.campus_content c where c.id = p_id and (campus_private.content_publisher(c.audience_id)
    or (c.status = 'published' and (c.expires_at is null or c.expires_at > now()) and (c.visibility = 'public' or campus_private.audience_member(c.audience_id)))));
$$;
create function campus_private.resource_readable(p_id uuid) returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.campus_resources r where r.id = p_id and ((campus_private.is_active() and r.owner_id = auth.uid())
    or (r.visibility <> 'private' and campus_private.resource_moderator()) or (r.upload_state = 'ready' and (r.visibility = 'public' or (r.visibility = 'campus' and campus_private.is_active())))));
$$;
alter table public.academic_audiences enable row level security;
alter table public.academic_memberships enable row level security;
alter table public.campus_content enable row level security;
alter table public.content_revisions enable row level security;
alter table public.campus_resources enable row level security;
alter table public.resource_reports enable row level security;
alter table campus_private.resource_objects enable row level security;
create policy audiences_read on public.academic_audiences for select to authenticated using(campus_private.is_active());
create policy memberships_self on public.academic_memberships for select to authenticated using(user_id = auth.uid() and campus_private.is_active());
create policy content_read on public.campus_content for select to anon, authenticated using(campus_private.content_readable(id));
create policy revisions_read on public.content_revisions for select to anon, authenticated using(campus_private.content_readable(content_id));
create policy resource_read on public.campus_resources for select to anon, authenticated using(campus_private.resource_readable(id));
create policy report_read on public.resource_reports for select to authenticated using(campus_private.is_active() and (reporter_id = auth.uid() or (campus_private.resource_moderator() and exists(select 1 from public.campus_resources r where r.id = resource_id and r.visibility <> 'private'))));
revoke all on public.academic_audiences,public.academic_memberships,public.campus_content,public.content_revisions,public.campus_resources,public.resource_reports,campus_private.resource_objects from public,anon,authenticated;
grant select on public.campus_content,public.content_revisions,public.campus_resources to anon,authenticated;
grant select on public.academic_audiences,public.academic_memberships,public.resource_reports to authenticated;
grant select,insert,update,delete on public.academic_audiences,public.academic_memberships,public.campus_content,public.content_revisions,public.campus_resources,public.resource_reports,campus_private.resource_objects to service_role;
create function public.content_capabilities() returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('audiences',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'label',label) order by label) from public.academic_audiences where campus_private.is_active()),'[]'::jsonb),
    'publishAudiences',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'label',label) order by label) from public.academic_audiences where campus_private.content_publisher(id,false)),'[]'::jsonb),
    'moderatorScopes',coalesce((select jsonb_agg(scope_id) from public.role_assignments where user_id = auth.uid() and role = 'moderator' and campus_private.has_scope('moderator','institution',scope_id,false)),'[]'::jsonb));
$$;
create function public.content_save(p_id uuid,p_expected_version integer,p_input jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare c public.campus_content; aid uuid := (p_input->>'audienceId')::uuid; name text; v_id uuid;
begin
  if not campus_private.content_publisher(aid) then raise exception using errcode='42501',message='authorization'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or length(p_input->>'revisionReason') not between 3 and 500 or p_input->>'revisionReason' is null then raise exception using errcode='22023',message='validation'; end if;
  select full_name into name from public.profiles where user_id = auth.uid();
  if p_id is not null then
    select * into c from public.campus_content where id = p_id for update;
    if c.id is null or c.audience_id <> aid or c.kind <> p_input->>'kind' then raise exception using errcode='42501',message='authorization'; end if;
    if c.version is distinct from p_expected_version then raise exception using errcode='23505',message='conflict'; end if;
    v_id := c.id;
  else
    insert into public.campus_content(kind,audience_id,publisher_id,publisher_name,title,body,category,source_url,owner_label,visibility,reviewed_at,notice_type,status,eligibility,destination_url)
      values(p_input->>'kind',aid,auth.uid(),name,p_input->>'title',p_input->>'body',p_input->>'category',p_input->>'sourceUrl',p_input->>'ownerLabel',p_input->>'visibility',(p_input->>'reviewedAt')::timestamptz,p_input->>'noticeType',p_input->>'status',p_input->>'eligibility',p_input->>'destinationUrl') returning id into v_id;
  end if;
  update public.campus_content set title=p_input->>'title',body=p_input->>'body',category=p_input->>'category',source_url=p_input->>'sourceUrl',owner_label=p_input->>'ownerLabel',
    visibility=p_input->>'visibility',reviewed_at=(p_input->>'reviewedAt')::timestamptz,expires_at=(p_input->>'expiresAt')::timestamptz,opens_at=(p_input->>'opensAt')::timestamptz,closes_at=(p_input->>'closesAt')::timestamptz,
    eligibility=p_input->>'eligibility',destination_url=p_input->>'destinationUrl',notice_type=p_input->>'noticeType',change_before=p_input->>'changeBefore',change_after=p_input->>'changeAfter',approved_ai=(p_input->>'approvedAi')::boolean,
    status=p_input->>'status',version=case when p_id is null then 1 else version+1 end,updated_at=now() where id=v_id returning * into c;
  insert into public.content_revisions(content_id,version,actor_name,reason,snapshot) values(c.id,c.version,name,p_input->>'revisionReason',to_jsonb(c));
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),c.kind,c.id,'content.save',jsonb_build_object('version',c.version,'status',c.status));
  return to_jsonb(c);
end; $$;
create function public.content_delete(p_id uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare c public.campus_content; name text;
begin
  select * into c from public.campus_content where id=p_id for update;
  if c.id is null or not campus_private.content_publisher(c.audience_id) then raise exception using errcode='42501',message='authorization'; end if;
  if c.version is distinct from p_expected_version then raise exception using errcode='23505',message='conflict'; end if;
  update public.campus_content set status='archived',version=version+1,updated_at=now() where id=p_id returning * into c;
  select full_name into name from public.profiles where user_id=auth.uid();
  insert into public.content_revisions(content_id,version,actor_name,reason,snapshot) values(c.id,c.version,name,'Archived by publisher',to_jsonb(c));
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),c.kind,c.id,'content.archive'); return to_jsonb(c);
end; $$;
create function public.resource_begin(p_metadata jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources; mime text := p_metadata->>'mimeType';
begin
  if not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  if mime is null or mime not in ('text/plain','application/pdf') then raise exception using errcode='22023',message='validation'; end if;
  if (select count(*) from public.campus_resources where owner_id=auth.uid() and upload_state='pending' and created_at>now()-interval '1 hour') >= 5 then raise exception using errcode='P0001',message='quota'; end if;
  insert into public.campus_resources(owner_id,publisher_name,title,description,department,course,semester,category,visibility) values(auth.uid(),(select full_name from public.profiles where user_id=auth.uid()),p_metadata->>'title',p_metadata->>'description',p_metadata->>'department',p_metadata->>'course',p_metadata->>'semester',p_metadata->>'category',p_metadata->>'visibility') returning * into r;
  insert into campus_private.resource_objects(resource_id,object_path,expected_mime) values(r.id,auth.uid()::text||'/'||r.id::text||case when mime='text/plain' then '.txt' else '.pdf' end,mime);
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'resource',r.id,'resource.begin'); return to_jsonb(r);
end; $$;
create function public.resource_update(p_id uuid,p_expected_version integer,p_metadata jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id for update;
  if r.id is null or r.owner_id<>auth.uid() or not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  if r.version is distinct from p_expected_version or r.upload_state<>'ready' then raise exception using errcode='23505',message='conflict'; end if;
  update public.campus_resources set title=p_metadata->>'title',description=p_metadata->>'description',department=p_metadata->>'department',course=p_metadata->>'course',semester=p_metadata->>'semester',category=p_metadata->>'category',visibility=p_metadata->>'visibility',approved_ai=false,version=version+1,updated_at=now() where id=p_id returning * into r;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'resource',r.id,'resource.edit'); return to_jsonb(r);
end; $$;
create function public.resource_remove(p_id uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id for update;
  if r.id is null or r.owner_id<>auth.uid() or not campus_private.is_active() then raise exception using errcode='42501',message='authorization'; end if;
  if r.version is distinct from p_expected_version then raise exception using errcode='23505',message='conflict'; end if;
  update public.campus_resources set upload_state='cleanup_pending',approved_ai=false,version=version+1,updated_at=now() where id=p_id returning * into r;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(auth.uid(),'resource',r.id,'resource.remove'); return to_jsonb(r);
end; $$;
create function public.resource_report(p_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception using errcode='22023',message='validation'; end if;
  if not campus_private.is_active() or not campus_private.resource_readable(p_id) or not exists(select 1 from public.campus_resources where id=p_id and upload_state='ready') then raise exception using errcode='42501',message='authorization'; end if;
  insert into public.resource_reports(resource_id,reporter_id,reason) values(p_id,auth.uid(),p_reason) on conflict(resource_id,reporter_id) do update set reason=excluded.reason,status='open',reviewed_at=null;
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'resource',p_id,'resource.report',jsonb_build_object('reasonLength',length(p_reason)));
  return jsonb_build_object('reported',true);
end; $$;
create function public.resource_review(p_id uuid,p_scope_id uuid,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id for update;
  if r.id is null or r.visibility='private' or not campus_private.has_scope('moderator','institution',p_scope_id) then raise exception using errcode='42501',message='authorization'; end if;
  if p_action is null or p_action not in ('remove','approve_ai','dismiss') or p_reason is null or length(p_reason) not between 3 and 500 then raise exception using errcode='22023',message='validation'; end if;
  if p_action='approve_ai' and (r.upload_state<>'ready' or r.mime_type<>'text/plain') then raise exception using errcode='22023',message='validation'; end if;
  update public.campus_resources set upload_state=case when p_action='remove' then 'cleanup_pending' else upload_state end,approved_ai=case when p_action='approve_ai' then true when p_action='remove' then false else approved_ai end,version=version+1,updated_at=now() where id=p_id returning * into r;
  update public.resource_reports set status='reviewed',reviewed_at=now() where resource_id=p_id and status='open';
  insert into public.audit_events(actor_id,target_type,target_id,action,details) values(auth.uid(),'resource',p_id,'resource.review',jsonb_build_object('decision',p_action,'reason',p_reason)); return to_jsonb(r);
end; $$;
create function public.resource_preview(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare r public.campus_resources; preview text;
begin
  select * into r from public.campus_resources where id=p_id;
  if r.id is null or r.upload_state<>'ready' or not campus_private.resource_readable(p_id) then raise exception using errcode='42501',message='authorization'; end if;
  select preview_text into preview from campus_private.resource_objects where resource_id=p_id;
  return jsonb_build_object('text',preview,'supported',r.mime_type='text/plain','version',r.version);
end; $$;
create function public.resource_storage_record(p_id uuid,p_actor_id uuid) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id;
  if r.id is null or not ((r.upload_state='ready' and r.visibility='public' and p_actor_id is null) or exists(select 1 from public.profiles p where p.user_id=p_actor_id and p.status='active' and (r.owner_id=p.user_id or (r.upload_state='ready' and r.visibility='campus') or (r.visibility<>'private' and exists(select 1 from public.role_assignments a where a.user_id=p.user_id and a.role='moderator' and a.scope_kind='institution'))))) then raise exception using errcode='42501',message='authorization'; end if;
  return (select jsonb_build_object('path',o.object_path,'expectedMime',o.expected_mime,'state',r.upload_state,'ownerId',r.owner_id,'storagePresent',o.storage_present) from campus_private.resource_objects o where o.resource_id=p_id);
end; $$;
create function public.resource_finish(p_id uuid,p_actor_id uuid,p_size integer,p_mime text,p_text text) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id for update;
  if r.id is null or r.owner_id is distinct from p_actor_id or not exists(select 1 from public.profiles where user_id=p_actor_id and status='active') then raise exception using errcode='42501',message='authorization'; end if;
  if r.upload_state<>'pending' then raise exception using errcode='23505',message='conflict'; end if;
  if p_size is null or p_size not between 1 and 3145728 or p_mime is distinct from (select expected_mime from campus_private.resource_objects where resource_id=p_id) or (p_mime='text/plain' and p_text is null) or (p_mime='application/pdf' and p_text is not null) then raise exception using errcode='22023',message='validation'; end if;
  update campus_private.resource_objects set preview_text=p_text,storage_present=true where resource_id=p_id;
  update public.campus_resources set upload_state='ready',mime_type=p_mime,byte_size=p_size,updated_at=now() where id=p_id returning * into r;
  insert into public.audit_events(actor_id,target_type,target_id,action) values(p_actor_id,'resource',p_id,'resource.finalize'); return to_jsonb(r);
end; $$;
create function public.resource_storage_outcome(p_id uuid,p_actor_id uuid,p_outcome text) returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id=p_id for update;
  if r.id is null or not exists(select 1 from public.profiles p where p.user_id=p_actor_id and p.status='active' and (r.owner_id=p.user_id or (r.visibility<>'private' and exists(select 1 from public.role_assignments a where a.user_id=p.user_id and a.role='moderator' and a.scope_kind='institution')))) then raise exception using errcode='42501',message='authorization'; end if;
  if p_outcome is null or p_outcome not in ('failed','cleanup_pending','cleaned') or r.upload_state='ready' then raise exception using errcode='23505',message='conflict'; end if;
  update public.campus_resources set upload_state=case when p_outcome='cleaned' then 'removed' else p_outcome end,updated_at=now() where id=p_id;
  update campus_private.resource_objects set storage_present=p_outcome='cleanup_pending',preview_text=null where resource_id=p_id; return true;
end; $$;
revoke all on function campus_private.audience_member(uuid),campus_private.content_publisher(uuid,boolean),campus_private.resource_moderator(),campus_private.content_readable(uuid),campus_private.resource_readable(uuid) from public,anon,authenticated,service_role;
grant execute on function campus_private.content_readable(uuid),campus_private.resource_readable(uuid) to anon,authenticated;
grant usage on schema campus_private to anon;
grant execute on function campus_private.audience_member(uuid),campus_private.content_publisher(uuid,boolean),campus_private.resource_moderator() to authenticated;
revoke all on function public.content_capabilities(),public.content_save(uuid,integer,jsonb),public.content_delete(uuid,integer),public.resource_begin(jsonb),public.resource_update(uuid,integer,jsonb),public.resource_remove(uuid,integer),public.resource_report(uuid,text),public.resource_review(uuid,uuid,text,text),public.resource_preview(uuid),public.resource_storage_record(uuid,uuid),public.resource_finish(uuid,uuid,integer,text,text),public.resource_storage_outcome(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.content_capabilities(),public.content_save(uuid,integer,jsonb),public.content_delete(uuid,integer),public.resource_begin(jsonb),public.resource_update(uuid,integer,jsonb),public.resource_remove(uuid,integer),public.resource_report(uuid,text),public.resource_review(uuid,uuid,text,text),public.resource_preview(uuid) to authenticated;
grant execute on function public.resource_preview(uuid) to anon;
grant execute on function public.resource_storage_record(uuid,uuid),public.resource_finish(uuid,uuid,integer,text,text),public.resource_storage_outcome(uuid,uuid,text) to service_role;
commit;
