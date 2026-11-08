declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_OWNER_EMAIL?: string;
    AUTH_MODE?: 'sites' | 'cloudflare-access';
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    BUCKET?: R2Bucket;
  }
}
