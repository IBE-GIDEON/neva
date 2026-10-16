# Remote sync (`connectRemote`)

Connects the shared zustand store to Supabase. Screens keep calling the same store actions; this module
wraps them with write-through versions, loads server data and applies realtime changes.

## Calling it

```ts
import { connectRemote } from '@neva/core';

// after a session exists (adoptRemoteSession / signInWithProvider has run):
const disconnect = connectRemote({ store: useStore, supabase, userId: session.user.id, uploadImage });
// on sign-out the wrapped signOut()/clearDeviceData() call disconnect() for you; calling it yourself is safe.
```

Call it once per signed-in session (e.g. in `onAuthStateChange` for `SIGNED_IN` / initial session). Calling it
again disconnects the previous connection first.

### `uploadImage(bucket, path, dataUrl) => Promise<storagePath>`

Platform-specific; apps provide it.

- `bucket`: `'avatars' | 'listing-media' | 'stories' | 'chat-media'`
- `path`: full object path inside the bucket. It always starts with `<auth uid>/` (storage policy); chat photos
  are `<uid>/<conversationId>/<messageId>.jpg`.
- `dataUrl`: the local image as the store holds it. On web this is a `data:` URL; on mobile it is usually a
  `file://` (or `content://`, `ph://`) URI from expo-image-picker. Upload it with the right `contentType`
  (jpeg/png/webp) and `upsert: true`.
- Resolve with the storage path written (normally `path`). Throw on failure; the action shows an error.

## Id mapping

- **Users**: the store keeps the signed-in user as `'me'` (`s.meId`). Rows written use the auth uid; rows read
  with `id === userId` become `'me'`. This happens only at the boundary (`context.ts`).
- **Messages, listings, stories, reviews, reports** are inserted with their local id (core `uid()` is UUID v4),
  so the local id is the server id. Retries are idempotent (`messages.id` / `client_id`; a duplicate counts as success).
- **Conversations** are created only through the `start_conversation` RPC (there's no insert policy).
  `startConversation` stays synchronous: it creates the local conversation optimistically, returns the local
  id (screens navigate with it), and starts the RPC in the background. `sendMessage` waits for that RPC.
  - With migration 0003, the RPC takes `p_id` = the local id, so new conversations get the **same id** on the server.
  - If the server returns a different id (the chat already existed, or 0003 isn't applied yet), the **local id
    stays the store key**. An alias (local → server) translates ids for writes and realtime. If both ids were
    in the store, they're merged under the local id. Aliases last for the app session. On the next cold start
    the server id is used.

## What is synced

| Area | Load | Write | Realtime |
|---|---|---|---|
| Profile (+ `profile_private` interests/settings) | ✓ | completeProfile (creates the row), completeInterests, updateProfile (avatar → `avatars`), updateSettings (all except theme) | – |
| Follows / saves / blocks | ✓ | toggleFollow / toggleSave / toggleBlock | – |
| Listings (active feed 300, mine in any status, saved, those in chats; media + attributes) | ✓ | publishDraft (photos → `listing-media`, create or edit), setListingStatus, bumpView (0003) | – |
| Conversations (100 most recent, 40 messages each, reactions) | ✓ | startConversation, sendMessage (photos → `chat-media`), retryMessage, respondToOffer, react, deleteMessage (soft), markRead, togglePin, toggleMute, setArchived, deleteConversation, clearChat (0003) | messages, conversations, reactions + members (0003) |
| Stories (live ones from people I follow, plus mine; view counts on mine) | ✓ | addStory (image → `stories`), deleteStory, markStoryViewed | stories |
| Reviews of loaded sellers + my reviews | ✓ | saveReview, deleteReview (edit/delete need 0003) | – |
| Notifications | ✓ | markNotificationsRead, deleteNotification, clearNotifications | notifications |
| Reports | ✓ | submitReport | – |
| People search | – | `searchPeople` still returns the local match right away, then calls `search_people` (debounced 350 ms, cached 60 s) and merges results into `s.users`. Screens that memoize on `users` update automatically. | – |

Server data wins on connect. Local messages that are still `pending` or `failed`, plus anything created while
the load was running, are kept. Failed messages keep the existing tap-to-retry UI. Other failed writes are
reverted, and a toast says what went wrong. Small background writes (read markers, story views, view counts,
notification read state) fail silently.

If the first load fails because the device is offline, the local data stays on screen and loading retries with
backoff. After realtime reconnects, chats and notifications are re-fetched.

## Known limitations

- Only stored on this device: `toggleStar`, `markUnread`, drafts (`setDraftText`), theme, recent searches.
- Without **0003_sync.sql**:
  - `coverUri` and voice-note length aren't saved.
  - `clearChat` stays on this device, and `deleteConversation` archives the chat on the server instead.
  - Read ticks never reach "read" for your own messages.
  - Reviews can't be edited or deleted.
  - Notifications can't be deleted (they're marked read instead).
  - `saves`/`views` counters don't move.
  - Follower counts come from row counts, which are capped by the API row limit.
- Read receipts (0003) don't honour the `readReceipts` setting yet: `last_read_at` is always written.
- Chat photos use signed URLs that last 7 days. They're re-signed on each connect.
- Nothing on the server creates `notifications` rows yet. They load and stream once a backend job or trigger writes them.
- Typing indicators and online presence aren't synced.
