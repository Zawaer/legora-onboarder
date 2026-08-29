-- VANAV storage.
--
-- Run this once in the Supabase SQL editor (Dashboard, SQL Editor, New query,
-- paste, Run), after supabase/schema.sql. It is idempotent: safe to run again
-- after an edit. Until it is run, uploads fail with "bucket not found".
--
-- This is the other half of the `materials` table in schema.sql. That table is
-- the record of a file; this is the file. A customer drags in their existing
-- onboarding docs and role descriptions so the agent has more to work from
-- than Slack, and those documents are the most sensitive thing they hand over:
-- salary bands, org charts, the reason somebody was hired. Both customers who
-- signed named data security before they named a feature, so the storage layer
-- gets the same treatment the tables did.

-- ─────────────────────────────────────────────────────────────── the bucket
-- Private, not public. A public bucket serves every object to anyone who knows
-- or guesses its URL, with no auth check at all, and a URL leaks in ways a
-- password does not: a pasted link, a browser history, a referrer header. An
-- internal role description would then be world readable forever, and nothing
-- in the app would notice. Private means every read goes through a policy
-- below, and the app hands out short-lived signed URLs instead of permanent
-- ones.
--
-- The size limit is defence in depth. The UI already refuses anything over
-- 10 MB, but the UI is a suggestion to anyone with a console open, and this is
-- not.
--
-- The mime allow-list is deliberately narrow and exactly matches what the
-- uploader sets as the content type. It stops the bucket becoming a general
-- file host, which is how a document store turns into a malware relay.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ──────────────────────────────────────────────────────── path is the fence
-- Objects are stored at `<company_id>/<uuid>-<filename>`, and the first path
-- segment is the access boundary.
--
-- Storage has no foreign keys, so there is no company_id column to join on.
-- The only thing an object carries that the database can reason about is its
-- name. Putting the company id in the first folder segment turns "which
-- company owns this file" into something a policy can answer without a lookup
-- table that could drift out of step with the rows in public.materials.
--
-- The uuid in the filename exists so two people uploading `handbook.pdf` on
-- the same morning do not overwrite each other, and so the object name is
-- never guessable from the display name.
--
-- Written as a function for the same reason schema.sql wrote is_member() as
-- one: four policies that must agree, kept in one place so they cannot drift.
-- The regex guard matters. Casting a non-uuid folder name straight to uuid
-- raises, and a raising policy is an error page rather than a denial, so an
-- object uploaded to a junk path would break listing for everyone rather than
-- being quietly invisible. Null means "belongs to no company", and is_member()
-- is false for null, which is the denial we want.
create or replace function public.storage_folder_company(object_name text)
returns uuid language sql immutable as $$
  select case
    when (storage.foldername(object_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

-- ─────────────────────────────────────────────────────────────── policies
-- storage.objects already has RLS enabled by Supabase. These scope it to this
-- bucket only, so they cannot loosen anything in a bucket added later.
--
-- Read and write are membership, matching materials_read in schema.sql: an
-- employee reading the handbook is the point of the feature. Delete is admin
-- only, matching materials_admin_write, because a deleted object is gone and
-- an employee should not be able to empty their company's shelf.

drop policy if exists materials_objects_read on storage.objects;
create policy materials_objects_read on storage.objects
  for select using (
    bucket_id = 'materials'
    and public.is_member(public.storage_folder_company(name))
  );

drop policy if exists materials_objects_insert on storage.objects;
create policy materials_objects_insert on storage.objects
  for insert with check (
    bucket_id = 'materials'
    and public.is_member(public.storage_folder_company(name))
  );

-- Both halves are checked on update: `using` says which object you may touch,
-- `with check` says where it may end up. Without the second, a member could
-- rename an object into another company's folder and hand it to themselves.
drop policy if exists materials_objects_update on storage.objects;
create policy materials_objects_update on storage.objects
  for update
  using (
    bucket_id = 'materials'
    and public.is_member(public.storage_folder_company(name))
  )
  with check (
    bucket_id = 'materials'
    and public.is_member(public.storage_folder_company(name))
  );

drop policy if exists materials_objects_delete on storage.objects;
create policy materials_objects_delete on storage.objects
  for delete using (
    bucket_id = 'materials'
    and public.is_admin(public.storage_folder_company(name))
  );

-- Note for whoever reads this next: /api/app/materials runs with the service
-- key and bypasses every policy above. That is why the route does its own
-- membership check before it writes a row, and its own admin check before it
-- deletes one. These policies protect the browser path; the route protects the
-- server path. Neither one covers for the other.
