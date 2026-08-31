
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

/**
 * Helper to fetch all rows from a Supabase query, setting range(0, maxLimit)
 * to bypass PostgREST's default 1,000-row limit in a single atomic request.
 */
export async function fetchAllSupabaseRows<T = any>(
    queryBuilderFn: () => any,
    maxLimit = 9999
): Promise<T[]> {
    try {
        const { data, error } = await queryBuilderFn().range(0, maxLimit);
        if (error) {
            console.error('[fetchAllSupabaseRows] Error fetching rows:', error);
            return [];
        }
        return (data as T[]) || [];
    } catch (err) {
        console.error('[fetchAllSupabaseRows] Unexpected error:', err);
        return [];
    }
}
