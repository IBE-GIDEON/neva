// Domain types mirror supabase/migrations/0001_init.sql (blueprint §10).

export type Condition =
  | 'new_sealed'
  | 'new_open_box'
  | 'used_excellent'
  | 'used_good'
  | 'used_fair'
  | 'refurbished';

export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'sold' | 'rejected' | 'expired' | 'removed';

export type VerificationLabel = 'contact_confirmed' | 'business_submitted' | 'identity_checked';

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUri?: string;
  /** Cover / banner image shown behind the avatar on the profile & shop page. */
  coverUri?: string;
  bio?: string;
  city: string;
  isSeller: boolean;
  shopName?: string;
  shopType?: 'individual' | 'retail';
  verifications: VerificationLabel[];
  followers: number;
  following: number;
  joinedAt: number;
  online?: boolean;
  lastSeenAt?: number;
  responseNote?: string; // only shown when measured server-side
  rating?: { avg: number; count: number };
};

export type Listing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  /** Seller-defined category when categoryId === 'other' (searchable). */
  customCategory?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  condition: Condition;
  priceMinor: number; // kobo
  currency: 'NGN';
  negotiable: boolean;
  city: string;
  area?: string;
  pickup: boolean;
  delivery: boolean;
  images: string[];
  attributes: Record<string, string>;
  status: ListingStatus;
  createdAt: number;
  publishedAt?: number;
  views: number;
  saves: number;
  enquiries: number;
  promoted?: boolean;
};

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'offer' | 'listing' | 'system' | 'story_reply' | 'voice';
  body?: string;
  imageUri?: string;
  listingId?: string;
  storyImage?: string;
  offer?: { amountMinor: number; state: 'pending' | 'accepted' | 'declined' | 'countered' };
  voice?: { seconds: number };
  replyToId?: string;
  reactions?: Record<string, string>;
  status: MessageStatus;
  createdAt: number;
  starred?: boolean;
  deleted?: boolean;
};

export type Conversation = {
  id: string;
  participantId: string;
  listingId?: string;
  listingSnapshot?: { title: string; priceMinor: number; image: string; condition: Condition };
  status: 'active' | 'archived' | 'blocked' | 'reported';
  pinned: boolean;
  muted: boolean;
  unread: number;
  createdAt: number;
  lastMessageAt: number;
  draft?: string;
};

export type Story = {
  id: string;
  userId: string;
  imageUri?: string;
  text?: string;
  bg?: string;
  caption?: string;
  listingId?: string;
  createdAt: number;
  viewers?: number;
};

export type NotificationItem = {
  id: string;
  type: 'message' | 'follow' | 'new_listing' | 'price_drop' | 'moderation' | 'security' | 'offer' | 'system';
  title: string;
  body: string;
  actorId?: string;
  listingId?: string;
  conversationId?: string;
  createdAt: number;
  read: boolean;
};

export type Report = {
  id: string;
  caseId: string;
  targetType: 'listing' | 'user' | 'message' | 'story';
  targetId: string;
  reason: string;
  details?: string;
  status: 'open' | 'in_review' | 'actioned' | 'closed';
  createdAt: number;
};

export type Review = {
  id: string;
  reviewerId: string;
  sellerId: string;
  listingId?: string;
  rating: number;
  text: string;
  verificationType: 'conversation' | 'unverified';
  createdAt: number;
};

export type ListingDraft = Partial<Omit<Listing, 'id' | 'sellerId' | 'status' | 'views' | 'saves' | 'enquiries'>> & {
  step: number;
  editingId?: string;
};

export type SearchFilters = {
  categoryId?: string;
  conditions: Condition[];
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  delivery?: boolean;
  sellerType?: 'individual' | 'retail';
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
};
