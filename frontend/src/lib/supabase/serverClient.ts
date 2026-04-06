import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

export function getSupabaseServerClient() {
  const { supabaseUrl, supabasePublishableKey, supabaseServerKey } = getSupabaseEnv();

  return createClient(supabaseUrl, supabaseServerKey || supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
