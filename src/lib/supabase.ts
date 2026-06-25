import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (string: string | undefined) => {
  if (!string) return false;
  if (string.includes('YOUR_SUPABASE')) return false;
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const cleanUrl = supabaseUrl?.replace(/\/rest\/v1\/?$/, '');

export const supabase = isValidUrl(cleanUrl) && supabaseAnonKey && !supabaseAnonKey.includes('YOUR_SUPABASE')
  ? createClient(cleanUrl!, supabaseAnonKey) 
  : null;
