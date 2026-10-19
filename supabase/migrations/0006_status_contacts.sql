-- Neva — statuses reach your "contacts" like WhatsApp: people who follow you OR people you have a chat with.
-- Additive (replaces one read rule). Run once in Supabase → SQL Editor after 0005.

drop policy if exists "live stories" on stories;
create policy "live stories" on stories for select using (
  expires_at > now() and not is_blocked(auth.uid(), user_id) and (
    user_id = auth.uid()
    or audience = 'everyone'
    or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followed_id = stories.user_id)
    or exists (
      select 1 from conversations c
      where (c.buyer_id = auth.uid() and c.seller_id = stories.user_id)
         or (c.seller_id = auth.uid() and c.buyer_id = stories.user_id)
    )
  )
);
