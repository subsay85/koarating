import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// 딱 한 번만 만들어서 밖으로 내보냅니다(export).
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
