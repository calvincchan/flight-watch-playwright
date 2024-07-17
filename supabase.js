import { createClient } from "@supabase/supabase-js";

/** Prepare Supabase */
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
