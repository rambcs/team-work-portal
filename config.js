// Supabase project connection. The publishable key is meant to be public —
// the database rules in supabase/*.sql are what keep the data safe.
// Never put a secret / service_role key here.
export const SUPABASE_URL = 'https://nybnityzzjbvbjowiqzd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_coaUTKrUSdRleCzwDC-JEw_AJKc-7me';

// Public half of the push-alert key pair (the private half lives only in Supabase secrets).
export const VAPID_PUBLIC_KEY = 'BMKbAK2M5DAvOmvuEF_6iDhX5Dqrknzo8iipgpQMZ735zfyWhCaWChnoKxqrTvBZcP18du73ZbSmxUn_uEE7NS8';

// Shown in the header and browser tab.
export const PORTAL_NAME = 'Team Work Portal';
