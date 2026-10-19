/**
 * Database row shapes (supabase/migrations/0001_init.sql, plus the optional columns from 0003_sync.sql).
 * Column names are exact; keep in sync with the migrations.
 */
import type { Condition, ListingStatus, VerificationLabel } from '../types';

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  city: string;
  is_seller: boolean;
  shop_name: string | null;
  shop_type: 'individual' | 'retail' | null;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  /** 0003 */
  cover_path?: string | null;
};

export type ProfilePrivateRow = { id: string; interests: string[]; settings: Record<string, unknown> };

export type VerificationRow = { seller_id: string; label: VerificationLabel };

export type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category_id: string;
  custom_category: string | null;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  condition: Condition;
  price_minor: number;
  currency: 'NGN';
  negotiable: boolean;
  city: string;
  area: string | null;
  pickup: boolean;
  delivery: boolean;
  status: ListingStatus;
  promoted: boolean;
  views: number;
  saves: number;
  enquiries: number;
  created_at: string;
  published_at: string | null;
};

export type ListingMediaRow = { id: string; listing_id: string; storage_path: string; sort_order: number; media_type: 'image' | 'video' };

export type ListingAttributeRow = { listing_id: string; attribute_key: string; value_text: string | null; value_num: number | null; value_bool: boolean | null };

export type ConversationRow = {
  id: string;
  listing_id: string | null;
  listing_snapshot: { title?: string; price_minor?: number; condition?: Condition; image?: string } | null;
  buyer_id: string;
  seller_id: string;
  status: 'active' | 'archived' | 'blocked' | 'reported' | 'restricted';
  created_at: string;
  last_message_at: string;
};

export type MemberRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  muted_at: string | null;
  archived_at: string | null;
  pinned_at: string | null;
  /** 0003 */
  cleared_at?: string | null;
  hidden_at?: string | null;
  /** 0005 */
  delivered_at?: string | null;
  seen_at?: string | null;
};

export type MessageRow = {
  id: string;
  client_id: string | null;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'offer' | 'listing' | 'system' | 'story_reply' | 'voice';
  body: string | null;
  media_path: string | null;
  listing_id: string | null;
  offer_amount_minor: number | null;
  offer_state: 'pending' | 'accepted' | 'declined' | 'countered' | null;
  reply_to_id: string | null;
  deleted_at: string | null;
  created_at: string;
  /** 0003 */
  meta?: { voiceSeconds?: number } | null;
};

export type ReactionRow = { message_id: string; user_id: string; emoji: string };

export type StoryRow = {
  id: string;
  user_id: string;
  media_path: string | null;
  text: string | null;
  bg: string | null;
  caption: string | null;
  listing_id: string | null;
  audience: 'everyone' | 'followers';
  created_at: string;
  expires_at: string;
  /** 0007 */
  media_type?: 'image' | 'video';
  duration_seconds?: number | null;
};

export type ReviewRow = {
  id: string;
  reviewer_id: string;
  seller_id: string;
  listing_id: string | null;
  rating: number;
  text: string | null;
  verification_type: 'unverified' | 'conversation' | 'transaction';
  status: 'visible' | 'hidden' | 'removed';
  created_at: string;
};

export type ReportRow = {
  id: string;
  case_id: string;
  reporter_id: string;
  target_type: 'listing' | 'user' | 'message' | 'story';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'in_review' | 'actioned' | 'closed';
  created_at: string;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};
