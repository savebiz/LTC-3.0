
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase Environment Variables');
    console.log('VITE_SUPABASE_URL present:', !!supabaseUrl);
    console.log('VITE_SUPABASE_ANON_KEY present:', !!supabaseAnonKey);
    console.log('Environment Mode:', import.meta.env.MODE);
} else {
    console.log('Supabase Configured. URL Length:', supabaseUrl.length);
}

export const supabase = createClient((supabaseUrl || '').trim(), (supabaseAnonKey || '').trim());
