import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

export function getSupabaseServerClient() {
  const { supabaseUrl, supabaseServerKey } = getSupabaseEnv();

  if (!supabaseServerKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_KEY must be set for server-side Supabase operations',
    );
  }

  return createClient(supabaseUrl, supabaseServerKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
