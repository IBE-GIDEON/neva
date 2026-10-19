/** Local id for the signed-in user until server auth ids replace it. */
export const ME_ID = 'me';

/** How long each photo/text status shows before moving on (same on phone and web). */
export const STORY_DURATION_MS = 5500;

/** Longest video status (WhatsApp-style), and the largest upload the storage bucket accepts. */
export const STORY_MAX_VIDEO_SECONDS = 30;
export const STORY_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
