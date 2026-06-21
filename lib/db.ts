import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";

/**
 * Server-side Supabase access for the (encrypted) token store.
 *
 * ⚠️ CURRENTLY DORMANT / ON HOLD. This layer only activates when both
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (see `isDbConfigured`).
 * While unset, every function here no-ops and Reddit tokens live solely in the
 * encrypted Auth.js session cookie — no database is touched. The code is kept
 * intact so persistence (and cross-device prefs) can be switched on later by
 * running supabase/schema.sql and providing the env vars.
 *
 * Uses the service-role key, so this module must NEVER be imported into a
 * client component. RLS denies everything by default; the service role bypasses
 * it.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export function isDbConfigured(): boolean {
  return !!getClient();
}

export interface StoredUser {
  id: string;
  redditId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // epoch ms
}

interface UpsertInput {
  redditId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // epoch ms
}

/** Insert or update a user's encrypted tokens, keyed by reddit_id. */
export async function upsertUser(input: UpsertInput): Promise<void> {
  const client = getClient();
  if (!client) return; // DB optional in dev — tokens then live only in the JWT.
  const { error } = await client.from("users").upsert(
    {
      reddit_id: input.redditId,
      username: input.username,
      avatar_url: input.avatarUrl,
      access_token: encrypt(input.accessToken),
      refresh_token: encrypt(input.refreshToken),
      token_expires_at: new Date(input.tokenExpiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "reddit_id" }
  );
  if (error) throw new Error(`Failed to persist user: ${error.message}`);
}

/** Load + decrypt a user's stored tokens. */
export async function getUserByRedditId(
  redditId: string
): Promise<StoredUser | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("reddit_id", redditId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    redditId: data.reddit_id,
    username: data.username,
    avatarUrl: data.avatar_url,
    accessToken: decrypt(data.access_token),
    refreshToken: decrypt(data.refresh_token),
    tokenExpiresAt: new Date(data.token_expires_at).getTime(),
  };
}

/** Update just the token columns after a refresh. */
export async function updateTokens(
  redditId: string,
  tokens: { accessToken: string; refreshToken: string; tokenExpiresAt: number }
): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client
    .from("users")
    .update({
      access_token: encrypt(tokens.accessToken),
      refresh_token: encrypt(tokens.refreshToken),
      token_expires_at: new Date(tokens.tokenExpiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("reddit_id", redditId);
  if (error) throw new Error(`Failed to update tokens: ${error.message}`);
}
