import { createClient } from "@supabase/supabase-js";
import { AUTH_OPTIONS } from "./session.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: AUTH_OPTIONS,
    })
  : null;
