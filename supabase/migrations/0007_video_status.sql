-- Neva — video statuses (up to 30 seconds). Additive. Run once in Supabase → SQL Editor after 0006.

alter table stories
  add column if not exists media_type text not null default 'image' check (media_type in ('image', 'video')),
  add column if not exists duration_seconds numeric check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 31));

-- Let the stories bucket hold short videos too (50 MB is the Supabase free-plan per-file maximum).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'stories';
