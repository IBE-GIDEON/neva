-- Neva storage: buckets for photos + access rules.
-- Every upload goes under a folder named after the uploader's user id: <bucket>/<auth.uid()>/<file>.
-- Run once in Supabase → SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',       'avatars',       true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('listing-media', 'listing-media', true,  8388608,  array['image/jpeg','image/png','image/webp']),
  ('stories',       'stories',       true,  8388608,  array['image/jpeg','image/png','image/webp']),
  ('chat-media',    'chat-media',    false, 8388608,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Public buckets: anyone can view (images are referenced from public listings/profiles/statuses);
-- only the owner can upload, replace or delete files in their own folder.
create policy "public media readable"
  on storage.objects for select
  using (bucket_id in ('avatars', 'listing-media', 'stories'));

create policy "owners upload own media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'listing-media', 'stories', 'chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners update own media"
  on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text)
  with check ((storage.foldername(name))[1] = auth.uid()::text);

create policy "owners delete own media"
  on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);

-- Chat photos are private: path is chat-media/<sender id>/<conversation id>/<file>.
-- Readable only by members of that conversation.
create policy "chat media readable by members"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_member(((storage.foldername(name))[2])::uuid)
  );

-- Live updates for new statuses.
alter publication supabase_realtime add table stories;
