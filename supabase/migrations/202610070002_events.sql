begin;

create table public.clubs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  created_at timestamptz not null default now()
);

create table public.campus_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  category text not null check (category in ('Technology', 'Community', 'Creative', 'Academic', 'Other')),
  venue text not null check (char_length(btrim(venue)) between 2 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  registration_deadline timestamptz not null check (registration_deadline <= starts_at),
  capacity integer not null check (capacity between 1 and 10000),
  visibility text not null default 'campus' check (visibility in ('public', 'campus')),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campus_events_browse on public.campus_events (status, starts_at, id);
create index campus_events_club on public.campus_events (club_id, status);

create table public.event_registrations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_id uuid not null references public.campus_events(id),
  user_id uuid not null references public.profiles(user_id),
  status text not null check (status in ('registered', 'waitlisted', 'cancelled')),
  ticket_token uuid unique,
  queued_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(user_id),
  unique (event_id, user_id),
  check ((status = 'registered' and ticket_token is not null) or (status <> 'registered' and ticket_token is null)),
  check ((checked_in_at is null) = (checked_in_by is null))
);
create index event_registrations_queue on public.event_registrations (event_id, status, queued_at, id);
create index event_registrations_owner on public.event_registrations (user_id, event_id);

alter table public.clubs enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_registrations enable row level security;
revoke all on public.clubs, public.campus_events, public.event_registrations from public, anon, authenticated;
grant select on public.clubs, public.campus_events to anon, authenticated;
grant select on public.event_registrations to authenticated;
grant select, insert, update, delete on public.clubs, public.campus_events, public.event_registrations to service_role;

create policy events_public_read on public.campus_events for select to anon
  using (visibility = 'public' and status = 'published');
create policy events_member_read on public.campus_events for select to authenticated
  using (campus_private.is_active() and (
    status in ('published', 'cancelled') or campus_private.has_scope('club_organizer', 'club', club_id, true)
  ));
create policy clubs_public_read on public.clubs for select to anon
  using (exists (select 1 from public.campus_events e where e.club_id = clubs.id and e.visibility = 'public' and e.status = 'published'));
create policy clubs_member_read on public.clubs for select to authenticated using (campus_private.is_active());
create policy registrations_owner_or_organizer_read on public.event_registrations for select to authenticated
  using (campus_private.is_active() and (
    user_id = auth.uid() or exists (
      select 1 from public.campus_events e where e.id = event_id
        and campus_private.has_scope('club_organizer', 'club', e.club_id, true)
    )
  ));

create function campus_private.event_ticket(p_registration_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'event_id', r.event_id, 'status', r.status, 'ticket_token', r.ticket_token,
    'checked_in_at', r.checked_in_at, 'queued_at', r.queued_at, 'updated_at', r.updated_at,
    'waitlist_position', case when r.status = 'waitlisted' then (
      select count(*) from public.event_registrations q join public.profiles p on p.user_id = q.user_id
      where q.event_id = r.event_id and q.status = 'waitlisted' and p.status = 'active'
        and (q.queued_at, q.id) <= (r.queued_at, r.id)
    ) else null end
  ) from public.event_registrations r where r.id = p_registration_id
$$;

-- Every caller locks the event first; seat allocation and FIFO promotion share that lock.
create function campus_private.promote_event_waitlist(p_event_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events; v_id uuid; v_free integer; v_promoted integer := 0;
begin
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or v_event.status <> 'published' or v_event.starts_at <= clock_timestamp() then return 0; end if;
  select v_event.capacity - count(*) into v_free from public.event_registrations
    where event_id = p_event_id and status = 'registered';
  while v_free > 0 loop
    select r.id into v_id from public.event_registrations r join public.profiles p on p.user_id = r.user_id
      where r.event_id = p_event_id and r.status = 'waitlisted' and p.status = 'active'
      order by r.queued_at, r.id limit 1 for update of r;
    exit when not found;
    update public.event_registrations set status = 'registered', ticket_token = pg_catalog.gen_random_uuid(), updated_at = now() where id = v_id;
    insert into public.audit_events(actor_id, target_type, target_id, action, details)
      values (auth.uid(), 'event_registration', v_id, 'waitlist_promoted', jsonb_build_object('event_id', p_event_id));
    v_promoted := v_promoted + 1; v_free := v_free - 1;
  end loop;
  return v_promoted;
end
$$;

create function public.event_register(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events; v_registration public.event_registrations; v_status text; v_count integer;
begin
  if not campus_private.is_active() then raise exception 'event_access_denied' using errcode = '42501'; end if;
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then raise exception 'event_unavailable' using errcode = 'P0002'; end if;
  select * into v_registration from public.event_registrations where event_id = p_event_id and user_id = auth.uid();
  if found and v_registration.status <> 'cancelled' then return campus_private.event_ticket(v_registration.id); end if;
  if v_event.registration_deadline <= clock_timestamp() or v_event.starts_at <= clock_timestamp() then raise exception 'event_closed' using errcode = 'P0001'; end if;
  perform campus_private.promote_event_waitlist(p_event_id);
  select count(*) into v_count from public.event_registrations where event_id = p_event_id and status = 'registered';
  v_status := case when v_count < v_event.capacity then 'registered' else 'waitlisted' end;
  if v_status = 'waitlisted' and (select count(*) from public.event_registrations where event_id = p_event_id and status = 'waitlisted') >= 10000 then
    raise exception 'event_waitlist_full' using errcode = 'P0001';
  end if;
  insert into public.event_registrations(event_id, user_id, status, ticket_token)
    values (p_event_id, auth.uid(), v_status, case when v_status = 'registered' then pg_catalog.gen_random_uuid() else null end)
    on conflict (event_id, user_id) do update set status = excluded.status, ticket_token = excluded.ticket_token,
      queued_at = clock_timestamp(), updated_at = now(), checked_in_at = null, checked_in_by = null
    returning * into v_registration;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event_registration', v_registration.id, 'registration_created', jsonb_build_object('event_id', p_event_id, 'status', v_status));
  return campus_private.event_ticket(v_registration.id);
end
$$;

create function public.event_cancel_registration(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events; v_registration public.event_registrations;
begin
  if not campus_private.is_active() then raise exception 'event_access_denied' using errcode = '42501'; end if;
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found then raise exception 'event_unavailable' using errcode = 'P0002'; end if;
  select * into v_registration from public.event_registrations where event_id = p_event_id and user_id = auth.uid() for update;
  if not found then return null; end if;
  if v_registration.status = 'cancelled' then return campus_private.event_ticket(v_registration.id); end if;
  if v_registration.checked_in_at is not null or (v_event.starts_at <= clock_timestamp() and v_event.status <> 'cancelled') then
    raise exception 'event_cancellation_closed' using errcode = 'P0001';
  end if;
  update public.event_registrations set status = 'cancelled', ticket_token = null, updated_at = now() where id = v_registration.id;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event_registration', v_registration.id, 'registration_cancelled', jsonb_build_object('event_id', p_event_id));
  perform campus_private.promote_event_waitlist(p_event_id);
  return campus_private.event_ticket(v_registration.id);
end
$$;

create function public.event_own_ticket(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not campus_private.is_active() then raise exception 'event_access_denied' using errcode = '42501'; end if;
  select id into v_id from public.event_registrations where event_id = p_event_id and user_id = auth.uid();
  return campus_private.event_ticket(v_id);
end
$$;

create function public.event_check_in(p_event_id uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events; v_registration public.event_registrations;
begin
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or not campus_private.is_active() or not campus_private.has_scope('club_organizer', 'club', v_event.club_id, true) then
    raise exception 'event_access_denied' using errcode = '42501';
  end if;
  if v_event.status <> 'published' then raise exception 'event_unavailable' using errcode = 'P0001'; end if;
  select r.* into v_registration from public.event_registrations r join public.profiles p on p.user_id = r.user_id
    where r.event_id = p_event_id and r.ticket_token = p_token and r.status = 'registered' and p.status = 'active' for update of r;
  if not found then raise exception 'event_ticket_invalid' using errcode = 'P0002'; end if;
  if v_registration.checked_in_at is not null then
    return jsonb_build_object('already_checked_in', true, 'checked_in_at', v_registration.checked_in_at);
  end if;
  if clock_timestamp() < v_event.starts_at - interval '2 hours' or clock_timestamp() > v_event.ends_at then
    raise exception 'event_checkin_closed' using errcode = 'P0001';
  end if;
  update public.event_registrations set checked_in_at = now(), checked_in_by = auth.uid(), updated_at = now() where id = v_registration.id;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event_registration', v_registration.id, 'checked_in', jsonb_build_object('event_id', p_event_id));
  return jsonb_build_object('already_checked_in', false, 'checked_in_at', now());
end
$$;

create function public.event_promote_waitlist(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events;
begin
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or not campus_private.is_active() or not campus_private.has_scope('club_organizer', 'club', v_event.club_id, true) then
    raise exception 'event_access_denied' using errcode = '42501';
  end if;
  return jsonb_build_object('promoted', campus_private.promote_event_waitlist(p_event_id));
end
$$;

create function public.event_create(
  p_club_id uuid, p_title text, p_description text, p_category text, p_venue text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_registration_deadline timestamptz,
  p_capacity integer, p_visibility text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events;
begin
  if not campus_private.is_active() or not campus_private.has_scope('club_organizer', 'club', p_club_id, true) then raise exception 'event_access_denied' using errcode = '42501'; end if;
  if p_starts_at <= clock_timestamp() or p_registration_deadline <= clock_timestamp() then raise exception 'event_invalid_dates' using errcode = '22023'; end if;
  insert into public.campus_events(club_id, title, description, category, venue, starts_at, ends_at, registration_deadline, capacity, visibility)
    values (p_club_id, btrim(p_title), btrim(p_description), p_category, btrim(p_venue), p_starts_at, p_ends_at, p_registration_deadline, p_capacity, p_visibility)
    returning * into v_event;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event', v_event.id, 'event_created', jsonb_build_object('club_id', p_club_id));
  return to_jsonb(v_event);
end
$$;

create function public.event_publish(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events;
begin
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or not campus_private.is_active() or not campus_private.has_scope('club_organizer', 'club', v_event.club_id, true) then raise exception 'event_access_denied' using errcode = '42501'; end if;
  if v_event.status = 'published' then return to_jsonb(v_event); end if;
  if v_event.status <> 'draft' or v_event.registration_deadline <= clock_timestamp() then raise exception 'event_publish_closed' using errcode = 'P0001'; end if;
  update public.campus_events set status = 'published', updated_at = now() where id = p_event_id returning * into v_event;
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event', p_event_id, 'event_published', '{}'::jsonb);
  return to_jsonb(v_event);
end
$$;

create function public.event_cancel(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_event public.campus_events;
begin
  select * into v_event from public.campus_events where id = p_event_id for update;
  if not found or not campus_private.is_active() or not campus_private.has_scope('club_organizer', 'club', v_event.club_id, true) then raise exception 'event_access_denied' using errcode = '42501'; end if;
  if v_event.status = 'cancelled' then return to_jsonb(v_event); end if;
  update public.campus_events set status = 'cancelled', updated_at = now() where id = p_event_id returning * into v_event;
  -- The durable registration state is the owner's in-app cancellation update; retain check-in history.
  update public.event_registrations set status = 'cancelled', ticket_token = null, updated_at = now() where event_id = p_event_id and status <> 'cancelled';
  insert into public.audit_events(actor_id, target_type, target_id, action, details)
    values (auth.uid(), 'event', p_event_id, 'event_cancelled', '{}'::jsonb);
  return to_jsonb(v_event);
end
$$;

create function public.event_organizer_capabilities() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'clubs', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name) from (
      select c.id, c.name from public.clubs c where campus_private.is_active() and campus_private.has_scope('club_organizer', 'club', c.id, true)
      order by c.name, c.id limit 100
    ) c), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
      select e.* from public.campus_events e where campus_private.is_active() and campus_private.has_scope('club_organizer', 'club', e.club_id, true)
      order by e.created_at desc limit 100
    ) e), '[]'::jsonb)
  )
$$;

revoke all on function campus_private.event_ticket(uuid), campus_private.promote_event_waitlist(uuid) from public, anon, authenticated, service_role;
revoke all on function public.event_register(uuid), public.event_cancel_registration(uuid), public.event_own_ticket(uuid),
  public.event_check_in(uuid, uuid), public.event_promote_waitlist(uuid), public.event_publish(uuid), public.event_cancel(uuid),
  public.event_create(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer, text),
  public.event_organizer_capabilities() from public, anon, authenticated, service_role;
grant execute on function public.event_register(uuid), public.event_cancel_registration(uuid), public.event_own_ticket(uuid),
  public.event_check_in(uuid, uuid), public.event_promote_waitlist(uuid), public.event_publish(uuid), public.event_cancel(uuid),
  public.event_create(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer, text),
  public.event_organizer_capabilities() to authenticated;

commit;
