import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not defined');
}
if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be defined');
}
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
