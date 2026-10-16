-- Neva — notifications created by the database (so they work the same on phone and web).
-- Additive. Run once in Supabase → SQL Editor after 0003.
-- Payload shape read by the apps: { title, body, actor_id, listing_id, conversation_id }. No message text is copied.

-- New follower ----------------------------------------------------------
create or replace function notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select display_name into who from profiles where id = new.follower_id;
  insert into notifications (recipient_id, type, payload)
  values (new.followed_id, 'follow', jsonb_build_object('title', coalesce(who, 'Someone') || ' followed you', 'body', 'Tap to see their profile', 'actor_id', new.follower_id));
  return null;
end $$;
drop trigger if exists follows_notify on follows;
create trigger follows_notify after insert on follows for each row execute function notify_follow();

-- Offers and new enquiries --------------------------------------------------
-- Ordinary chat messages already show as unread chats, so only offers and the first message
-- of a conversation (a new enquiry) become notifications. Muted chats and blocked senders are skipped.
create or replace function notify_message() returns trigger language plpgsql security definer set search_path = public as $$
declare who text; c conversations; first_msg boolean; r record;
begin
  if new.type not in ('text', 'offer', 'listing', 'image', 'story_reply') then return null; end if;
  select * into c from conversations where id = new.conversation_id;
  select display_name into who from profiles where id = new.sender_id;
  first_msg := not exists (select 1 from messages where conversation_id = new.conversation_id and id <> new.id);
  if new.type <> 'offer' and not first_msg then return null; end if;

  for r in
    select m.user_id from conversation_members m
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id and m.muted_at is null
      and not is_blocked(m.user_id, new.sender_id)
  loop
    insert into notifications (recipient_id, type, payload) values (
      r.user_id,
      case when new.type = 'offer' then 'offer' else 'message' end,
      jsonb_build_object(
        'title', case when new.type = 'offer'
                      then coalesce(who, 'Someone') || ' made an offer of ₦' || to_char(new.offer_amount_minor / 100, 'FM999,999,999,999')
                      else coalesce(who, 'Someone') || ' messaged you' end,
        'body', coalesce(c.listing_snapshot ->> 'title', 'New conversation'),
        'actor_id', new.sender_id,
        'conversation_id', new.conversation_id,
        'listing_id', c.listing_id)
    );
  end loop;
  return null;
end $$;
drop trigger if exists messages_notify on messages;
create trigger messages_notify after insert on messages for each row execute function notify_message();

-- New listing from someone you follow ---------------------------------------
create or replace function notify_new_listing() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status <> 'active' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return null; end if;
  if tg_op = 'UPDATE' and old.published_at is not null then return null; end if;  -- relisting isn't news
  select coalesce(shop_name, display_name) into who from profiles where id = new.seller_id;
  insert into notifications (recipient_id, type, payload)
  select f.follower_id, 'new_listing',
         jsonb_build_object('title', coalesce(who, 'A seller you follow') || ' listed something new', 'body', new.title, 'actor_id', new.seller_id, 'listing_id', new.id)
  from follows f
  where f.followed_id = new.seller_id and not is_blocked(f.follower_id, new.seller_id);
  return null;
end $$;
drop trigger if exists listings_notify on listings;
create trigger listings_notify after insert or update of status on listings for each row execute function notify_new_listing();
