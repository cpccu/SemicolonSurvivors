begin;

-- Administration lookup never exposes the profiles table directly. The RPC
-- authorizes the configured institution system administrator and AAL2 before
-- returning a bounded, minimal directory and club list.
create function public.administration_lookup(p_scope_id uuid, p_query text) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare institution uuid := campus_private.community_institution();
begin
  if p_scope_id is distinct from institution or not campus_private.has_scope('system_admin','institution',institution,true) then
    raise exception using errcode='42501', message='authorization';
  end if;
  if p_query is null or char_length(btrim(p_query)) > 80 then
    raise exception using errcode='22023', message='validation';
  end if;
  return jsonb_build_object(
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', matched.user_id, 'fullName', matched.full_name,
        'studentId', matched.student_id, 'department', matched.department
      ) order by matched.full_name, matched.user_id)
      from (
        select p.user_id, p.full_name, p.student_id, p.department
        from public.profiles p
        where p.status = 'active'
          and (
            btrim(p_query) = ''
            or position(lower(btrim(p_query)) in lower(p.full_name)) > 0
            or position(lower(btrim(p_query)) in lower(coalesce(p.student_id, ''))) > 0
            or position(lower(btrim(p_query)) in lower(coalesce(p.department, ''))) > 0
          )
        order by p.full_name, p.user_id
        limit 25
      ) matched
    ), '[]'::jsonb),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', listed.id, 'name', listed.name, 'description', listed.description, 'created_at', listed.created_at
      ) order by listed.name, listed.id)
      from (
        select c.id, c.name, c.description, c.created_at
        from public.clubs c
        order by c.name, c.id
        limit 100
      ) listed
    ), '[]'::jsonb)
  );
end;
$$;

create function public.administration_create_club(p_scope_id uuid, p_name text, p_description text) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare institution uuid := campus_private.community_institution(); result public.clubs;
begin
  if p_scope_id is distinct from institution or not campus_private.has_scope('system_admin','institution',institution,true) then
    raise exception using errcode='42501', message='authorization';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 160
    or char_length(btrim(coalesce(p_description, ''))) > 5000 then
    raise exception using errcode='22023', message='validation';
  end if;
  insert into public.clubs(name, description)
    values (btrim(p_name), btrim(coalesce(p_description, '')))
    returning * into result;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'club', result.id, 'club.create',
      jsonb_build_object('name', result.name, 'description', result.description));
  return to_jsonb(result);
end;
$$;

-- Keep the existing audited administration RPC as the single role-change path,
-- while ensuring a club organizer assignment can only reference a real club.
create or replace function public.community_admin_change(p_scope_id uuid,p_user_id uuid,p_action text,p_data jsonb,p_reason text) returns jsonb
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
    if p_data->>'role'='club_organizer' and (p_data->>'scopeKind') is distinct from 'club' then raise exception using errcode='22023',message='validation'; end if;
    if p_data->>'role'='club_organizer' and not exists(select 1 from public.clubs where id=v_scope_id) then raise exception using errcode='22023',message='validation'; end if;
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

revoke all on function public.administration_lookup(uuid,text), public.administration_create_club(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.administration_lookup(uuid,text), public.administration_create_club(uuid,text,text) to authenticated;

commit;
