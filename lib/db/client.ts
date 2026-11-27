import type { SupabaseClient } from "@supabase/supabase-js";

/** Any Supabase client. Repositories take the client as a parameter so the
 *  caller decides which identity (and therefore which RLS rules) applies. */
export type Db = SupabaseClient;
