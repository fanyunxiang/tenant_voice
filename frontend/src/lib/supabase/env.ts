type SupabaseEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServerKey?: string;
};

const getRequiredEnv = (value: string | undefined, key: string) => {
  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
};

export function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = getRequiredEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_URL',
  );
  const supabasePublishableKey = getRequiredEnv(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)',
  );

  const supabaseServerKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseServerKey,
  };
}
