begin;
-- All reads and writes use the authorized server adapter; there is deliberately no browser object policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campus-resources','campus-resources',false,3145728,array['text/plain','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Supabase owns storage.objects and manages its RLS state; the hosted postgres role
-- cannot alter that managed table, so this migration only configures the bucket.
commit;
