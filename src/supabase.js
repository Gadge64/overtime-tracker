// ============================================================
// supabase.js — Supabase client
//
// Creates and exports a single shared Supabase client instance.
// Import { supabase } from './supabase' wherever you need to
// query the database or subscribe to realtime changes.
//
// Credentials come from .env — copy .env.example to .env
// and fill in your project's URL and anon key.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials missing.\n' +
    'Copy .env.example to .env and fill in your project URL and anon key.\n' +
    'Find them in: Supabase Dashboard → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
