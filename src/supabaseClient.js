import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null, wenn die Zugangsdaten fehlen (z. B. bei Vercel nicht eingetragen).
// Dann bleibt der Online-Tisch aus, das Einzel-Handy-Spiel läuft weiter.
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
