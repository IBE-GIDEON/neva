-- Neva — delivery/read receipts + one-event-one-notification. Additive; safe to run on the live database.
-- Run once in Supabase → SQL Editor after 0004.

-- ---------------------------------------------------------------------
-- 1. Receipts
--    delivered_at: when this member's device last received the conversation's messages (grey double tick)
--    seen_at:      when this member last read it, written only if their "Read receipts" setting is on (blue ticks)
--    (last_read_at stays private bookkeeping for unread counts across devices)
-- ---------------------------------------------------------------------
alter table conversation_members
  add column if not exists delivered_at timestamptz,
  add column if not exists seen_at timestamptz;

-- Server-clock writers, so receipts don't depend on each phone's clock being right.
create or replace function mark_delivered(p_conv uuid default null) returns void
language sql security definer set search_path = public as $$
  update conversation_members set delivered_at = now()
  where user_id = auth.uid() and (p_conv is null or conversation_id = p_conv);
$$;

create or replace function mark_read(p_conv uuid, p_seen boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update conversation_members
  set last_read_at = now(), delivered_at = now(), seen_at = case when p_seen then now() else seen_at end
  where user_id = auth.uid() and conversation_id = p_conv;
  -- Opening a chat clears its message/offer notifications.
  delete from notifications
  where recipient_id = auth.uid() and type in ('message', 'offer') and payload ->> 'conversation_id' = p_conv::text;
end $$;

-- ---------------------------------------------------------------------
-- 2. Follows: at most one "followed you" per person; unfollowing removes the unread one
-- ---------------------------------------------------------------------
create or replace function notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if exists (
    select 1 from notifications
    where recipient_id = new.followed_id and type = 'follow' and payload ->> 'actor_id' = new.follower_id::text
      and created_at > now() - interval '7 days'
  ) then return null; end if;
  select display_name into who from profiles where id = new.follower_id;
  insert into notifications (recipient_id, type, payload)
  values (new.followed_id, 'follow', jsonb_build_object('title', coalesce(who, 'Someone') || ' followed you', 'body', 'Tap to see their profile', 'actor_id', new.follower_id));
  return null;
end $$;

create or replace function unnotify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from notifications
  where recipient_id = old.followed_id and type = 'follow' and read_at is null and payload ->> 'actor_id' = old.follower_id::text;
  return null;
end $$;
drop trigger if exists follows_unnotify on follows;
create trigger follows_unnotify after delete on follows for each row execute function unnotify_follow();

-- ---------------------------------------------------------------------
-- 3. Chats: one notification per conversation. A new enquiry or offer updates the existing unread
--    notification for that chat (newest wording, moved to the top) instead of adding another row.
-- ---------------------------------------------------------------------
create or replace function notify_message() returns trigger language plpgsql security definer set search_path = public as $$
declare who text; c conversations; first_msg boolean; r record; kind text; title text; existing uuid;
begin
  if new.type not in ('text', 'offer', 'listing', 'image', 'story_reply') then return null; end if;
  select * into c from conversations where id = new.conversation_id;
  select display_name into who from profiles where id = new.sender_id;
  first_msg := not exists (select 1 from messages where conversation_id = new.conversation_id and id <> new.id);
  if new.type <> 'offer' and not first_msg then return null; end if;

  kind := case when new.type = 'offer' then 'offer' else 'message' end;
  title := case when new.type = 'offer'
                then coalesce(who, 'Someone') || ' made an offer of ₦' || to_char(new.offer_amount_minor / 100, 'FM999,999,999,999')
                else coalesce(who, 'Someone') || ' messaged you' end;

  for r in
    select m.user_id from conversation_members m
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id and m.muted_at is null
      and not is_blocked(m.user_id, new.sender_id)
  loop
    select id into existing from notifications
    where recipient_id = r.user_id and read_at is null and type in ('message', 'offer')
      and payload ->> 'conversation_id' = new.conversation_id::text
    order by created_at desc limit 1;

    if existing is not null then
      update notifications
      set type = kind, created_at = now(),
          payload = payload || jsonb_build_object('title', title, 'body', coalesce(c.listing_snapshot ->> 'title', 'New conversation'))
      where id = existing;
    else
      insert into notifications (recipient_id, type, payload) values (
        r.user_id, kind,
        jsonb_build_object('title', title, 'body', coalesce(c.listing_snapshot ->> 'title', 'New conversation'),
                           'actor_id', new.sender_id, 'conversation_id', new.conversation_id, 'listing_id', c.listing_id));
    end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. New listings from people you follow: one per listing, ever
-- ---------------------------------------------------------------------
create or replace function notify_new_listing() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status <> 'active' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return null; end if;
  if tg_op = 'UPDATE' and old.published_at is not null then return null; end if;
  select coalesce(shop_name, display_name) into who from profiles where id = new.seller_id;
  insert into notifications (recipient_id, type, payload)
  select f.follower_id, 'new_listing',
         jsonb_build_object('title', coalesce(who, 'A seller you follow') || ' listed something new', 'body', new.title, 'actor_id', new.seller_id, 'listing_id', new.id)
  from follows f
  where f.followed_id = new.seller_id and not is_blocked(f.follower_id, new.seller_id)
    and not exists (select 1 from notifications n where n.recipient_id = f.follower_id and n.type = 'new_listing' and n.payload ->> 'listing_id' = new.id::text);
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Tidy up duplicates that were already created (keep the newest of each)
-- ---------------------------------------------------------------------
delete from notifications n using notifications d
where n.recipient_id = d.recipient_id and n.type = d.type and n.type in ('follow', 'new_listing', 'message', 'offer')
  and coalesce(n.payload ->> 'conversation_id', n.payload ->> 'listing_id', n.payload ->> 'actor_id') =
      coalesce(d.payload ->> 'conversation_id', d.payload ->> 'listing_id', d.payload ->> 'actor_id')
  and (n.created_at, n.id) < (d.created_at, d.id);
