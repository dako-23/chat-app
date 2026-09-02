import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Ясно съобщение вместо мълчалив срив, ако ключовете липсват
  console.error(
    "Липсват VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Виж .env.example."
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
