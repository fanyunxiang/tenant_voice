import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

export function getSupabaseAuthClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
