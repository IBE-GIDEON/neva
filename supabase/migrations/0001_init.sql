-- Neva — initial schema (blueprint §10, §11, §15)
-- UUID PKs, UTC timestamps, money in integer minor units (kobo), RLS on every user table.

create extension if not exists pg_trgm;
create extension if not exists citext;

-- ---------- enums ----------
create type listing_condition as enum ('new_sealed','new_open_box','used_excellent','used_good','used_fair','refurbished');
create type listing_status    as enum ('draft','pending_review','active','paused','sold','rejected','expired','removed');
create type account_status    as enum ('unverified','active','limited','suspended','deletion_pending','deleted');
create type conversation_status as enum ('active','archived','blocked','reported','restricted');
create type message_type      as enum ('text','image','offer','listing','system','story_reply','voice');
create type offer_state       as enum ('pending','accepted','declined','countered');
create type report_target     as enum ('listing','user','message','story');
create type report_status     as enum ('open','in_review','actioned','closed');
create type verification_label as enum ('contact_confirmed','business_submitted','identity_checked');
create type staff_role        as enum ('support','moderator','finance','super_admin');

-- ---------- identity ----------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext unique not null check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name  text not null check (char_length(display_name) between 2 and 60),
  avatar_path   text,
  bio           text check (char_length(bio) <= 500),
  city          text not null,
  is_seller     boolean not null default false,
  shop_name     text,
  shop_type     text check (shop_type in ('individual','retail')),
  status        account_status not null default 'active',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create table reserved_usernames (username citext primary key);
insert into reserved_usernames values ('admin'),('neva'),('support'),('moderator'),('help'),('official');

-- private fields kept apart from public profile (blueprint §10)
create table profile_private (
  id            uuid primary key references profiles(id) on delete cascade,
  interests     text[] not null default '{}',
  settings      jsonb not null default '{}'::jsonb
);

create table seller_verifications (
  seller_id     uuid references profiles(id) on delete cascade,
  label         verification_label not null,
  verified_at   timestamptz not null default now(),
  verified_by   uuid,
  primary key (seller_id, label)
);

create table staff_roles (user_id uuid references profiles(id) on delete cascade, role staff_role not null, primary key (user_id, role));

-- ---------- catalogue ----------
create table categories (
  id         text primary key,
  parent_id  text references categories(id),
  name       text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  allowed_attributes text[] not null default '{}'
);

create table listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 6 and 80),
  description   text not null default '' check (char_length(description) <= 1500),
  category_id   text not null references categories(id),
  custom_category text check (char_length(custom_category) <= 40),  -- seller-defined when category_id = 'other'
  subcategory   text check (char_length(subcategory) <= 40),
  brand         text,
  model         text,
  condition     listing_condition not null,
  price_minor   bigint not null check (price_minor > 0),
  currency      char(3) not null default 'NGN' check (currency in ('NGN')),
  negotiable    boolean not null default true,
  city          text not null,
  area          text,
  pickup        boolean not null default true,
  delivery      boolean not null default false,
  status        listing_status not null default 'draft',
  promoted      boolean not null default false,
  views         int not null default 0,
  saves         int not null default 0,
  enquiries     int not null default 0,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  search        tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,'') || ' ' || coalesce(custom_category,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subcategory,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'C')
  ) stored,
  check (pickup or delivery)
);
create index listings_feed_idx on listings (status, published_at desc, id);
create index listings_seller_idx on listings (seller_id, status);
create index listings_cat_idx on listings (category_id, status, price_minor);
create index listings_search_idx on listings using gin (search);
create index listings_title_trgm on listings using gin (title gin_trgm_ops);
create index listings_custom_cat_idx on listings (lower(custom_category)) where category_id = 'other';

create table listing_media (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references listings(id) on delete cascade,
  storage_path      text not null,
  sort_order        int not null default 0,
  media_type        text not null default 'image' check (media_type in ('image','video')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected'))
);

create table listing_attributes (
  listing_id    uuid references listings(id) on delete cascade,
  attribute_key text not null,
  value_text    text,
  value_num     numeric,
  value_bool    boolean,
  primary key (listing_id, attribute_key)
);

create table listing_status_history (
  id          bigserial primary key,
  listing_id  uuid not null references listings(id) on delete cascade,
  from_status listing_status,
  to_status   listing_status not null,
  changed_by  uuid,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------- social ----------
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  followed_id uuid references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create table saved_listings (
  user_id    uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  title      text not null,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now()
);
create table collection_items (collection_id uuid references collections(id) on delete cascade, listing_id uuid references listings(id) on delete cascade, primary key (collection_id, listing_id));

-- ---------- status / stories (24h) ----------
create table stories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  media_path text,
  text       text check (char_length(text) <= 240),
  bg         text,
  caption    text check (char_length(caption) <= 200),
  listing_id uuid references listings(id) on delete set null,
  audience   text not null default 'followers' check (audience in ('everyone','followers')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  check (media_path is not null or text is not null)
);
create index stories_live_idx on stories (user_id, expires_at desc);
create table story_views (story_id uuid references stories(id) on delete cascade, viewer_id uuid references profiles(id) on delete cascade, viewed_at timestamptz not null default now(), primary key (story_id, viewer_id));

-- ---------- messaging ----------
create table conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references listings(id) on delete set null,
  listing_snapshot jsonb,  -- title, price_minor, image, condition at conversation start
  buyer_id         uuid not null references profiles(id),
  seller_id        uuid not null references profiles(id),
  status           conversation_status not null default 'active',
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (buyer_id, seller_id, listing_id)
);
create table conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id         uuid references profiles(id) on delete cascade,
  last_read_at    timestamptz,
  muted_at        timestamptz,
  archived_at     timestamptz,
  pinned_at       timestamptz,
  primary key (conversation_id, user_id)
);
create table messages (
  id              uuid primary key default gen_random_uuid(),
  client_id       text,                     -- idempotency key from device: prevents duplicate sends on retry
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id),
  type            message_type not null default 'text',
  body            text check (char_length(body) <= 4000),
  media_path      text,
  listing_id      uuid references listings(id) on delete set null,
  offer_amount_minor bigint check (offer_amount_minor > 0),
  offer_state     offer_state,
  reply_to_id     uuid references messages(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index messages_conv_idx on messages (conversation_id, created_at desc, id);
create table message_reactions (message_id uuid references messages(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, emoji text not null, primary key (message_id, user_id));

-- ---------- trust & safety ----------
create table reviews (
  id                uuid primary key default gen_random_uuid(),
  reviewer_id       uuid not null references profiles(id),
  seller_id         uuid not null references profiles(id),
  listing_id        uuid references listings(id) on delete set null,
  order_id          uuid,
  rating            smallint not null check (rating between 1 and 5),
  text              text check (char_length(text) <= 1000),
  verification_type text not null default 'unverified' check (verification_type in ('unverified','conversation','transaction')),
  status            text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at        timestamptz not null default now(),
  check (reviewer_id <> seller_id),
  unique (reviewer_id, seller_id, listing_id)
);
create table reports (
  id          uuid primary key default gen_random_uuid(),
  case_id     text unique not null default ('NV-' || upper(substr(md5(random()::text), 1, 8))),
  reporter_id uuid not null references profiles(id),
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null,
  details     text check (char_length(details) <= 1000),
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index reports_queue_idx on reports (status, created_at);
create table moderation_actions (
  id           bigserial primary key,
  moderator_id uuid not null references profiles(id),
  report_id    uuid references reports(id),
  target_type  report_target not null,
  target_id    uuid not null,
  action       text not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);

-- ---------- notifications ----------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,  -- no sensitive message content
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on notifications (recipient_id, created_at desc);
create table push_tokens (user_id uuid references profiles(id) on delete cascade, token text primary key, platform text, updated_at timestamptz not null default now());

-- ---------- monetization (later) ----------
create table promotion_campaigns (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references profiles(id),
  listing_id   uuid not null references listings(id),
  budget_minor bigint not null check (budget_minor > 0),
  start_at     timestamptz not null,
  end_at       timestamptz not null check (end_at > start_at),
  status       text not null default 'pending',
  payment_ref  text
);

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function is_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function is_member(conv uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c where c.id = conv and auth.uid() in (c.buyer_id, c.seller_id));
$$;

create or replace function is_staff(r staff_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_roles where user_id = auth.uid() and (role = r or role = 'super_admin'));
$$;

-- Never trust client-supplied seller_id / sender_id / status (blueprint §11)
create or replace function enforce_listing_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.seller_id := coalesce(old.seller_id, auth.uid());
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status = 'removed' and new.status <> 'removed' and not is_staff('moderator') then
    raise exception 'removed listings can only be restored by moderation';
  end if;
  if tg_op = 'UPDATE' and (new.promoted <> old.promoted) and not is_staff('super_admin') then
    new.promoted := old.promoted;  -- promotion only via server-side purchase flow
  end if;
  if new.status = 'active' and new.published_at is null then new.published_at := now(); end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into listing_status_history (listing_id, from_status, to_status, changed_by) values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger listings_owner before insert or update on listings for each row execute function enforce_listing_owner();

create or replace function enforce_message_sender() returns trigger language plpgsql security definer set search_path = public as $$
declare c conversations;
begin
  select * into c from conversations where id = new.conversation_id;
  new.sender_id := auth.uid();
  new.created_at := now();  -- server timestamp
  if auth.uid() not in (c.buyer_id, c.seller_id) then raise exception 'not a participant'; end if;
  if is_blocked(c.buyer_id, c.seller_id) then raise exception 'blocked'; end if;
  -- anti-spam: max 30 messages per minute per sender
  if (select count(*) from messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  update conversations set last_message_at = now() where id = c.id;
  return new;
end $$;
create trigger messages_sender before insert on messages for each row execute function enforce_message_sender();

-- create-or-reuse conversation for a listing (blueprint §11 Messaging)
create or replace function start_conversation(p_seller uuid, p_listing uuid default null) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; l listings;
begin
  if p_seller = auth.uid() then raise exception 'cannot message yourself'; end if;
  if is_blocked(auth.uid(), p_seller) then raise exception 'blocked'; end if;
  if (select count(*) from conversations where buyer_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited'; end if;
  select id into cid from conversations where buyer_id = auth.uid() and seller_id = p_seller and listing_id is not distinct from p_listing;
  if cid is not null then return cid; end if;
  if p_listing is not null then
    select * into l from listings where id = p_listing and seller_id = p_seller and status = 'active';
    if l.id is null then raise exception 'listing unavailable'; end if;
    update listings set enquiries = enquiries + 1 where id = p_listing;
  end if;
  insert into conversations (buyer_id, seller_id, listing_id, listing_snapshot)
  values (auth.uid(), p_seller, p_listing, case when l.id is null then null else jsonb_build_object('title', l.title, 'price_minor', l.price_minor, 'condition', l.condition) end)
  returning id into cid;
  insert into conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, p_seller);
  return cid;
end $$;

-- People search by @username / name for starting DMs. Rate-limited; respects "Show me in search".
create index profiles_username_trgm on profiles using gin (username gin_trgm_ops);
create index profiles_display_name_trgm on profiles using gin (display_name gin_trgm_ops);

create table people_searches (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index people_searches_user_idx on people_searches (user_id, created_at desc);
alter table people_searches enable row level security;  -- no policies: only reachable through the function below

create or replace function search_people(p_query text)
returns table (id uuid, username citext, display_name text, avatar_path text, city text)
language plpgsql security definer set search_path = public as $$
declare q text := lower(trim(both '@' from trim(p_query)));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(q) < 2 then return; end if;
  if (select count(*) from people_searches where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into people_searches (user_id) values (auth.uid());
  return query
    select p.id, p.username, p.display_name, p.avatar_path, p.city
    from profiles p
    left join profile_private pp on pp.id = p.id
    where p.id <> auth.uid()
      and p.status = 'active'
      and coalesce((pp.settings ->> 'discoverable')::boolean, true)
      and not is_blocked(auth.uid(), p.id)
      and (p.username ilike q || '%' or p.display_name ilike '%' || q || '%' or coalesce(p.shop_name, '') ilike '%' || q || '%')
    order by (p.username ilike q || '%') desc, p.display_name
    limit 20;
end $$;

-- =====================================================================
-- Row level security
-- =====================================================================
alter table profiles enable row level security;
alter table profile_private enable row level security;
alter table seller_verifications enable row level security;
alter table staff_roles enable row level security;
alter table categories enable row level security;
alter table listings enable row level security;
alter table listing_media enable row level security;
alter table listing_attributes enable row level security;
alter table listing_status_history enable row level security;
alter table follows enable row level security;
alter table saved_listings enable row level security;
alter table blocks enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table stories enable row level security;
alter table story_views enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table message_reactions enable row level security;
alter table reviews enable row level security;
alter table reports enable row level security;
alter table moderation_actions enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;
alter table promotion_campaigns enable row level security;

-- public reads
create policy "profiles readable" on profiles for select using (status not in ('suspended','deleted'));
create policy "own profile insert" on profiles for insert with check (id = auth.uid() and not exists (select 1 from reserved_usernames r where r.username = profiles.username));
create policy "own profile update" on profiles for update using (id = auth.uid());
create policy "own private" on profile_private for all using (id = auth.uid()) with check (id = auth.uid());
create policy "verifications readable" on seller_verifications for select using (true);
create policy "staff self" on staff_roles for select using (user_id = auth.uid());
create policy "categories readable" on categories for select using (active);

create policy "active listings readable" on listings for select using (status in ('active','sold') or seller_id = auth.uid() or is_staff('moderator'));
create policy "seller inserts listing" on listings for insert with check (auth.uid() is not null and status in ('draft','pending_review','active'));
create policy "seller edits listing" on listings for update using (seller_id = auth.uid() or is_staff('moderator'));
create policy "media readable" on listing_media for select using (exists (select 1 from listings l where l.id = listing_id and (l.status in ('active','sold') or l.seller_id = auth.uid())));
create policy "media owner write" on listing_media for all using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())) with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "attrs readable" on listing_attributes for select using (true);
create policy "attrs owner write" on listing_attributes for all using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())) with check (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "history owner/staff" on listing_status_history for select using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()) or is_staff('moderator'));

create policy "follows readable" on follows for select using (true);
create policy "own follows" on follows for insert with check (follower_id = auth.uid());
create policy "own unfollow" on follows for delete using (follower_id = auth.uid());
create policy "own saves" on saved_listings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own blocks" on blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "collections" on collections for select using (owner_id = auth.uid() or visibility = 'public');
create policy "own collections" on collections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "collection items" on collection_items for select using (exists (select 1 from collections c where c.id = collection_id and (c.owner_id = auth.uid() or c.visibility = 'public')));
create policy "own collection items" on collection_items for all using (exists (select 1 from collections c where c.id = collection_id and c.owner_id = auth.uid()));

create policy "live stories" on stories for select using (
  expires_at > now() and not is_blocked(auth.uid(), user_id) and
  (user_id = auth.uid() or audience = 'everyone' or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followed_id = stories.user_id))
);
create policy "own stories" on stories for insert with check (user_id = auth.uid());
create policy "delete own stories" on stories for delete using (user_id = auth.uid());
create policy "story views" on story_views for insert with check (viewer_id = auth.uid());
create policy "story owner sees views" on story_views for select using (viewer_id = auth.uid() or exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid()));

create policy "members read conversations" on conversations for select using (auth.uid() in (buyer_id, seller_id));
create policy "members update conversations" on conversations for update using (auth.uid() in (buyer_id, seller_id));
create policy "own membership" on conversation_members for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read messages" on messages for select using (is_member(conversation_id));
create policy "members send messages" on messages for insert with check (is_member(conversation_id));
create policy "sender edits message" on messages for update using (sender_id = auth.uid() or (is_member(conversation_id) and type = 'offer'));
create policy "reactions" on message_reactions for select using (exists (select 1 from messages m where m.id = message_id and is_member(m.conversation_id)));
create policy "own reactions" on message_reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reviews readable" on reviews for select using (status = 'visible');
create policy "write review" on reviews for insert with check (reviewer_id = auth.uid() and verification_type = 'unverified');  -- verified types set server-side only
create policy "own reports" on reports for select using (reporter_id = auth.uid() or is_staff('moderator'));
create policy "file report" on reports for insert with check (reporter_id = auth.uid());
create policy "staff update reports" on reports for update using (is_staff('moderator'));
create policy "staff actions" on moderation_actions for all using (is_staff('moderator')) with check (moderator_id = auth.uid());

create policy "own notifications" on notifications for select using (recipient_id = auth.uid());
create policy "mark read" on notifications for update using (recipient_id = auth.uid());
create policy "own push tokens" on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own campaigns" on promotion_campaigns for select using (seller_id = auth.uid());

-- seed taxonomy (Appendix A)
insert into categories (id, name, sort_order) values
  ('phones','Phones',1),('computers','Computers',2),('audio','Audio',3),('wearables','Wearables',4),('gaming','Gaming',5),
  ('power','Power',6),('smarthome','Smart home',7),('cameras','Cameras',8),('accessories','Accessories',9),('other','Other',99);

-- realtime
alter publication supabase_realtime add table messages, conversations, notifications;
