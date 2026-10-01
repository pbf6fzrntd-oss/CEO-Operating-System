declare namespace Cloudflare {
 interface Env {
  DB?: D1Database; BUCKET?: R2Bucket;
  XAI_API_KEY?: string; XAI_MODEL?: string;
  GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; GOOGLE_REFRESH_TOKEN?: string; GOOGLE_CALENDAR_ID?: string;
  SLACK_BOT_TOKEN?: string; SLACK_CHANNEL_IDS?: string;
 }
}
