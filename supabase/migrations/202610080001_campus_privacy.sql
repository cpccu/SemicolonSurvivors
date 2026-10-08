begin;

-- CampusOS is login-first. Existing visibility labels still control discovery
-- among active accounts; they no longer authorize anonymous access.
revoke all on public.clubs, public.campus_events, public.campus_content,
  public.content_revisions, public.campus_resources, public.community_directory,
  public.community_routes from public, anon;
revoke execute on function public.resource_preview(uuid) from public, anon;

drop policy events_public_read on public.campus_events;
drop policy clubs_public_read on public.clubs;

create or replace function campus_private.content_readable(p_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select campus_private.is_active() and exists(
    select 1 from public.campus_content c where c.id = p_id and (
      campus_private.content_publisher(c.audience_id)
      or (c.status = 'published' and (c.expires_at is null or c.expires_at > now())
        and (c.visibility = 'public' or campus_private.audience_member(c.audience_id)))
    )
  );
$$;
create or replace function campus_private.resource_readable(p_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select campus_private.is_active() and exists(
    select 1 from public.campus_resources r where r.id = p_id and (
      r.owner_id = auth.uid()
      or (r.visibility <> 'private' and campus_private.resource_moderator())
      or (r.upload_state = 'ready' and r.visibility in ('public', 'campus'))
    )
  );
$$;

alter policy content_read on public.campus_content to authenticated;
alter policy revisions_read on public.content_revisions to authenticated;
alter policy resource_read on public.campus_resources to authenticated;
alter policy community_directory_read on public.community_directory to authenticated
  using ((state = 'published' and campus_private.is_active()) or campus_private.community_moderator());
alter policy community_routes_read on public.community_routes to authenticated
  using ((state = 'published' and campus_private.is_active())
    or campus_private.has_scope('transport_editor','route',id) or campus_private.community_moderator());

-- Service-only storage access must carry a current active actor, including for
-- resources labeled public. Preserve owner/moderator cleanup authorization.
create or replace function public.resource_storage_record(p_id uuid,p_actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare r public.campus_resources;
begin
  select * into r from public.campus_resources where id = p_id;
  if r.id is null or not exists(
    select 1 from public.profiles p where p.user_id = p_actor_id and p.status = 'active' and (
      r.owner_id = p.user_id
      or (r.upload_state = 'ready' and r.visibility in ('public','campus'))
      or (r.visibility <> 'private' and exists(
        select 1 from public.role_assignments a where a.user_id = p.user_id
          and a.role = 'moderator' and a.scope_kind = 'institution'
      ))
    )
  ) then raise exception using errcode = '42501', message = 'authorization'; end if;
  return (select jsonb_build_object('path',o.object_path,'expectedMime',o.expected_mime,
    'state',r.upload_state,'ownerId',r.owner_id,'storagePresent',o.storage_present)
    from campus_private.resource_objects o where o.resource_id = p_id);
end;
$$;

-- These helpers existed only to support the removed anonymous read policies.
revoke execute on function campus_private.content_readable(uuid),
  campus_private.resource_readable(uuid), campus_private.community_institution(),
  campus_private.community_moderator(), campus_private.community_admin(),
  campus_private.is_active(), campus_private.has_scope(text,text,uuid,boolean) from anon;
revoke usage on schema campus_private from anon;

commit;
