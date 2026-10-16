-- Neva — sync support for the shared app store (packages/core/src/remote).
-- Everything here is additive. The client detects it (conversation_members.cleared_at) and falls back
-- gracefully when it hasn't been applied yet. Run once in Supabase → SQL Editor.

-- ---------------------------------------------------------------------
-- 1. Columns the app already has locally but 0001 can't store
-- ---------------------------------------------------------------------
alter table profiles add column if not exists cover_path text;                -- profile / shop banner (avatars bucket)
alter table messages add column if not exists meta jsonb;                     -- e.g. {"voiceSeconds": 7}
alter table conversation_members
  add column if not exists cleared_at timestamptz,                            -- "Clear chat": hide messages before this, for me only
  add column if not exists hidden_at  timestamptz;                            -- "Delete chat": hidden for me until a newer message arrives

-- ---------------------------------------------------------------------
-- 2. Read receipts: members can read each other's membership row (last_read_at)
-- ---------------------------------------------------------------------
create policy "members read co-members" on conversation_members for select using (is_member(conversation_id));

-- ---------------------------------------------------------------------
-- 3. Reviews: edit / delete your own; verification decided server-side
-- ---------------------------------------------------------------------
create or replace function set_review_verification() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / staff tooling
  if tg_op = 'UPDATE' then
    new.reviewer_id := old.reviewer_id;
    new.seller_id   := old.seller_id;
    new.status      := old.status;
    new.created_at  := old.created_at;
    if old.verification_type = 'transaction' then new.verification_type := 'transaction'; return new; end if;
  end if;
  new.verification_type := case when exists (
    select 1 from conversations c
    join messages m on m.conversation_id = c.id and m.sender_id = new.reviewer_id
    where (c.buyer_id = new.reviewer_id and c.seller_id = new.seller_id)
       or (c.seller_id = new.reviewer_id and c.buyer_id = new.seller_id)
  ) then 'conversation' else 'unverified' end;
  return new;
end $$;
drop trigger if exists reviews_verification on reviews;
create trigger reviews_verification before insert or update on reviews for each row execute function set_review_verification();

drop policy if exists "write review" on reviews;
create policy "write review" on reviews for insert with check (reviewer_id = auth.uid());   -- verification_type is set by the trigger
create policy "edit own review" on reviews for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy "delete own review" on reviews for delete using (reviewer_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Notifications: let people delete their own
-- ---------------------------------------------------------------------
create policy "delete own notifications" on notifications for delete using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Counters: saves (trigger), views (RPC), follower counts (RPC)
-- ---------------------------------------------------------------------
create or replace function sync_listing_saves() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update listings set saves = saves + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update listings set saves = greatest(0, saves - 1) where id = old.listing_id;
  end if;
  return null;
end $$;
drop trigger if exists saved_listings_count on saved_listings;
create trigger saved_listings_count after insert or delete on saved_listings for each row execute function sync_listing_saves();
update listings l set saves = (select count(*) from saved_listings s where s.listing_id = l.id);

create or replace function bump_listing_view(p_listing uuid) returns void language sql security definer set search_path = public as $$
  update listings set views = views + 1
  where id = p_listing and status = 'active' and auth.uid() is not null and seller_id <> auth.uid();
$$;

create or replace function profile_stats(p_ids uuid[])
returns table (id uuid, followers bigint, following bigint)
language sql stable security definer set search_path = public as $$
  select u.id,
         (select count(*) from follows f where f.followed_id = u.id),
         (select count(*) from follows f where f.follower_id = u.id)
  from unnest(p_ids[1:500]) as u(id);
$$;

-- ---------------------------------------------------------------------
-- 6. start_conversation with a client-chosen id (offline-first: local id == server id)
--    Separate 3-argument overload; the original 2-argument function keeps working.
--    Also: reuses a listing-less chat in either direction, un-hides/un-archives it for the caller,
--    and stores the first listing photo in the snapshot.
-- ---------------------------------------------------------------------
create or replace function start_conversation(p_seller uuid, p_listing uuid, p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; l listings; img text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_seller = auth.uid() then raise exception 'cannot message yourself'; end if;
  if is_blocked(auth.uid(), p_seller) then raise exception 'blocked'; end if;

  select id into cid from conversations where buyer_id = auth.uid() and seller_id = p_seller and listing_id is not distinct from p_listing;
  if cid is null and p_listing is null then
    select id into cid from conversations where buyer_id = p_seller and seller_id = auth.uid() and listing_id is null;
  end if;
  if cid is not null then
    update conversation_members set hidden_at = null, archived_at = null where conversation_id = cid and user_id = auth.uid();
    return cid;
  end if;

  if (select count(*) from conversations where buyer_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;
  if p_listing is not null then
    select * into l from listings where id = p_listing and seller_id = p_seller and status = 'active';
    if l.id is null then raise exception 'listing unavailable'; end if;
    select storage_path into img from listing_media where listing_id = l.id order by sort_order limit 1;
    update listings set enquiries = enquiries + 1 where id = p_listing;
  end if;

  insert into conversations (id, buyer_id, seller_id, listing_id, listing_snapshot)
  values (
    coalesce(p_id, gen_random_uuid()), auth.uid(), p_seller, p_listing,
    case when l.id is null then null
         else jsonb_build_object('title', l.title, 'price_minor', l.price_minor, 'condition', l.condition, 'image', img) end
  )
  returning id into cid;
  insert into conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, p_seller);
  return cid;
end $$;

-- ---------------------------------------------------------------------
-- 7. Realtime for reactions and read receipts / multi-device chat state
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table message_reactions, conversation_members;
