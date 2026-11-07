import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client configuration is unavailable.');
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

// Defer initialization until a browser feature actually uses Supabase. This lets
// Next.js prerender the app without inventing build-time URLs or credentials.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = getSupabaseClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
