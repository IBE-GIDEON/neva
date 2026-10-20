-- Neva — real voice notes in chats. Additive. Run once in Supabase → SQL Editor after 0007.
-- Voice notes are stored privately in chat-media (only the two people in the chat can play them),
-- at <sender id>/<conversation id>/<message id>.<ext>, same rules as chat photos.

update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg'
    ]
where id = 'chat-media';
